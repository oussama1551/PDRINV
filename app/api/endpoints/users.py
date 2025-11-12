from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

from app.database import get_db
from app.models.users import AppUser
from app.schemas.users import UserCreate, UserUpdate, UserResponse, UserLogin, Token, ChangePassword
from app.core.security import (
    get_password_hash, verify_password, create_access_token, 
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.api.dependencies import get_current_user, require_admin

router = APIRouter()

@router.post("/login", response_model=Token)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login user and return JWT token
    """
    user = db.query(AppUser).filter(AppUser.username == user_credentials.username).first()
    
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }

@router.post("/users/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db), current_user: AppUser = Depends(require_admin)):
    """
    Create new user (Admin only)
    """
    # Check if username already exists
    existing_user = db.query(AppUser).filter(AppUser.username == user.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Hash the password
    hashed_password = get_password_hash(user.password)
    
    db_user = AppUser(
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        hashed_password=hashed_password
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.get("/users/me", response_model=UserResponse)
def get_current_user_info(current_user: AppUser = Depends(get_current_user)):
    """
    Get current user information
    """
    return current_user

@router.get("/users/", response_model=List[UserResponse])
def get_all_users(
    skip: int = 0, 
    limit: int = 100,
    role: str = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)
):
    """
    Get all users (Admin only)
    """
    query = db.query(AppUser)
    
    if role:
        query = query.filter(AppUser.role == role)
    if active_only:
        query = query.filter(AppUser.is_active == True)
    
    return query.offset(skip).limit(limit).all()

@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: AppUser = Depends(require_admin)):
    """
    Get user by ID (Admin only)
    """
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int, 
    user_update: UserUpdate, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)
):
    """
    Update user (Admin only)
    """
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Handle password update
    if 'password' in update_data and update_data['password']:
        update_data['hashed_password'] = get_password_hash(update_data['password'])
        update_data.pop('password')
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: AppUser = Depends(require_admin)):
    """
    Delete user (Admin only)
    """
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Don't allow self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db.delete(user)
    db.commit()
    return

@router.put("/users/me/change-password", response_model=UserResponse)
def change_my_password(
    password_data: ChangePassword,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Change current user's password
    """
    # Verify old password
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old password is incorrect"
        )
    
    # Update to new password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.put("/users/{user_id}/activate", response_model=UserResponse)
def activate_user(user_id: int, db: Session = Depends(get_db), current_user: AppUser = Depends(require_admin)):
    """
    Activate user account (Admin only)
    """
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user

@router.put("/users/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(user_id: int, db: Session = Depends(get_db), current_user: AppUser = Depends(require_admin)):
    """
    Deactivate user account (Admin only)
    """
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow self-deactivation
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user

@router.get("/users/search/{search_term}", response_model=List[UserResponse])
def search_users(
    search_term: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)
):
    """
    Search users by username or full name (Admin only)
    """
    search_pattern = f"%{search_term}%"
    users = db.query(AppUser).filter(
        (AppUser.username.ilike(search_pattern)) |
        (AppUser.full_name.ilike(search_pattern))
    ).offset(skip).limit(limit).all()
    
    return users