"""Pydantic models (domain objects) used across the app."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Company(StrEnum):
    FONBIENES = "Fonbienes"
    SERVEN = "Serven"
    AUTO = "Auto"


class Role(StrEnum):
    ASESOR = "Asesor"
    GERENTE_EQUIPO = "Gerente Equipo"
    GERENTE_PRODUCTO = "Gerente Producto"
    GERENTE_REGIONAL = "Gerente Regional"


class Antiguedad(StrEnum):
    NUEVO = "Nuevo"
    ANTIGUO = "Antiguo"


class PersonaInput(BaseModel):
    """Datos de una persona extraídos de los Excel de entrada."""
    model_config = ConfigDict(extra="allow")

    cedula: str
    nombre: str
    codigo: str | int | None = None
    company: Company
    role: Role
    structure_id: str = Field(..., description="Id de la estructura comercial a aplicar")
    antiguedad: Antiguedad = Antiguedad.ANTIGUO
    meses_antiguedad: int | None = None

    cantidad_contratos: int = 0
    cantidad_contratos_solventes: int = 0
    monto_total_contratos: float = 0.0
    monto_mm: float = 0.0

    porcentaje_persistencia: float = 0.0
    porcentaje_segundo_pago: float = 0.0

    is_5g: bool = False
    is_canal_ac: bool = False

    # Valores que el sistema (Excel de origen) ya trae — los usamos para validar
    sistema_porcentaje_comision: float | str | None = None
    sistema_monto_comision: float | None = None
    sistema_valor_salario: float | None = None
    sistema_valor_garantizado: float | None = None
    sistema_valor_bonificacion: float | None = None


class ComputedCommission(BaseModel):
    """Resultado del cálculo de comisiones para una persona."""
    cedula: str
    nombre: str
    company: Company
    role: Role
    structure_id: str

    cantidad_contratos: int
    porcentaje_persistencia: float
    porcentaje_segundo_pago: float
    monto_base_comisionable: float

    porcentaje_comision: float
    factor_variable_persistencia: float
    factor_segundo_pago: float

    valor_comision_base: float = 0.0
    valor_comision_final: float = 0.0
    valor_garantizado: float = 0.0
    valor_bono: float = 0.0
    valor_bono_final: float = 0.0
    valor_salario: float = 0.0
    valor_total_a_pagar: float = 0.0

    # Comparación con sistema
    discrepancia: bool = False
    notas: list[str] = Field(default_factory=list)

    # Ajustes manuales
    ajuste_manual: float = 0.0
    motivo_ajuste: str | None = None


class CalculationRun(BaseModel):
    """Corrida de un mes: resultados de todos los cálculos."""
    id: str
    mes_cierre: int
    anio_cierre: int
    created_at: datetime
    created_by: str
    total_registros: int
    total_a_pagar: float
    resultados: list[ComputedCommission]
