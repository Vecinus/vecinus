from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    password_confirm: str
    username: str
    avatar_url: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8 or len(v) > 16:
            raise ValueError("La contraseña debe tener entre 8 y 16 caracteres")
        return v

    @field_validator("password_confirm")
    @classmethod
    def validate_password_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Las contraseñas no coinciden")
        return v

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, v):
        if v is None:
            return None

        normalized = v.strip()
        if not normalized:
            return None

        if not (normalized.startswith("http://") or normalized.startswith("https://")):
            raise ValueError("La URL de la imagen debe comenzar por http:// o https://")

        return normalized
