"""Tests unitarios del motor de cálculo."""
from __future__ import annotations

from app.calculator.engine import compute_commission
from app.models import Antiguedad, Company, PersonaInput, Role
from app.rules_loader import rules_store


def make_asesor_fonbienes(**overrides) -> PersonaInput:
    kwargs = dict(
        cedula="1",
        nombre="Test",
        company=Company.FONBIENES,
        role=Role.ASESOR,
        structure_id="asesores_fonbienes_moto",
        antiguedad=Antiguedad.ANTIGUO,
        cantidad_contratos=11,
        monto_total_contratos=156_000_000,
        porcentaje_persistencia=0.78,
        porcentaje_segundo_pago=1.0,
    )
    kwargs.update(overrides)
    return PersonaInput(**kwargs)


def test_segundo_pago_factor_tiers():
    rules_store.reload()
    assert rules_store.segundo_pago_factor(0.90) == 1.0
    assert rules_store.segundo_pago_factor(0.80) == 0.75
    assert rules_store.segundo_pago_factor(0.60) == 0.0
    assert rules_store.segundo_pago_factor(0.85) == 1.0  # exactamente 85%
    assert rules_store.segundo_pago_factor(0.7499) == 0.0


def test_asesor_fonbienes_tier_11_contratos_paga_13pct():
    rules_store.reload()
    p = make_asesor_fonbienes(cantidad_contratos=11, monto_total_contratos=156_000_000)
    r = compute_commission(p)
    # 11 contratos está en el rango 9-16 (1.3%)
    assert abs(r.porcentaje_comision - 0.013) < 1e-6
    # 0.013 * 156M * factor segundo pago (1.0) = 2,028,000
    assert abs(r.valor_comision_final - 2_028_000) < 1.0


def test_asesor_fonbienes_tier_17_contratos_paga_14pct():
    rules_store.reload()
    p = make_asesor_fonbienes(cantidad_contratos=17, monto_total_contratos=200_000_000,
                              porcentaje_persistencia=0.78, porcentaje_segundo_pago=1.0)
    r = compute_commission(p)
    assert abs(r.porcentaje_comision - 0.014) < 1e-6


def test_bajo_persistencia_no_paga_comision():
    rules_store.reload()
    p = make_asesor_fonbienes(cantidad_contratos=11, porcentaje_persistencia=0.50,
                              porcentaje_segundo_pago=0.0)
    r = compute_commission(p)
    assert r.valor_comision_final == 0.0


def test_segundo_pago_75pct_paga_75():
    rules_store.reload()
    p = make_asesor_fonbienes(cantidad_contratos=11, monto_total_contratos=100_000_000,
                              porcentaje_persistencia=0.80, porcentaje_segundo_pago=0.80)
    r = compute_commission(p)
    assert abs(r.factor_segundo_pago - 0.75) < 1e-6
    # 100M * 1.3% * 0.75 = 975000
    assert abs(r.valor_comision_final - 975_000) < 1.0


def test_asesor_nuevo_garantiza_smlmv_y_100pct():
    rules_store.reload()
    p = make_asesor_fonbienes(
        antiguedad=Antiguedad.NUEVO, meses_antiguedad=2,
        cantidad_contratos=3, monto_total_contratos=20_000_000,
        porcentaje_persistencia=0.0, porcentaje_segundo_pago=0.0,
    )
    r = compute_commission(p)
    assert r.factor_segundo_pago == 1.0
    assert r.valor_garantizado >= rules_store.smlmv()


def test_structure_not_found_produces_discrepancy():
    p = PersonaInput(
        cedula="9", nombre="Desconocido",
        company=Company.AUTO, role=Role.ASESOR, structure_id="inexistente",
    )
    r = compute_commission(p)
    assert r.discrepancia is True
