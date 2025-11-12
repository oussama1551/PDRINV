from typing import Optional
from pydantic import BaseModel, validator
from .base import BaseSchema

class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: Optional[str] = 'compteur'
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str
    
    @validator('password')
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    
    @validator('password')
    def password_strength(cls, v):
        if v and len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

class UserResponse(UserBase, BaseSchema):
    id: int
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class ChangePassword(BaseModel):
    old_password: str
    new_password: str
    
    @validator('new_password')
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v