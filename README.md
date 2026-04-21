# Qurii Comisiones

Aplicativo web para calcular, validar y consolidar comisiones de la estructura comercial (Asesores CP Fonbienes, Asesores CP Serven, Gerentes de Equipo, Gerentes de Producto y Gerentes Regionales).

## ¿Qué hace?

1. Recibe los 5 archivos Excel que genera el sistema cada mes.
2. Aplica las tablas de reglas de comisión configurables por rol.
3. Aplica la regla maestra de **Segundo Pago** (persistencia ≥85% = 100%, 75%-84,99% = 75%, <75% = 0%).
4. Permite revisar persona por persona y hacer **ajustes manuales**.
5. Genera un **Excel consolidado** de nómina y un **PDF individual** por persona.

## Estructura

```
qurii-comisiones/
├── backend/        # FastAPI + motor de reglas + parsers Excel
│   ├── app/
│   │   ├── config/rules.json       # Reglas editables
│   │   ├── parsers/                # Parser por tipo de Excel
│   │   ├── calculator/             # Motor de comisiones
│   │   ├── reports/                # Generadores Excel/PDF
│   │   └── api/                    # Endpoints REST
│   └── tests/
└── frontend/       # React + Vite
    └── src/
```

## Desarrollo local

### Backend

```bash
cd backend
uv sync            # o: python -m venv .venv && source .venv/bin/activate && pip install -e .
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Usuarios

Los 3 usuarios iniciales se crean con `python -m app.scripts.seed_users`:

- Juan Pablo Alviar
- Yenny Suarez
- Martha Ramos

Cada uno con una contraseña inicial que se debe cambiar al primer login.

## Reglas configurables

Las tablas de comisión viven en `backend/app/config/rules.json`. Se pueden agregar, editar o quitar estructuras comerciales sin tocar código (también hay una UI de administración en `/admin/rules`).
