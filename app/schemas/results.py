from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from .base import BaseSchema

class InventoryResultBase(BaseModel):
    session_id: int
    article_id: int
    quantite_initiale: Optional[float] = None
    quantite_finale: Optional[float] = None
    ecart_final: Optional[float] = None
    ajuste: Optional[bool] = False

class InventoryResultCreate(InventoryResultBase):
    pass

class InventoryResultUpdate(BaseModel):
    quantite_finale: Optional[float] = None
    ecart_final: Optional[float] = None
    ajuste: Optional[bool] = None

class InventoryResultResponse(InventoryResultBase, BaseSchema):
    id: int

class InventoryResultWithArticle(InventoryResultResponse):
    article_numero: Optional[str] = None
    article_description: Optional[str] = None
    article_location: Optional[str] = None
    sap_stock: Optional[float] = None

class ArticleAddLogBase(BaseModel):
    session_id: int
    numero_article: str
    description_article: str
    created_by_user_id: int

class ArticleAddLogCreate(ArticleAddLogBase):
    pass

class ArticleAddLogResponse(ArticleAddLogBase, BaseSchema):
    id: int
    created_at: datetime

class VarianceSummary(BaseModel):
    total_articles: int
    articles_with_variance: int
    total_variance_value: float
    average_variance: float
    major_variances: List[InventoryResultWithArticle] = []

class SessionResultsSummary(BaseModel):
    session_id: int
    session_name: str
    total_articles_counted: int
    articles_with_variance: int
    total_positive_variance: float  # More than expected
    total_negative_variance: float  # Less than expected
    adjustment_rate: float  # Percentage adjusted in SAP
    new_articles_found: int