from pydantic import BaseModel, EmailStr, field_validator
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    phone: str
    password: str
    full_name: str | None = None
    platform: str = "zomato"           # zomato | swiggy | other
    platform_driver_id: str | None = None
    h3_home_cell: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.fullmatch(r"\d{10}", v):
            raise ValueError("Phone must be 10 digits.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    email: str
    phone: str
    full_name: str | None
    platform: str
    h3_home_cell: str | None
    is_active: bool
    roles: list[str]

    model_config = {"from_attributes": True}
