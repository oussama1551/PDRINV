from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, validator
from .base import BaseSchema

class InventorySessionBase(BaseModel):
    nom_session: str
    depot: str
    notes: Optional[str] = None
    status: Optional[str] = 'open'

class InventorySessionCreate(InventorySessionBase):
    created_by_user_id: int

class InventorySessionUpdate(BaseModel):
    nom_session: Optional[str] = None
    depot: Optional[str] = None
    status: Optional[str] = None
    finished_at: Optional[datetime] = None
    notes: Optional[str] = None

class InventorySessionResponse(InventorySessionBase, BaseSchema):
    id: int
    started_at: datetime
    finished_at: Optional[datetime]
    created_by_user_id: int

class InventoryCountBase(BaseModel):
    session_id: int
    article_id: int
    round: int
    quantity_counted: float
    counted_by_user_id: int
    is_new: Optional[bool] = False
    notes: Optional[str] = None

    @validator('round')
    def round_must_be_positive(cls, v):
        if v < 1:
            raise ValueError('Round must be at least 1')
        return v

    @validator('quantity_counted')
    def quantity_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('Quantity must be positive')
        return v

class InventoryCountCreate(InventoryCountBase):
    pass

class InventoryCountResponse(InventoryCountBase, BaseSchema):
    id: int
    counted_at: datetime

class InventoryCountWithArticle(InventoryCountResponse):
    article_numero: Optional[str] = None
    article_description: Optional[str] = None
    article_location: Optional[str] = None

class SessionWithCounts(InventorySessionResponse):
    counts: List[InventoryCountWithArticle] = []
    total_counts: int = 0
    unique_articles: int = 0

class CountingHistoryBase(BaseModel):
    session_id: int
    article_id: int
    round: int
    quantity_counted: float
    counted_by_user_id: int
    action: str
    previous_quantity: Optional[float] = None
    count_id: Optional[int] = None
    correction_reason: Optional[str] = None
    notes: Optional[str] = None

class CountingHistoryCreate(CountingHistoryBase):
    pass

class CountingHistoryResponse(CountingHistoryBase, BaseSchema):
    counted_at: datetime

class CountingHistoryWithDetails(CountingHistoryResponse):
    article_numero: Optional[str] = None
    article_description: Optional[str] = None
    user_username: Optional[str] = None
    user_full_name: Optional[str] = None
    session_name: Optional[str] = None