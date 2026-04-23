"""Plantillas de estructuras comerciales para crear nuevas estructuras desde cero."""
from __future__ import annotations

from typing import Any


def template_asesor_simple() -> dict[str, Any]:
    """Asesor tipo Fonbienes: tabla por cantidad de contratos, % de comisión simple, bono opcional."""
    return {
        "id": "nueva_estructura",
        "name": "Nueva Estructura Asesor",
        "company": "Auto",
        "role": "Asesor",
        "description": "Asesor con tabla por cantidad de contratos.",
        "metric": "cantidad_contratos",
        "persistencia_minima": 0.65,
        "aplica_segundo_pago": True,
        "tiers": [
            {"min": 0, "max": 5, "comision_pct": 0.0, "bono": 0},
            {"min": 6, "max": 10, "comision_pct": 0.01, "bono": 200000},
            {"min": 11, "max": None, "comision_pct": 0.015, "bono": 450000},
        ],
    }


def template_gerente_por_monto() -> dict[str, Any]:
    """Gerente con tabla por monto en millones de pesos."""
    return {
        "id": "nueva_estructura",
        "name": "Nueva Estructura Gerente",
        "company": "Auto",
        "role": "Gerente Equipo",
        "description": "Gerente con tabla por monto en millones.",
        "metric": "monto_mm",
        "persistencia_minima": 0.60,
        "aplica_segundo_pago": True,
        "tiers": [
            {"min": 0, "max": 799, "comision_pct": 0.0, "bono": 0},
            {"min": 800, "max": 1699, "comision_pct": 0.001, "bono": 400000},
            {"min": 1700, "max": None, "comision_pct": 0.002, "bono": 1000000},
        ],
    }


def template_blank() -> dict[str, Any]:
    """Estructura mínima con un tier en cero — ideal para configurar desde cero."""
    return {
        "id": "nueva_estructura",
        "name": "Nueva Estructura",
        "company": "",
        "role": "",
        "description": "",
        "metric": "cantidad_contratos",
        "persistencia_minima": 0.0,
        "aplica_segundo_pago": True,
        "tiers": [
            {"min": 0, "max": None, "comision_pct": 0.0, "bono": 0},
        ],
    }


TEMPLATES: dict[str, dict[str, Any]] = {
    "asesor_simple": {
        "label": "Asesor simple",
        "description": "Tabla por cantidad de contratos con % de comisión y bono.",
        "data": template_asesor_simple(),
    },
    "gerente_por_monto": {
        "label": "Gerente por monto",
        "description": "Tabla por monto en millones con % y bono por tramo.",
        "data": template_gerente_por_monto(),
    },
    "blank": {
        "label": "En blanco",
        "description": "Mínimos campos para configurar desde cero.",
        "data": template_blank(),
    },
}


def list_templates() -> list[dict[str, Any]]:
    return [{"key": k, "label": v["label"], "description": v["description"]} for k, v in TEMPLATES.items()]


def get_template(key: str) -> dict[str, Any] | None:
    tpl = TEMPLATES.get(key)
    return tpl["data"] if tpl else None
