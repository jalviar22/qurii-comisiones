"""Endpoints de lectura/escritura del archivo de reglas (rules.json)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.auth import User, get_current_user
from app.rules_loader import rules_store
from app.rules_templates import get_template, list_templates

router = APIRouter(prefix="/api/rules", tags=["rules"])


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar reglas")


def _validate_rules(payload: dict[str, Any]) -> None:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido: debe ser un objeto JSON.")
    if "structures" not in payload or not isinstance(payload["structures"], list):
        raise HTTPException(status_code=400, detail="Falta el campo 'structures' o no es lista.")
    if "segundo_pago" not in payload or "tiers" not in payload.get("segundo_pago", {}):
        raise HTTPException(status_code=400, detail="Falta 'segundo_pago.tiers'.")
    ids: set[str] = set()
    for i, s in enumerate(payload["structures"]):
        if not isinstance(s, dict):
            raise HTTPException(status_code=400, detail=f"Estructura #{i+1} inválida.")
        sid = s.get("id")
        if not sid or not isinstance(sid, str):
            raise HTTPException(status_code=400, detail=f"Estructura #{i+1} sin 'id'.")
        if sid in ids:
            raise HTTPException(status_code=400, detail=f"ID duplicado: '{sid}'.")
        ids.add(sid)
        if "tiers" not in s or not isinstance(s["tiers"], list) or not s["tiers"]:
            raise HTTPException(status_code=400, detail=f"Estructura '{sid}' requiere al menos un tier.")


@router.get("")
def get_rules(_: User = Depends(get_current_user)) -> dict[str, Any]:
    return rules_store.data


@router.put("")
def replace_rules(
    payload: dict[str, Any],
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _require_admin(user)
    _validate_rules(payload)
    backup_id = rules_store.save(payload)
    result = dict(rules_store.data)
    result["_backup_id"] = backup_id
    return result


@router.post("/reload")
def reload_rules(_: User = Depends(get_current_user)) -> dict[str, Any]:
    return rules_store.reload()


@router.get("/templates")
def get_templates(_: User = Depends(get_current_user)) -> list[dict[str, Any]]:
    return list_templates()


@router.get("/templates/{key}")
def get_template_data(key: str, _: User = Depends(get_current_user)) -> dict[str, Any]:
    tpl = get_template(key)
    if tpl is None:
        raise HTTPException(status_code=404, detail=f"Plantilla '{key}' no existe.")
    return tpl


@router.get("/backups")
def list_backups(user: User = Depends(get_current_user)) -> list[dict[str, Any]]:
    _require_admin(user)
    return rules_store.list_backups()


@router.post("/backups/{backup_id}/restore")
def restore_backup(backup_id: str, user: User = Depends(get_current_user)) -> dict[str, Any]:
    _require_admin(user)
    try:
        return rules_store.restore_backup(backup_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
