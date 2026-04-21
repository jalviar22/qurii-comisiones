"""Motor de cálculo de comisiones — aplica las reglas configurables a cada persona."""
from __future__ import annotations

from typing import Any

from app.models import Antiguedad, ComputedCommission, PersonaInput
from app.rules_loader import rules_store


def _tier_for(metric_value: float, tiers: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Encuentra el tier cuyo rango (min, max) contiene el valor de la métrica."""
    for t in tiers:
        min_v = t.get("min", 0) or 0
        max_v = t.get("max")
        if metric_value >= min_v and (max_v is None or metric_value <= max_v):
            return t
    return None


def _factor_by_persistencia(persistencia: float, table: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    if not table:
        return None
    for row in table:
        if row["min_pct"] <= persistencia < row["max_pct"]:
            return row
    return None


def _resolve_garantizado(g: Any, smlmv: float) -> float:
    if g is None:
        return 0.0
    if isinstance(g, str) and g.strip().upper() == "SMLMV":
        return smlmv
    try:
        return float(g)
    except (TypeError, ValueError):
        return 0.0


def compute_commission(persona: PersonaInput) -> ComputedCommission:
    """Aplica las reglas correspondientes a `persona.structure_id` y devuelve el resultado."""
    structure = rules_store.get_structure(persona.structure_id)
    if structure is None:
        return ComputedCommission(
            cedula=persona.cedula,
            nombre=persona.nombre,
            company=persona.company,
            role=persona.role,
            structure_id=persona.structure_id,
            cantidad_contratos=persona.cantidad_contratos,
            porcentaje_persistencia=persona.porcentaje_persistencia,
            porcentaje_segundo_pago=persona.porcentaje_segundo_pago,
            monto_base_comisionable=0.0,
            porcentaje_comision=0.0,
            factor_variable_persistencia=1.0,
            factor_segundo_pago=0.0,
            discrepancia=True,
            notas=[f"No se encontró la estructura '{persona.structure_id}' en rules.json"],
        )

    smlmv = rules_store.smlmv()

    metric = structure.get("metric", "cantidad_contratos")
    if metric == "cantidad_contratos":
        metric_value: float = float(persona.cantidad_contratos)
        monto_base = float(persona.monto_total_contratos)
    elif metric == "monto_mm":
        metric_value = float(persona.monto_mm or persona.monto_total_contratos / 1_000_000)
        monto_base = float(persona.monto_total_contratos)
    else:
        metric_value = 0.0
        monto_base = 0.0

    tier = _tier_for(metric_value, structure.get("tiers", []))
    notas: list[str] = []

    # --- Selección de % de comisión según estructura ---
    pct_comision = 0.0
    garantizado = 0.0
    bono = 0.0

    persistencia_minima = float(structure.get("persistencia_minima", 0.0))
    persistencia = float(persona.porcentaje_persistencia or 0.0)

    if tier is None:
        notas.append(f"No se encontró tier para métrica={metric} valor={metric_value}")
    else:
        bono = float(tier.get("bono", 0) or 0)
        garantizado = _resolve_garantizado(tier.get("garantizado"), smlmv)

        # Asesores Fonbienes / Asesores Serven / GE Fonbienes: % simple
        if "comision_pct" in tier:
            pct_comision = float(tier["comision_pct"])

        # GE 5G: % depende de categoría (oro/diamante) por persistencia
        if "comision_pct_oro" in tier or "comision_pct_diamante" in tier:
            cat_row = _factor_by_persistencia(persistencia, structure.get("variable_por_persistencia", []))
            if cat_row and cat_row.get("categoria") == "diamante":
                pct_comision = float(tier.get("comision_pct_diamante", 0))
                notas.append("GE Diamante")
            elif cat_row and cat_row.get("categoria") == "oro":
                pct_comision = float(tier.get("comision_pct_oro", 0))
                notas.append("GE Oro")
            # bono trimestral / bono persistencia
            if "bono_persistencia" in tier and persistencia >= 0.70:
                bono = max(bono, float(tier["bono_persistencia"]))

        # GE No 5G: 3 columnas de % por rango de persistencia
        if "comision_60_67_99_pct" in tier:
            if persistencia < 0.60:
                pct_comision = 0.0
            elif 0.60 <= persistencia < 0.68:
                pct_comision = float(tier["comision_60_67_99_pct"])
            elif 0.68 <= persistencia < 0.75:
                pct_comision = float(tier["comision_hasta_74_99_pct"])
            else:
                pct_comision = float(tier["comision_desde_75_pct"])
            if persona.is_canal_ac:
                ac = structure.get("canal_aliado_comercial_ac", {})
                pct_comision = float(
                    ac.get("comision_desde_75_pct", pct_comision)
                    if persistencia >= 0.75
                    else ac.get("comision_hasta_74_99_pct", pct_comision)
                )
                notas.append("Canal Aliado Comercial (AC)")

        # GP Auto: 3 columnas de % por rango de persistencia
        if "comision_66_99_pct" in tier:
            if persistencia < 0.60:
                pct_comision = 0.0
            elif 0.60 <= persistencia < 0.67:
                pct_comision = float(tier["comision_66_99_pct"])
            elif 0.67 <= persistencia < 0.80:
                pct_comision = float(tier["comision_79_99_pct"])
            else:
                pct_comision = float(tier["comision_80_mas_pct"])
            if persona.is_canal_ac:
                ac = structure.get("canal_aliado_comercial_ac", {})
                pct_comision = float(
                    ac.get("comision_desde_80_pct", pct_comision)
                    if persistencia >= 0.80
                    else ac.get("comision_hasta_79_99_pct", pct_comision)
                )
                notas.append("Canal Aliado Comercial (AC)")

        # GR Auto: 2 columnas por persistencia
        if "comision_hasta_66_99_pct" in tier:
            if persistencia < 0.60:
                pct_comision = 0.0
            elif persistencia < 0.67:
                pct_comision = float(tier["comision_hasta_66_99_pct"])
            else:
                pct_comision = float(tier["comision_desde_67_pct"])
            if persona.is_canal_ac:
                ac = structure.get("canal_aliado_comercial_ac", {})
                pct_comision = float(
                    ac.get("comision_desde_67_pct", pct_comision)
                    if persistencia >= 0.67
                    else ac.get("comision_hasta_66_99_pct", pct_comision)
                )
                notas.append("Canal Aliado Comercial (AC)")

    # --- Persistencia mínima (no aplica a asesores nuevos en sus primeros N meses) ---
    es_nuevo_exento = (
        persona.antiguedad == Antiguedad.NUEVO
        and structure.get("reglas_especiales", {}).get("asesor_nuevo_garantiza_smlmv") is not None
        and (
            persona.meses_antiguedad is None
            or persona.meses_antiguedad <= int(structure.get("reglas_especiales", {}).get("asesor_nuevo_meses", 3))
        )
    )
    # También Serven: como no tiene "meses_antiguedad" pero sí es Nuevo, lo tratamos similar
    if persona.antiguedad == Antiguedad.NUEVO and structure["id"] == "asesores_serven_auto":
        es_nuevo_exento = True

    if persistencia < persistencia_minima and pct_comision > 0 and not es_nuevo_exento:
        pct_comision = 0.0
        notas.append(
            f"Persistencia {persistencia:.2%} < mínima {persistencia_minima:.0%} — no cobra comisión"
        )

    # --- Cálculo comisión base ---
    valor_comision_base = monto_base * pct_comision

    # --- Factor variable por persistencia (Asesores Serven) ---
    factor_variable = 1.0
    var_table = structure.get("variable_por_persistencia")
    if var_table and structure["id"] == "asesores_serven_auto" and not es_nuevo_exento:
        row = _factor_by_persistencia(persistencia, var_table)
        if row and "factor" in row:
            factor_variable = float(row["factor"])
            notas.append(f"Variable Serven: {factor_variable:.0%}")

    # --- Ajuste por persistencia (GE Fonbienes) ---
    ajuste_row = _factor_by_persistencia(persistencia, structure.get("ajuste_por_persistencia", []))
    if ajuste_row and "factor" in ajuste_row:
        factor_variable *= float(ajuste_row["factor"])
        notas.append(f"Ajuste persistencia: {ajuste_row['factor']:.0%}")

    # --- Asesor nuevo: garantiza SMLMV ---
    if persona.antiguedad == Antiguedad.NUEVO and structure.get("reglas_especiales", {}).get(
        "asesor_nuevo_garantiza_smlmv"
    ):
        meses_nuevo = int(structure["reglas_especiales"].get("asesor_nuevo_meses", 3))
        if persona.meses_antiguedad is not None and persona.meses_antiguedad <= meses_nuevo:
            if valor_comision_base < smlmv:
                garantizado = max(garantizado, smlmv)
                notas.append(f"Asesor nuevo (mes ≤{meses_nuevo}): SMLMV garantizado")

    # --- Regla maestra Segundo Pago ---
    segundo_pago_pct = float(persona.porcentaje_segundo_pago or persistencia)
    factor_sp = rules_store.segundo_pago_factor(segundo_pago_pct)

    # Asesor nuevo: no se le aplica el descuento de segundo pago (paga 100%)
    if es_nuevo_exento:
        factor_sp = 1.0
        notas.append("Asesor nuevo: se paga 100% (no aplica factor Segundo Pago)")
    # Sin derecho a Segundo Pago en Serven: factor 0.90
    elif (
        structure["id"] == "asesores_serven_auto"
        and segundo_pago_pct == 0
        and "sin_segundo_pago_factor" in structure.get("reglas_especiales", {})
    ):
        factor_sp = float(structure["reglas_especiales"]["sin_segundo_pago_factor"])
        notas.append("Sin segundo pago: se paga 90%")

    valor_comision_final = valor_comision_base * factor_variable * factor_sp
    valor_bono_final = bono * factor_sp
    valor_salario = float(persona.sistema_valor_salario or 0.0)
    valor_total = valor_comision_final + valor_bono_final + garantizado

    # --- Comparación con sistema ---
    discrepancia = False
    sistema_monto = persona.sistema_monto_comision
    if sistema_monto is not None and abs(float(sistema_monto) - valor_comision_final) > 1.0:
        discrepancia = True
        notas.append(
            f"Sistema dice ${float(sistema_monto):,.0f} — calculado: ${valor_comision_final:,.0f}"
        )

    return ComputedCommission(
        cedula=persona.cedula,
        nombre=persona.nombre,
        company=persona.company,
        role=persona.role,
        structure_id=persona.structure_id,
        cantidad_contratos=persona.cantidad_contratos,
        porcentaje_persistencia=persistencia,
        porcentaje_segundo_pago=segundo_pago_pct,
        monto_base_comisionable=monto_base,
        porcentaje_comision=pct_comision,
        factor_variable_persistencia=factor_variable,
        factor_segundo_pago=factor_sp,
        valor_comision_base=round(valor_comision_base, 2),
        valor_comision_final=round(valor_comision_final, 2),
        valor_garantizado=round(garantizado, 2),
        valor_bono=round(bono, 2),
        valor_bono_final=round(valor_bono_final, 2),
        valor_salario=round(valor_salario, 2),
        valor_total_a_pagar=round(valor_total, 2),
        discrepancia=discrepancia,
        notas=notas,
    )
