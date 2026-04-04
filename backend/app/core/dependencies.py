from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import SessionLocal

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# --------------------------------------------------------------------------- #
# Database                                                                     #
# --------------------------------------------------------------------------- #

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbDep = Annotated[Session, Depends(get_db)]


# --------------------------------------------------------------------------- #
# Current User                                                                 #
# --------------------------------------------------------------------------- #

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DbDep,
):
    """Decode JWT and return the User ORM object. Raises 401 on failure."""
    from app.models.user import User  # deferred to avoid circular import

    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise credentials_exc
    return user


CurrentUser = Annotated[object, Depends(get_current_user)]
