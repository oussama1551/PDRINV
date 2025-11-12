from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Generic, TypeVar

T = TypeVar('T')

class BaseSchema(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BaseCreateSchema(BaseModel):
    class Config:
        from_attributes = True

class BaseUpdateSchema(BaseModel):
    class Config:
        from_attributes = True

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int