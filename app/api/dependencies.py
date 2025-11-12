from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.users import AppUser
from app.core.security import verify_token

security = HTTPBearer()

# Role permissions - UPDATED
ROLE_PERMISSIONS = {
    "admin": ["all"],
    "compteur_1": ["count_round_1", "view_articles", "view_sessions", "create_articles", "edit_articles", "view_results"],
    "compteur_2": ["count_round_2", "view_articles", "view_sessions", "create_articles", "edit_articles", "view_results"], 
    "compteur_3": ["count_round_3", "view_articles", "view_sessions", "create_articles", "edit_articles", "view_results"],
    "viewer": ["view_results", "view_articles", "view_sessions"]  # Read-only
}
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> AppUser:
    """
    Get current user from JWT token
    """
    token_data = verify_token(credentials.credentials)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(AppUser).filter(AppUser.username == token_data["username"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    return user

def require_role(required_permission: str):
    """
    Check if user has required permission
    """
    def role_checker(current_user: AppUser = Depends(get_current_user)):
        user_role = current_user.role
        
        if user_role == "admin":
            return current_user
            
        user_permissions = ROLE_PERMISSIONS.get(user_role, [])
        
        if required_permission in user_permissions or "all" in user_permissions:
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role {user_role} doesn't have permission: {required_permission}"
        )
    return role_checker

# Specific role checkers - UPDATED
def require_admin(current_user: AppUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def can_edit_articles(current_user: AppUser = Depends(get_current_user)):
    """Compteurs and admin can edit articles"""
    allowed_roles = ["admin", "compteur_1", "compteur_2", "compteur_3"]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to edit articles"
        )
    return current_user

def can_create_articles(current_user: AppUser = Depends(get_current_user)):
    """Compteurs and admin can create articles"""
    allowed_roles = ["admin", "compteur_1", "compteur_2", "compteur_3"]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create articles"
        )
    return current_user

def can_delete_articles(current_user: AppUser = Depends(get_current_user)):
    """Only admin can delete articles"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required to delete articles"
        )
    return current_user

def can_count_round(round_number: int, current_user: AppUser = Depends(get_current_user)):
    if current_user.role == "admin":
        return current_user
        
    if current_user.role == f"compteur_{round_number}":
        return current_user
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Your role cannot perform counting round {round_number}"
    )

def can_view_results(current_user: AppUser = Depends(get_current_user)):
    """Admin, Compteurs, and Viewer can view results"""
    allowed_roles = ["admin", "compteur_1", "compteur_2", "compteur_3", "viewer"]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view results"
        )
    return current_user