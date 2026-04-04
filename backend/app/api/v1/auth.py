from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.dependencies import DbDep, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.init_db import init_db
from app.models.user import Role, User, UserRole
from app.schemas.auth import RegisterRequest, RefreshRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbDep):
    """Register a new gig worker driver account."""
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered.")
    if db.query(User).filter_by(phone=payload.phone).first():
        raise HTTPException(status_code=409, detail="Phone already registered.")

    driver_role = db.query(Role).filter_by(name="driver").first()
    if not driver_role:
        raise HTTPException(status_code=500, detail="Roles not seeded. Run init_db first.")

    user = User(
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        platform=payload.platform,
        platform_driver_id=payload.platform_driver_id,
        h3_home_cell=payload.h3_home_cell,
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role_id=driver_role.id))
    db.commit()
    db.refresh(user)

    return _user_out(user)


@router.post("/login", response_model=TokenResponse)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbDep):
    """Login with email (username field) + password. Returns JWT pair."""
    user = db.query(User).filter_by(email=form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    roles = [r.name for r in user.roles]
    return TokenResponse(
        access_token=create_access_token(str(user.id), roles),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: DbDep):
    """Exchange a valid refresh token for a new token pair."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise credentials_exc
        user_id = int(data["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exc

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exc

    roles = [r.name for r in user.roles]
    return TokenResponse(
        access_token=create_access_token(str(user.id), roles),
        refresh_token=create_refresh_token(str(user.id)),
    )


# ---------- helpers ----------

def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        platform=user.platform,
        h3_home_cell=user.h3_home_cell,
        is_active=user.is_active,
        roles=[r.name for r in user.roles],
    )
