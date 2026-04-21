"""Parser del Excel 'Comisiones Gerentes Equipo' (GE).

El archivo trae hojas 'Segundo Pago Gerentes Equipo', 'Persistencia Gerentes Equipo'
y 'Contratos Gerentes Equipo' (con todos los contratos). Agregamos por agencia/GE.
"""
from __future__ import annotations

from pathlib import Path

from app.models import Antiguedad, Company, PersonaInput, Role

from ._utils import find_sheet, read_sheet_as_dicts, safe_str, to_float

# Ciudades 5G definidas en las reglas del negocio
CIUDADES_5G = {"BARRANQUILLA", "BUCARAMANGA", "MEDELLIN", "MEDELLÍN", "CALI", "BOGOTA", "BOGOTÁ"}


def _is_5g(region: str) -> bool:
    region = (region or "").upper()
    return any(city in region for city in CIUDADES_5G)


def parse_gerentes_equipos(path: str | Path) -> list[PersonaInput]:
    path = str(path)
    contratos_sheet = find_sheet(path, "contratos gerentes equipo")
    persistencia_sheet = find_sheet(path, "persistencia gerentes equipo")
    segundo_sheet = find_sheet(path, "segundo pago gerentes equipo")
    if not contratos_sheet:
        return []

    contratos = read_sheet_as_dicts(path, contratos_sheet)

    # Agrupamos por GE (usamos la combinación Agencia + Cargo='Gerente Equipo')
    grupos: dict[tuple[str, str], dict] = {}
    for r in contratos:
        cargo = safe_str(r.get("Cargo")).lower()
        if "gerente" not in cargo and "equipo" not in cargo:
            # Solo nos interesan filas de GE
            pass
        agencia = safe_str(r.get("Agencia")) or safe_str(r.get("AgenciaCentroCosto"))
        key = (safe_str(r.get("AgenciaCentroCosto")), agencia)
        region = safe_str(r.get("Region de Venta"))
        tabla = safe_str(r.get("TablaComisiones"))

        g = grupos.setdefault(
            key,
            {
                "agencia": agencia,
                "centro_costo": safe_str(r.get("AgenciaCentroCosto")),
                "region": region,
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

    # Persistencia por agencia (override)
    if persistencia_sheet:
        for r in read_sheet_as_dicts(path, persistencia_sheet):
            key = (safe_str(r.get("AgenciaCentroCosto")), safe_str(r.get("Agencia")))
            if key in grupos:
                grupos[key]["persistencia"] = to_float(r.get("PorcentajePersistencia"))

    if segundo_sheet:
        for r in read_sheet_as_dicts(path, segundo_sheet):
            key = (safe_str(r.get("AgenciaCentroCosto")), safe_str(r.get("Agencia")))
            if key in grupos:
                grupos[key]["segundo_pago"] = to_float(r.get("PorcentajeSegundoPago"))

    out: list[PersonaInput] = []
    for (centro, agencia), g in grupos.items():
        region = g["region"]
        is_5g = _is_5g(region)
        company = Company.AUTO if is_5g else Company.FONBIENES  # heurística por región
        structure_id = "ge_5g" if is_5g else ("ge_fonbienes" if "FONBIENES" in region.upper() else "ge_no_5g")

        out.append(
            PersonaInput(
                cedula=centro or agencia,
                nombre=f"GE {agencia}",
                codigo=centro,
                company=company,
                role=Role.GERENTE_EQUIPO,
                structure_id=structure_id,
                antiguedad=Antiguedad.ANTIGUO,
                cantidad_contratos=g["cantidad"],
                monto_total_contratos=g["monto"],
                monto_mm=g["monto"] / 1_000_000,
                porcentaje_persistencia=g["persistencia"],
                porcentaje_segundo_pago=g["segundo_pago"],
                is_5g=is_5g,
                sistema_valor_salario=g["salario"],
                sistema_valor_bonificacion=g["bono"],
                sistema_monto_comision=g["comision"],
            )
        )
    return out
