from sqlalchemy import Column, String, Text, ForeignKey, TIMESTAMP, Boolean, Integer, Numeric
from sqlalchemy.dialects.postgresql import SMALLINT
from sqlalchemy.sql import func
from .base import BaseModel

class InventorySession(BaseModel):
    __tablename__ = "inventory_sessions"
    
    nom_session = Column(String(255), nullable=False)
    depot = Column(String(64), nullable=False)
    started_at = Column(TIMESTAMP, server_default=func.now())
    finished_at = Column(TIMESTAMP)
    status = Column(String(32), default='open')  # open, closed, finalized
    created_by_user_id = Column(Integer, ForeignKey('app_users.id'))
    notes = Column(Text)
    
    # NO relationships for now to avoid circular imports

class InventoryCount(BaseModel):
    __tablename__ = "inventory_counts"
    
    session_id = Column(Integer, ForeignKey('inventory_sessions.id', ondelete='CASCADE'), nullable=False)
    article_id = Column(Integer, ForeignKey('articles.id', ondelete='SET NULL'))
    round = Column(SMALLINT, nullable=False)  # 1, 2, 3, etc.
    quantity_counted = Column(Numeric, nullable=False)
    counted_by_user_id = Column(Integer, ForeignKey('app_users.id'))
    counted_at = Column(TIMESTAMP, server_default=func.now())
    is_new = Column(Boolean, default=False)  # New article found during counting
    notes = Column(Text)
        # Add version tracking
    version = Column(Integer, default=1)
    is_current = Column(Boolean, default=True)
    # NO relationships for now to avoid circular imports

class CountingHistory(BaseModel):
    __tablename__ = "counting_history"
    
    session_id = Column(Integer, ForeignKey('inventory_sessions.id', ondelete='CASCADE'), nullable=False)
    article_id = Column(Integer, ForeignKey('articles.id', ondelete='SET NULL'))
    round = Column(SMALLINT, nullable=False)
    quantity_counted = Column(Numeric, nullable=False)
    counted_by_user_id = Column(Integer, ForeignKey('app_users.id'))
    counted_at = Column(TIMESTAMP, server_default=func.now())
    action = Column(String(20), nullable=False)  # 'created', 'updated', 'deleted', 'corrected'
    previous_quantity = Column(Numeric)  # For updates/corrections
    count_id = Column(Integer, ForeignKey('inventory_counts.id'))  # Reference to original count
    correction_reason = Column(Text)  # Reason for correction
    notes = Column(Text)
    
