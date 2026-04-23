"""Punto de entrada de FastAPI."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_routes import router as auth_router
from app.api.calculator_routes import router as calculator_router
from app.api.rules_routes import router as rules_router
from app.api.runs_routes import router as runs_router
from app.settings import settings

app = FastAPI(
    title="Qurii Comisiones API",
    description="API para calcular, consolidar y reportar comisiones mensuales.",
    version="0.1.0",
)

origins = [o.strip() for o in settings.allowed_origins.split(",")] if settings.allowed_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(runs_router)
app.include_router(rules_router)
app.include_router(calculator_router)


@app.get("/")
def root() -> dict:
    return {"name": "Qurii Comisiones API", "version": "0.1.0", "docs": "/docs"}


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}
