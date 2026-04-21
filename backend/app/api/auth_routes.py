"""Endpoints de autenticación."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.auth import User, authenticate, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class TokenResp(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


@router.post("/login", response_model=TokenResp)
def login(form: OAuth2PasswordRequestForm = Depends()) -> TokenResp:
    user = authenticate(form.username, form.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    token = create_access_token(user.email)
    return TokenResp(access_token=token, user=user)


@router.get("/me", response_model=User)
def me(user: User = Depends(get_current_user)) -> User:
    return user
