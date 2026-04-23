"""Parser del Excel 'Comisiones Gerentes Equipo' (GE).

El archivo trae hojas:
- 'Contratos Gerentes Equipos': contratos detallados (un row por contrato)
- 'Persistencia Gerentes Equipos': persistencia por equipo
- 'Segundo Pago Gerentes Equipos': segundo pago por equipo
- 'Datos Th': clasificación por equipo (NUEVO / 5G / NO 5G / CAMIONES) — hecho a mano en sistema

Lógica:
- Agrupamos contratos por equipo (AgenciaCentroCosto, Agencia base) separando rows AC.
- Los equipos con sufijo ' AC' en Agencia se tratan como un "canal aliado" del equipo base
  (misma ciudad, misma clasificación) pero con reglas de comisión diferentes.
- Para cada equipo base se crean hasta 2 PersonaInput: base y AC (si existe).
- Ambos comparten cantidad/monto combinados (para selección de tier de bono).
- El bono del equipo combinado se asigna al AC si existe, o al base si no.
"""
from __future__ import annotations

from pathlib import Path

from app.models import Antiguedad, Company, PersonaInput, Role

from ._utils import find_sheet, read_sheet_as_dicts, safe_str, to_float

# Ciudades 5G definidas por las reglas de negocio (fallback si Datos Th no las marca)
CIUDADES_5G = {"BARRANQUILLA", "BUCARAMANGA", "MEDELLIN", "MEDELLÍN", "CALI", "BOGOTA", "BOGOTÁ"}

AC_SUFFIX = " AC"


def _is_5g_by_city(ciudad: str) -> bool:
    c = (ciudad or "").upper().strip()
    return any(city in c for city in CIUDADES_5G)


def _strip_ac(name: str) -> tuple[str, bool]:
    """Devuelve (nombre_base, es_ac). Quita sufijo ' AC' si aplica."""
    n = (name or "").strip()
    if n.upper().endswith(AC_SUFFIX):
        return n[: -len(AC_SUFFIX)].strip(), True
    return n, False


def _read_datos_th(path: str) -> dict[str, dict]:
    """Lee hoja 'Datos Th' y devuelve mapping equipo_base -> {ciudad, categoria}."""
    sheet = find_sheet(path, "datos th")
    if not sheet:
        return {}
    out: dict[str, dict] = {}
    for r in read_sheet_as_dicts(path, sheet):
        eq = safe_str(r.get("EQUIPO")).strip()
        if not eq or eq.lower().startswith("total"):
            continue
        ciudad = safe_str(r.get("CIUDAD"))
        cat = None
        # Prioridad: NUEVO > 5G > NO_5G > CAMIONES (mutuamente excluyentes en la hoja)
        if safe_str(r.get("NUEVO")).upper() == "OK":
            cat = "NUEVO"
        elif safe_str(r.get("5G")).upper() == "OK":
            cat = "5G"
        elif safe_str(r.get("NO 5G")).upper() == "OK":
            cat = "NO_5G"
        elif safe_str(r.get("CAMIONES")).upper() == "OK":
            cat = "CAMIONES"
        out[eq] = {"ciudad": ciudad, "categoria": cat}
    return out


def _choose_structure_id(categoria: str | None, ciudad: str) -> tuple[str, bool]:
    """Devuelve (structure_id, is_5g) segun categoria Datos Th y fallback a ciudad."""
    # NUEVO y CAMIONES usan el mismo motor por ciudad (Juan confirmó "camiones es la misma")
    if categoria == "5G":
        return "ge_5g", True
    if categoria == "NO_5G":
        return "ge_no_5g", False
    # NUEVO, CAMIONES o sin categoría → fallback por ciudad
    if _is_5g_by_city(ciudad):
        return "ge_5g", True
    return "ge_no_5g", False


