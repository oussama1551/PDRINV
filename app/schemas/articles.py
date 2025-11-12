from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ArticleBase(BaseModel):
    numero_article: str
    description_article: Optional[str] = None
    catalogue_fournisseur: Optional[str] = None
    code_entrepot: Optional[str] = None
    code_emplacement: Optional[str] = None
    quantite_en_stock: Optional[float] = 0

class ArticleCreate(ArticleBase):
    pass

class ArticleUpdate(BaseModel):
    description_article: Optional[str] = None
    catalogue_fournisseur: Optional[str] = None
    code_entrepot: Optional[str] = None
    code_emplacement: Optional[str] = None
    quantite_en_stock: Optional[float] = None

class ArticleResponse(ArticleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True