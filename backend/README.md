# Qurii Comisiones Backend

FastAPI backend para el aplicativo de comisiones.

## Desarrollo

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload --port 8000
```

API docs interactivos: http://localhost:8000/docs

## Tests

```bash
pytest -q
```

## Lint

```bash
ruff check app/
```

## Estructura del código

- `app/config/rules.json` — reglas de comisiones (editables)
- `app/rules_loader.py` — carga del archivo de reglas
- `app/models.py` — modelos de dominio (Pydantic)
- `app/parsers/` — parsers de los 5 Excel de entrada
- `app/calculator/engine.py` — motor que aplica las reglas
- `app/reports/excel.py` — genera el Excel consolidado
- `app/reports/pdf.py` — genera el PDF individual
- `app/api/` — rutas FastAPI (auth, runs, rules)
- `app/auth.py` — autenticación JWT simple con 3 usuarios
- `app/storage.py` — persistencia JSON de las corridas

## Variables de entorno

- `SECRET_KEY` — clave para firmar JWT (obligatorio en producción)
- `ALLOWED_ORIGINS` — orígenes permitidos por CORS
