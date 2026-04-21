"""Endpoints de cálculo de comisiones (upload, cálculo, descargas, ajustes)."""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.auth import User, get_current_user
from app.calculator.engine import compute_commission
from app.models import CalculationRun, ComputedCommission
from app.parsers import detect_and_parse
from app.reports.excel import build_consolidated_excel
from app.reports.pdf import build_individual_pdf
from app.storage import list_runs, load_run, save_run, update_run

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("")
def list_all_runs(_: User = Depends(get_current_user)) -> list[dict]:
    return list_runs()


@router.post("", response_model=CalculationRun)
async def create_run(
    mes: Annotated[int, Form(ge=1, le=12)],
    anio: Annotated[int, Form(ge=2020, le=2100)],
    files: Annotated[list[UploadFile], File(...)],
    user: User = Depends(get_current_user),
) -> CalculationRun:
    if not files:
        raise HTTPException(status_code=400, detail="No se recibió ningún archivo")

    resultados: list[ComputedCommission] = []
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for up in files:
            dest = tmp_path / up.filename
            with dest.open("wb") as f:
                f.write(await up.read())
            try:
                personas = detect_and_parse(dest)
                for p in personas:
                    resultados.append(compute_commission(p))
            except Exception as e:
                errors.append(f"{up.filename}: {e}")

    if not resultados:
        raise HTTPException(
            status_code=400,
            detail={"msg": "No se pudo procesar ningún archivo", "errors": errors},
        )

    run = save_run(mes=mes, anio=anio, created_by=user.email, resultados=resultados)
    return run


@router.get("/{run_id}", response_model=CalculationRun)
def get_run(run_id: str, _: User = Depends(get_current_user)) -> CalculationRun:
    run = load_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Corrida no encontrada")
    return run


@router.post("/{run_id}/adjust/{cedula}")
def adjust_commission(
    run_id: str,
    cedula: str,
    ajuste: Annotated[float, Form(...)],
    motivo: Annotated[str, Form(...)],
    _: User = Depends(get_current_user),
) -> ComputedCommission:
    run = load_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Corrida no encontrada")
    for r in run.resultados:
        if r.cedula == cedula:
            r.ajuste_manual = ajuste
            r.motivo_ajuste = motivo
            # Recalculamos total con ajuste
            r.valor_total_a_pagar = round(
                r.valor_comision_final + r.valor_bono_final + r.valor_garantizado + ajuste, 2
            )
            update_run(run)
            return r
    raise HTTPException(status_code=404, detail=f"No se encontró persona con cédula {cedula}")


@router.get("/{run_id}/excel")
def download_excel(run_id: str, _: User = Depends(get_current_user)) -> Response:
    run = load_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Corrida no encontrada")
    content = build_consolidated_excel(run.resultados)
    filename = f"consolidado_{run.anio_cierre}_{run.mes_cierre:02d}.xlsx"
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{run_id}/pdf/{cedula}")
def download_person_pdf(run_id: str, cedula: str, _: User = Depends(get_current_user)) -> Response:
    run = load_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Corrida no encontrada")
    for r in run.resultados:
        if r.cedula == cedula:
            content = build_individual_pdf(r)
            filename = f"comision_{cedula}_{run.anio_cierre}_{run.mes_cierre:02d}.pdf"
            return Response(
                content,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
    raise HTTPException(status_code=404, detail=f"No se encontró persona con cédula {cedula}")
