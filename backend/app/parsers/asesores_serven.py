"""Parser del Excel 'Comisiones Asesores Serven'."""
from __future__ import annotations

from pathlib import Path

from app.models import Antiguedad, Company, PersonaInput, Role

from ._utils import find_sheet, read_sheet_as_dicts, safe_str, to_float, to_int


def parse_asesores_serven(path: str | Path) -> list[PersonaInput]:
    path = str(path)
    sheet = find_sheet(path, "resumen asesores serven")
    if not sheet:
        return []

    rows = read_sheet_as_dicts(path, sheet)
    out: list[PersonaInput] = []
    for r in rows:
        clase = safe_str(r.get("Clase")).lower()
        antiguedad = Antiguedad.NUEVO if "nuevo" in clase else Antiguedad.ANTIGUO

        cantidad = to_int(r.get("TotalCantidadContratosAuto")) + to_int(
            r.get("TotalCantidadContratosElectro")
        )
        monto = to_float(r.get("MontoTotalContratosAuto")) + to_float(
            r.get("MontoTotalContratosElectro")
        )
        # Serven usa persistencia Auto como referencia principal
        persistencia = to_float(r.get("PorcentajePersistenciaAuto")) or to_float(
            r.get("PorcentajePersistenciaElectro")
        )
        segundo = to_float(r.get("PorcentajeSegundoPagoAuto")) or to_float(
            r.get("PorcentajeSegundoPagoElectro")
        )

        out.append(
            PersonaInput(
                cedula=safe_str(r.get("CedulaAsesor")),
                nombre=safe_str(r.get("Asesor")),
                codigo=r.get("CodAsesor"),
                company=Company.SERVEN,
                role=Role.ASESOR,
                structure_id="asesores_serven_auto",
                antiguedad=antiguedad,
                cantidad_contratos=cantidad,
                monto_total_contratos=monto,
                porcentaje_persistencia=persistencia,
                porcentaje_segundo_pago=segundo,
                sistema_monto_comision=to_float(r.get("MontoTotalComision")),
                sistema_valor_salario=to_float(r.get("ValorSalario")),
                sistema_valor_bonificacion=to_float(r.get("ValorBonificacion")),
            )
        )
    return out