def parse_gerentes_equipos(path: str | Path) -> list[PersonaInput]:
    path = str(path)
    contratos_sheet = find_sheet(path, "contratos gerentes equipo")
    persistencia_sheet = find_sheet(path, "persistencia gerentes equipo")
    segundo_sheet = find_sheet(path, "segundo pago gerentes equipo")
    if not contratos_sheet:
        return []

    datos_th = _read_datos_th(path)  # equipo_base -> {ciudad, categoria}

    contratos = read_sheet_as_dicts(path, contratos_sheet)

    # Agrupamos por equipo base + flag AC
    # key = (centro_costo_base, equipo_base, es_ac)
    grupos: dict[tuple[str, str, bool], dict] = {}
    for r in contratos:
        agencia_raw = safe_str(r.get("Agencia")) or safe_str(r.get("AgenciaCentroCosto"))
        centro_costo_raw = safe_str(r.get("AgenciaCentroCosto")) or agencia_raw
        agencia_base, es_ac = _strip_ac(agencia_raw)
        # El centro de costo del AC suele ser el mismo del base, pero lo normalizamos
        centro_costo_base, _ = _strip_ac(centro_costo_raw)
        key = (centro_costo_base, agencia_base, es_ac)
        region = safe_str(r.get("Region de Venta"))
        tabla = safe_str(r.get("TablaComisiones"))

        g = grupos.setdefault(
            key,
            {
                "agencia_base": agencia_base,
                "centro_costo_base": centro_costo_base,
                "agencia_raw": agencia_raw,
                "region": region,
                "es_ac": es_ac,
                "cantidad": 0,
                "monto": 0.0,
                "salario": 0.0,
                "bono": 0.0,
                "comision": 0.0,
                "persistencia": 0.0,
                "segundo_pago": 0.0,
                "tabla": tabla,
                "cargo": safe_str(r.get("Cargo")),
            },
        )
        g["cantidad"] += 1
        g["monto"] += to_float(r.get("ValorBien"))
        g["salario"] = max(g["salario"], to_float(r.get("Salario")))
        g["bono"] = max(g["bono"], to_float(r.get("Bono")))
        g["comision"] += to_float(r.get("ValorComision"))
        g["persistencia"] = max(g["persistencia"], to_float(r.get("PorcentajePersistencia")))
        g["segundo_pago"] = max(g["segundo_pago"], to_float(r.get("PorcentajeSegundoPago")))

    # Persistencia y segundo pago por equipo — hoja tiene rows separados para base y AC
    if persistencia_sheet:
        for r in read_sheet_as_dicts(path, persistencia_sheet):
            agencia_raw = safe_str(r.get("Agencia"))
            centro_raw = safe_str(r.get("AgenciaCentroCosto")) or agencia_raw
            agencia_base, es_ac = _strip_ac(agencia_raw)
            centro_base, _ = _strip_ac(centro_raw)
            persi = to_float(r.get("PorcentajePersistencia"))
            k = (centro_base, agencia_base, es_ac)
            if k in grupos:
                grupos[k]["persistencia"] = persi

    if segundo_sheet:
        for r in read_sheet_as_dicts(path, segundo_sheet):
            agencia_raw = safe_str(r.get("Agencia"))
            centro_raw = safe_str(r.get("AgenciaCentroCosto")) or agencia_raw
            agencia_base, es_ac = _strip_ac(agencia_raw)
            centro_base, _ = _strip_ac(centro_raw)
            sp = to_float(r.get("PorcentajeSegundoPago"))
            k = (centro_base, agencia_base, es_ac)
            if k in grupos:
                grupos[k]["segundo_pago"] = sp

    # Agregamos volumen combinado por equipo base
    # base_key (centro_base, agencia_base) -> cantidad_combinada, monto_combinado
    combinados: dict[tuple[str, str], dict] = {}
    for (centro, ag, es_ac), g in grupos.items():
        k = (centro, ag)
        c = combinados.setdefault(k, {"cantidad": 0, "monto": 0.0, "tiene_ac": False, "tiene_base": False})
        c["cantidad"] += g["cantidad"]
        c["monto"] += g["monto"]
        if es_ac:
            c["tiene_ac"] = True
        else:
            c["tiene_base"] = True

    out: list[PersonaInput] = []
    for (centro, agencia_base, es_ac), g in grupos.items():
        info = datos_th.get(agencia_base, {})
        ciudad = info.get("ciudad") or g["region"]
        categoria = info.get("categoria")
        structure_id, is_5g = _choose_structure_id(categoria, ciudad)
        antiguedad = Antiguedad.NUEVO if categoria == "NUEVO" else Antiguedad.ANTIGUO
        company = Company.AUTO

        comb = combinados.get((centro, agencia_base), {"cantidad": g["cantidad"], "monto": g["monto"], "tiene_ac": False, "tiene_base": True})
        # El bono va al AC si existe AC, sino al base
        asigna_bono = es_ac if comb["tiene_ac"] else (not es_ac)

        nombre = f"GE {agencia_base}"
        if es_ac:
            nombre += " (AC)"

        out.append(
            PersonaInput(
                cedula=f"{centro or agencia_base}{' AC' if es_ac else ''}".strip() or agencia_base,
                nombre=nombre,
                codigo=centro,
                company=company,
                role=Role.GERENTE_EQUIPO,
                structure_id=structure_id,
                antiguedad=antiguedad,
                cantidad_contratos=g["cantidad"],
                monto_total_contratos=g["monto"],
                monto_mm=g["monto"] / 1_000_000,
                porcentaje_persistencia=g["persistencia"],
                porcentaje_segundo_pago=g["segundo_pago"],
                is_5g=is_5g,
                is_canal_ac=es_ac,
                cantidad_combinada=comb["cantidad"],
                monto_combinado_mm=comb["monto"] / 1_000_000,
                asigna_bono_combinado=asigna_bono,
                sistema_valor_salario=g["salario"],
                sistema_valor_bonificacion=g["bono"],
                sistema_monto_comision=g["comision"],
            )
        )
    return out
