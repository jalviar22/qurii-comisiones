"""Autenticación simple con JWT y 3 usuarios hardcodeados (seedable)."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.settings import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Contraseña inicial compartida — el primer login debería forzar cambio (no implementado en MVP)
DEFAULT_PASSWORD = "qurii2025"

USERS: dict[str, dict] = {
    "juanpabloalviar@gmail.com": {
        "email": "juanpabloalviar@gmail.com",
        "full_name": "Juan Pablo Alviar",
        "hashed_password": pwd_context.hash(DEFAULT_PASSWORD),
        "role": "admin",
    },
    "yenny.suarez@qurii.co": {
        "email": "yenny.suarez@qurii.co",
        "full_name": "Yenny Suarez",
        "hashed_password": pwd_context.hash(DEFAULT_PASSWORD),
        "role": "user",
    },
    "martha.ramos@qurii.co": {
        "email": "martha.ramos@qurii.co",
        "full_name": "Martha Ramos",
        "hashed_password": pwd_context.hash(DEFAULT_PASSWORD),
        "role": "user",
    },
}


class TokenData(BaseModel):
    sub: str


class User(BaseModel):
    email: str
    full_name: str
    role: str


def authenticate(email: str, password: str) -> User | None:
    u = USERS.get(email.lower())
    if u is None:
        return None
    if not pwd_context.verify(password, u["hashed_password"]):
        return None
    return User(email=u["email"], full_name=u["full_name"], role=u["role"])


def create_access_token(sub: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": sub, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    creds_err = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        sub = payload.get("sub")
        if sub is None:
            raise creds_err
    except JWTError as e:
        raise creds_err from e
    u = USERS.get(sub)
    if u is None:
        raise creds_err
    return User(email=u["email"], full_name=u["full_name"], role=u["role"])
