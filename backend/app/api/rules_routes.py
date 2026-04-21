"""Endpoints de lectura/escritura del archivo de reglas (rules.json)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.auth import User, get_current_user
from app.rules_loader import rules_store

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("")
def get_rules(_: User = Depends(get_current_user)) -> dict[str, Any]:
    return rules_store.data


@router.put("")
def replace_rules(
    payload: dict[str, Any],
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar reglas")
    if "structures" not in payload or "segundo_pago" not in payload:
        raise HTTPException(status_code=400, detail="Payload inválido")
    rules_store.save(payload)
    return rules_store.data


@router.post("/reload")
def reload_rules(_: User = Depends(get_current_user)) -> dict[str, Any]:
    return rules_store.reload()
