from sqlalchemy import Column, Integer, TIMESTAMP, func
from app.database import Base

class BaseModel(Base):
    __abstract__ = True
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())