"""Tests de la calculadora abierta (simulación individual)."""
from __future__ import annotations

from app.calculator.open_calculator import compute_open
from app.models import Antiguedad, OpenCalculatorInput
from app.rules_loader import rules_store


def test_modo_manual_formula_simple():
    rules_store.reload()
    inp = OpenCalculatorInput(
        nombre="Juan Prueba",
        cedula="12345",
        structure_id="manual",
        structure_name_manual="Estructura ad hoc",
        monto_total_ventas=100_000_000,
        cantidad_contratos=3,
        porcentaje_persistencia=0.80,
        porcentaje_comision_manual=0.02,
        bono_manual=500_000,
        salario_manual=1_000_000,
        aplica_segundo_pago=True,
    )
    r = compute_open(inp)
    # 100M * 2% = 2,000,000 + 500,000 bono + 1,000,000 salario = 3,500,000
    assert r.valor_comision_final == 2_000_000
    assert r.valor_bono_final == 500_000
    assert r.valor_salario == 1_000_000
    assert r.valor_total_a_pagar == 3_500_000
    assert r.structure_id == "manual"


def test_modo_estructura_reutiliza_engine():
    """Con structure_id real, la calculadora debe aplicar las reglas del motor."""
    rules_store.reload()
    inp = OpenCalculatorInput(
        nombre="Asesor Fonbienes",
        cedula="999",
        structure_id="asesores_fonbienes_moto",
        cantidad_contratos=11,
        monto_total_ventas=156_000_000,
        porcentaje_persistencia=0.90,
        aplica_segundo_pago=True,
    )
    r = compute_open(inp)
    # 11 contratos => 1.3%, persistencia 90% => factor SP 100%
    assert abs(r.porcentaje_comision - 0.013) < 1e-6
    assert r.factor_segundo_pago == 1.0
    assert abs(r.valor_comision_final - 2_028_000) < 1.0


def test_desactivar_segundo_pago_fuerza_factor_100():
    rules_store.reload()
    inp = OpenCalculatorInput(
        nombre="X",
        cedula="1",
        structure_id="asesores_fonbienes_moto",
        cantidad_contratos=11,
        monto_total_ventas=100_000_000,
        porcentaje_persistencia=0.50,  # normalmente bajaría a 0%
        aplica_segundo_pago=False,
    )
    r = compute_open(inp)
    # Con SP desactivado, factor = 1, pero la persistencia mínima de la estructura
    # igual bloquea la comisión (persistencia 50% < mínima 65%).
    assert r.factor_segundo_pago == 1.0
    assert r.valor_comision_final == 0.0  # persistencia < mínima de la estructura


def test_override_porcentaje_manual():
    rules_store.reload()
    inp = OpenCalculatorInput(
        nombre="X",
        cedula="1",
        structure_id="asesores_fonbienes_moto",
        cantidad_contratos=11,
        monto_total_ventas=100_000_000,
        porcentaje_persistencia=0.90,
        porcentaje_comision_manual=0.05,  # forzamos 5% sobre la tabla
        aplica_segundo_pago=True,
    )
    r = compute_open(inp)
    assert abs(r.porcentaje_comision - 0.05) < 1e-6
    # 100M * 5% * 1.0 (factor SP) * 1.0 (factor variable) = 5,000,000
    assert abs(r.valor_comision_final - 5_000_000) < 1.0


def test_bono_y_salario_manuales_se_suman():
    rules_store.reload()
    inp = OpenCalculatorInput(
        nombre="X",
        cedula="1",
        structure_id="asesores_fonbienes_moto",
        cantidad_contratos=11,
        monto_total_ventas=100_000_000,
        porcentaje_persistencia=0.90,
        bono_manual=300_000,
        salario_manual=1_500_000,
        aplica_segundo_pago=True,
    )
    r = compute_open(inp)
    # comision final = 1.3% * 100M = 1,300,000
    # total = 1,300,000 + 300,000 + 1,500,000 = 3,100,000
    assert r.valor_bono_final == 300_000
    assert r.valor_salario == 1_500_000
    assert abs(r.valor_total_a_pagar - 3_100_000) < 1.0


def test_asesor_nuevo_aplica_smlmv_garantizado():
    rules_store.reload()
    inp = OpenCalculatorInput(
        nombre="Nuevo",
        cedula="2",
        structure_id="asesores_fonbienes_moto",
        cantidad_contratos=2,
        monto_total_ventas=10_000_000,
        porcentaje_persistencia=0.0,
        antiguedad=Antiguedad.NUEVO,
        meses_antiguedad=2,
        aplica_segundo_pago=True,
    )
    r = compute_open(inp)
    assert r.valor_garantizado >= rules_store.smlmv()
