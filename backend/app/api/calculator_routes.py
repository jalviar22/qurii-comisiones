"""Endpoints de la calculadora abierta (simulación individual de comisión)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.auth import User, get_current_user
from app.calculator.open_calculator import compute_open
from app.models import ComputedCommission, OpenCalculatorInput
from app.reports.excel import build_consolidated_excel
from app.reports.pdf import build_individual_pdf

router = APIRouter(prefix="/api/calculator", tags=["calculator"])


@router.post("/open", response_model=ComputedCommission)
def calc_open(
    payload: OpenCalculatorInput,
    _: User = Depends(get_current_user),
) -> ComputedCommission:
    """Calcula la comisión de una persona a partir de inputs manuales."""
    return compute_open(payload)


@router.post("/open/excel")
def calc_open_excel(
    payload: OpenCalculatorInput,
    _: User = Depends(get_current_user),
) -> Response:
    """Devuelve el resultado de la calculadora abierta como Excel (mismo formato
    que el consolidado mensual, pero con una sola persona)."""
    result = compute_open(payload)
    content = build_consolidated_excel([result])
    safe_cedula = "".join(ch for ch in result.cedula if ch.isalnum()) or "sim"
    filename = f"calculadora_{safe_cedula}.xlsx"
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/open/pdf")
def calc_open_pdf(
    payload: OpenCalculatorInput,
    _: User = Depends(get_current_user),
) -> Response:
    """Devuelve el resultado de la calculadora abierta como PDF individual."""
    result = compute_open(payload)
    content = build_individual_pdf(result)
    safe_cedula = "".join(ch for ch in result.cedula if ch.isalnum()) or "sim"
    filename = f"calculadora_{safe_cedula}.pdf"
    return Response(
        content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
