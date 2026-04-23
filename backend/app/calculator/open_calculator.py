"""Calculadora abierta: permite calcular una comisión individual con inputs manuales.

A diferencia del flujo mensual (que parte de 5 Excel), aquí el usuario escribe a mano
los datos de una persona y obtiene el desglose y el total a pagar. Sirve para
simulaciones, asesores nuevos o estructuras que aún no están en `rules.json`.

Dos modos:
  - "estructura": reutiliza el motor de `compute_commission` sobre una estructura de
    `rules.json` (aplica toda la lógica de persistencia, segundo pago, canal AC, etc.).
  - "manual": fórmula simple `monto * % + bono + salario`.
El usuario puede además forzar manualmente `bono` o `salario` en modo estructura.
"""
from __future__ import annotations

from app.calculator.engine import compute_commission
from app.models import (
    Antiguedad,
    Company,
    ComputedCommission,
    OpenCalculatorInput,
    PersonaInput,
    Role,
)
from app.rules_loader import rules_store

MANUAL_STRUCTURE_ID = "manual"


def _company_from_structure(structure_id: str) -> Company:
    s = rules_store.get_structure(structure_id)
    if s is None:
        return Company.AUTO
    c = s.get("company", "Auto")
    try:
        return Company(c)
    except ValueError:
        return Company.AUTO


def _role_from_structure(structure_id: str) -> Role:
    s = rules_store.get_structure(structure_id)
    if s is None:
        return Role.ASESOR
    r = s.get("role", "Asesor")
    try:
        return Role(r)
    except ValueError:
        return Role.ASESOR


def compute_open(inp: OpenCalculatorInput) -> ComputedCommission:
    """Calcula la comisión para una entrada abierta y devuelve el resultado."""
    notas: list[str] = []
    if inp.notas:
        notas.append(inp.notas.strip())

    bono_manual = float(inp.bono_manual or 0.0)
    salario_manual = float(inp.salario_manual or 0.0)

    # --- Modo manual ---
    if inp.structure_id == MANUAL_STRUCTURE_ID:
        pct = float(inp.porcentaje_comision_manual or 0.0)
        monto = float(inp.monto_total_ventas or 0.0)
        comision = monto * pct
        total = comision + bono_manual + salario_manual
        notas.insert(0, f"Cálculo manual: {inp.structure_name_manual or 'Estructura personalizada'}")
        notas.append(f"Fórmula: ${monto:,.0f} × {pct:.4%} + bono ${bono_manual:,.0f} + salario ${salario_manual:,.0f}")

        return ComputedCommission(
            cedula=inp.cedula,
            nombre=inp.nombre,
            company=Company.AUTO,
            role=Role.ASESOR,
            structure_id=MANUAL_STRUCTURE_ID,
            cantidad_contratos=int(inp.cantidad_contratos or 0),
            porcentaje_persistencia=float(inp.porcentaje_persistencia or 0.0),
            porcentaje_segundo_pago=float(inp.porcentaje_persistencia or 0.0) if inp.aplica_segundo_pago else 0.0,
            monto_base_comisionable=monto,
            porcentaje_comision=pct,
            factor_variable_persistencia=1.0,
            factor_segundo_pago=1.0 if inp.aplica_segundo_pago else 0.0,
            valor_comision_base=round(comision, 2),
            valor_comision_final=round(comision, 2),
            valor_garantizado=0.0,
            valor_bono=round(bono_manual, 2),
            valor_bono_final=round(bono_manual, 2),
            valor_salario=round(salario_manual, 2),
            valor_total_a_pagar=round(total, 2),
            discrepancia=False,
            notas=notas,
        )

    # --- Modo estructura: reutilizamos el motor oficial ---
    persona = PersonaInput(
        cedula=inp.cedula,
        nombre=inp.nombre,
        company=_company_from_structure(inp.structure_id),
        role=_role_from_structure(inp.structure_id),
        structure_id=inp.structure_id,
        antiguedad=inp.antiguedad or Antiguedad.ANTIGUO,
        meses_antiguedad=inp.meses_antiguedad,
        cantidad_contratos=int(inp.cantidad_contratos or 0),
        monto_total_contratos=float(inp.monto_total_ventas or 0.0),
        monto_mm=float(inp.monto_total_ventas or 0.0) / 1_000_000 if inp.monto_total_ventas else 0.0,
        porcentaje_persistencia=float(inp.porcentaje_persistencia or 0.0),
        porcentaje_segundo_pago=(
            float(inp.porcentaje_persistencia or 0.0) if inp.aplica_segundo_pago else 0.0
        ),
        is_5g=bool(inp.is_5g),
        is_canal_ac=bool(inp.is_canal_ac),
        sistema_valor_salario=salario_manual or None,
    )

    result = compute_commission(persona)

    # Override del % si el usuario lo forzó manualmente
    if inp.porcentaje_comision_manual is not None:
        pct_override = float(inp.porcentaje_comision_manual)
        comision_base = result.monto_base_comisionable * pct_override
        result.porcentaje_comision = pct_override
        result.valor_comision_base = round(comision_base, 2)
        result.valor_comision_final = round(
            comision_base * result.factor_variable_persistencia * result.factor_segundo_pago, 2
        )
        notas.append(f"% comisión forzado a {pct_override:.4%}")

    # Overrides manuales de bono y salario
    if bono_manual > 0:
        result.valor_bono = round(bono_manual, 2)
        result.valor_bono_final = round(bono_manual * result.factor_segundo_pago, 2)
        notas.append(f"Bono manual: ${bono_manual:,.0f}")
    if salario_manual > 0:
        result.valor_salario = round(salario_manual, 2)
        notas.append(f"Salario manual: ${salario_manual:,.0f}")

    # Si el usuario desactivó Segundo Pago, forzamos factor=1 y recalculamos
    if not inp.aplica_segundo_pago and result.factor_segundo_pago != 1.0:
        # recomputamos con factor_sp=1 preservando % aplicado
        valor_comision_final = (
            result.monto_base_comisionable
            * result.porcentaje_comision
            * result.factor_variable_persistencia
        )
        result.factor_segundo_pago = 1.0
        result.valor_comision_final = round(valor_comision_final, 2)
        result.valor_bono_final = round(result.valor_bono, 2)
        notas.append("Segundo Pago desactivado manualmente: factor = 100%")

    result.valor_total_a_pagar = round(
        result.valor_comision_final
        + result.valor_bono_final
        + result.valor_garantizado
        + result.valor_salario,
        2,
    )

    # Extendemos las notas del engine con las nuestras (manteniendo orden)
    result.notas = notas + result.notas
    return result
