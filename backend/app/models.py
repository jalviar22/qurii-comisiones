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


class OpenCalculatorInput(BaseModel):
    """Entrada de la calculadora abierta (simulación individual).

    Si `structure_id == "manual"` se usa el cálculo simple `monto × % + bono + salario`.
    En otro caso se reutiliza el motor de reglas sobre la estructura indicada y, opcionalmente,
    se forzan `porcentaje_comision_manual`, `bono_manual` y/o `salario_manual`.
    """
    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(..., min_length=1)
    cedula: str = Field(..., min_length=1)
    structure_id: str = Field(..., description="ID de estructura en rules.json, o 'manual'")
    structure_name_manual: str | None = Field(
        default=None, description="Nombre de la estructura cuando structure_id='manual'"
    )

    porcentaje_persistencia: float = Field(default=0.0, ge=0.0, le=1.0001)
    monto_total_ventas: float = Field(default=0.0, ge=0.0)
    cantidad_contratos: int = Field(default=0, ge=0)

    aplica_segundo_pago: bool = True
    is_canal_ac: bool = False
    is_5g: bool = False

    antiguedad: Antiguedad = Antiguedad.ANTIGUO
    meses_antiguedad: int | None = Field(default=None, ge=0)

    # Overrides manuales (opcionales)
    porcentaje_comision_manual: float | None = Field(default=None, ge=0.0, le=1.0)
    bono_manual: float | None = Field(default=None, ge=0.0)
    salario_manual: float | None = Field(default=None, ge=0.0)

    notas: str | None = None


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
