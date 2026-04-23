"""Carga y valida el archivo de reglas configurables (rules.json)."""
from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

RULES_PATH = Path(__file__).parent / "config" / "rules.json"
BACKUPS_DIR = Path(__file__).parent / "config" / "rules_backups"


class RulesStore:
    """Carga perezosa del archivo de reglas. Permite recargar en caliente."""

    def __init__(self, path: Path = RULES_PATH, backups_dir: Path = BACKUPS_DIR) -> None:
        self.path = path
        self.backups_dir = backups_dir
        self._data: dict[str, Any] | None = None

    def load(self) -> dict[str, Any]:
        with self.path.open(encoding="utf-8") as f:
            self._data = json.load(f)
        return self._data

    @property
    def data(self) -> dict[str, Any]:
        if self._data is None:
            return self.load()
        return self._data

    def reload(self) -> dict[str, Any]:
        return self.load()

    def _backup(self) -> str | None:
        if not self.path.exists():
            return None
        self.backups_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"rules_{ts}.json"
        shutil.copy2(self.path, self.backups_dir / backup_name)
        self._prune_backups()
        return backup_name

    def _prune_backups(self, keep: int = 20) -> None:
        """Mantiene solo los N backups más recientes."""
        if not self.backups_dir.exists():
            return
        files = sorted(
            self.backups_dir.glob("rules_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old in files[keep:]:
            old.unlink(missing_ok=True)

    def save(self, data: dict[str, Any]) -> str | None:
        """Guarda el rules.json creando primero un backup timestamped."""
        backup_name = self._backup()
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        self._data = data
        return backup_name

    def list_backups(self) -> list[dict[str, Any]]:
        if not self.backups_dir.exists():
            return []
        result: list[dict[str, Any]] = []
        for p in sorted(self.backups_dir.glob("rules_*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            stat = p.stat()
            result.append({
                "id": p.stem,
                "filename": p.name,
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size": stat.st_size,
            })
        return result

    def restore_backup(self, backup_id: str) -> dict[str, Any]:
        target = self.backups_dir / f"{backup_id}.json"
        if not target.exists():
            raise FileNotFoundError(f"Backup '{backup_id}' no encontrado")
        with target.open(encoding="utf-8") as f:
            data = json.load(f)
        # The restore itself creates a backup of current state
        self.save(data)
        return data

    def get_structure(self, structure_id: str) -> dict[str, Any] | None:
        for s in self.data.get("structures", []):
            if s["id"] == structure_id:
                return s
        return None

    def smlmv(self) -> float:
        return float(self.data.get("constantes", {}).get("SMLMV", 0))

    def segundo_pago_factor(self, persistencia_pct: float) -> float:
        for tier in self.data["segundo_pago"]["tiers"]:
            if tier["min_pct"] <= persistencia_pct < tier["max_pct"]:
                return float(tier["factor"])
        return 0.0


rules_store = RulesStore()
