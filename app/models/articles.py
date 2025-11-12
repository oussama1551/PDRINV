from sqlalchemy import Column, String, Text, Numeric
from .base import BaseModel

class Article(BaseModel):
    __tablename__ = "articles"
    
    numero_article = Column(String, unique=True, index=True)
    description_article = Column(Text)
    catalogue_fournisseur = Column(String)
    code_entrepot = Column(String)
    code_emplacement = Column(String)
    quantite_en_stock = Column(Numeric)
    
    # NO RELATIONSHIPS