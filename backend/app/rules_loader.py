"""Carga y valida el archivo de reglas configurables (rules.json)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

RULES_PATH = Path(__file__).parent / "config" / "rules.json"


class RulesStore:
    """Carga perezosa del archivo de reglas. Permite recargar en caliente."""

    def __init__(self, path: Path = RULES_PATH) -> None:
        self.path = path
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

    def save(self, data: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        self._data = data

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
