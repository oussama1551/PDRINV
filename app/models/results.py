from sqlalchemy import Column, Numeric, Boolean, ForeignKey, Integer, String, Text
from .base import BaseModel

class InventoryResult(BaseModel):
    __tablename__ = "inventory_results"
    
    session_id = Column(Integer, ForeignKey('inventory_sessions.id', ondelete='CASCADE'), nullable=False)
    article_id = Column(Integer, ForeignKey('articles.id', ondelete='SET NULL'))
    quantite_initiale = Column(Numeric)  # From SAP
    quantite_finale = Column(Numeric)    # Final counted
    ecart_final = Column(Numeric)        # Difference = finale - initiale
    ajuste = Column(Boolean, default=False)  # Adjusted in SAP
    
    # NO relationships for now to avoid circular imports

class ArticleAddLog(BaseModel):
    __tablename__ = "article_add_log"
    
    session_id = Column(Integer, ForeignKey('inventory_sessions.id'))
    numero_article = Column(String(128))
    description_article = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey('app_users.id'))
    
    # NO relationships for now to avoid circular imports