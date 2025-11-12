from sqlalchemy import Column, String, Boolean
from .base import BaseModel

class AppUser(BaseModel):
    __tablename__ = "app_users"
    
    username = Column(String(128), unique=True, nullable=False, index=True)
    full_name = Column(String(255))
    role = Column(String(50), default='compteur')
    is_active = Column(Boolean, default=True)
    hashed_password = Column(String(255), nullable=False)
    
    # NO RELATIONSHIPS - remove all relationship lines