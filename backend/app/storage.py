"""Persistencia en memoria/disco de las corridas de cálculo. Simple para MVP."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.models import CalculationRun, ComputedCommission
from app.settings import settings

RUNS_DIR = settings.data_dir / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)


def _run_path(run_id: str) -> Path:
    return RUNS_DIR / f"{run_id}.json"


def list_runs() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in sorted(RUNS_DIR.glob("*.json"), reverse=True):
        try:
            with p.open(encoding="utf-8") as f:
                data = json.load(f)
            out.append({
                "id": data["id"],
                "mes_cierre": data["mes_cierre"],
                "anio_cierre": data["anio_cierre"],
                "created_at": data["created_at"],
                "created_by": data.get("created_by", ""),
                "total_registros": data["total_registros"],
                "total_a_pagar": data["total_a_pagar"],
            })
        except Exception:
            continue
    return out


def save_run(
    mes: int,
    anio: int,
    created_by: str,
    resultados: list[ComputedCommission],
) -> CalculationRun:
    run = CalculationRun(
        id=uuid4().hex,
        mes_cierre=mes,
        anio_cierre=anio,
        created_at=datetime.now(UTC),
        created_by=created_by,
        total_registros=len(resultados),
        total_a_pagar=sum(r.valor_total_a_pagar + r.ajuste_manual for r in resultados),
        resultados=resultados,
    )
    with _run_path(run.id).open("w", encoding="utf-8") as f:
        f.write(run.model_dump_json())
    return run


def load_run(run_id: str) -> CalculationRun | None:
    p = _run_path(run_id)
    if not p.exists():
        return None
    with p.open(encoding="utf-8") as f:
        return CalculationRun.model_validate_json(f.read())


def update_run(run: CalculationRun) -> None:
    with _run_path(run.id).open("w", encoding="utf-8") as f:
        f.write(run.model_dump_json())
