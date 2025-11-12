from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.counting import InventorySession, InventoryCount
from app.models.articles import Article
from app.models.users import AppUser
from app.schemas.counting import (
    InventorySessionCreate, InventorySessionUpdate, InventorySessionResponse,
    InventoryCountCreate, InventoryCountResponse, InventoryCountWithArticle, SessionWithCounts
)
from app.api.dependencies import get_current_user, require_admin, can_count_round
from app.models.counting import CountingHistory
from app.schemas.counting import CountingHistoryResponse, CountingHistoryWithDetails


router = APIRouter()

# ===============================
# SESSION ENDPOINTS
# ===============================

@router.post("/sessions/", response_model=InventorySessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    session: InventorySessionCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can create sessions
):
    """
    Create a new inventory session (Admin only)
    """
    # Check if session name already exists
    existing_session = db.query(InventorySession).filter(
        InventorySession.nom_session == session.nom_session
    ).first()
    
    if existing_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session name already exists"
        )
    
    db_session = InventorySession(**session.dict())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    print(f"Admin {current_user.username} created session: {session.nom_session}")
    
    return db_session

@router.get("/sessions/", response_model=List[InventorySessionResponse])
def get_sessions(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    depot: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Get all inventory sessions (All authenticated users)
    """
    query = db.query(InventorySession)
    
    if status_filter:
        query = query.filter(InventorySession.status == status_filter)
    if depot:
        query = query.filter(InventorySession.depot == depot)
    
    return query.order_by(InventorySession.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/sessions/{session_id}", response_model=InventorySessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Get a specific session by ID (All authenticated users)
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    return session

@router.put("/sessions/{session_id}", response_model=InventorySessionResponse)
def update_session(
    session_id: int,
    session_update: InventorySessionUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can update sessions
):
    """
    Update a session (Admin only)
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    update_data = session_update.dict(exclude_unset=True)
    
    # If setting status to closed/finalized, set finished_at
    if update_data.get('status') in ['closed', 'finalized'] and not session.finished_at:
        update_data['finished_at'] = datetime.now()
    
    for field, value in update_data.items():
        setattr(session, field, value)
    
    db.commit()
    db.refresh(session)
    
    print(f"Admin {current_user.username} updated session: {session.nom_session}")
    
    return session

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can delete sessions
):
    """
    Delete a session (Admin only) - This will cascade delete counts and results
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    db.delete(session)
    db.commit()
    
    print(f"Admin {current_user.username} deleted session ID: {session_id}")
    
    return

@router.get("/sessions/{session_id}/with-counts", response_model=SessionWithCounts)
def get_session_with_counts(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Get session with all counts and article details (All authenticated users)
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Get counts with article details
    counts_with_articles = db.query(
        InventoryCount,
        Article.numero_article,
        Article.description_article,
        Article.code_emplacement
    ).join(
        Article, InventoryCount.article_id == Article.id
    ).filter(
        InventoryCount.session_id == session_id
    ).all()
    
    # Transform results
    counts_data = []
    for count, numero, description, location in counts_with_articles:
        counts_data.append(InventoryCountWithArticle(
            id=count.id,
            session_id=count.session_id,
            article_id=count.article_id,
            round=count.round,
            quantity_counted=float(count.quantity_counted),
            counted_by_user_id=count.counted_by_user_id,
            counted_at=count.counted_at,
            is_new=count.is_new,
            notes=count.notes,
            article_numero=numero,
            article_description=description,
            article_location=location
        ))
    
    # Get unique articles count
    unique_articles = db.query(InventoryCount.article_id).filter(
        InventoryCount.session_id == session_id
    ).distinct().count()
    
    return SessionWithCounts(
        **session.__dict__,
        counts=counts_data,
        total_counts=len(counts_data),
        unique_articles=unique_articles
    )

# ===============================
# COUNTING ENDPOINTS
# ===============================

@router.post("/counts/", response_model=InventoryCountResponse, status_code=status.HTTP_201_CREATED)
def create_count(
    count: InventoryCountCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users can count
):
    """
    Submit a count (All authenticated users)
    """
    # Verify session exists
    session = db.query(InventorySession).filter(InventorySession.id == count.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Verify session is open
    if session.status != 'open':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add counts to closed session"
        )
    
    # Verify article exists
    article = db.query(Article).filter(Article.id == count.article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    
    # Check if user can count in this round
    if current_user.role.startswith('compteur_'):
        user_round = int(current_user.role.split('_')[1])
        if count.round != user_round:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your role can only count in round {user_round}"
            )
    
    # Check for duplicate count (same session, article, round, user)
    existing_count = db.query(InventoryCount).filter(
        InventoryCount.session_id == count.session_id,
        InventoryCount.article_id == count.article_id,
        InventoryCount.round == count.round,
        InventoryCount.counted_by_user_id == count.counted_by_user_id
    ).first()
    
    if existing_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Count already submitted for this article in this round"
        )
    
    db_count = InventoryCount(**count.dict())
    db.add(db_count)
    db.commit()
    db.refresh(db_count)

        # Log to history
    log_counting_history(
        db=db,
        session_id=count.session_id,
        article_id=count.article_id,
        round=count.round,
        quantity_counted=count.quantity_counted,
        counted_by_user_id=count.counted_by_user_id,
        action="created",
        notes=count.notes
    )
    
    print(f"User {current_user.username} submitted count for article {article.numero_article} in round {count.round}")
    
    return db_count

@router.get("/counts/", response_model=List[InventoryCountResponse])
def get_counts(
    session_id: Optional[int] = None,
    article_id: Optional[int] = None,
    round_number: Optional[int] = None,
    counted_by_user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Get counts with filtering (All authenticated users)
    """
    query = db.query(InventoryCount)
    
    if session_id:
        query = query.filter(InventoryCount.session_id == session_id)
    if article_id:
        query = query.filter(InventoryCount.article_id == article_id)
    if round_number:
        query = query.filter(InventoryCount.round == round_number)
    if counted_by_user_id:
        query = query.filter(InventoryCount.counted_by_user_id == counted_by_user_id)
    
    return query.order_by(InventoryCount.counted_at.desc()).offset(skip).limit(limit).all()

@router.get("/counts/{count_id}", response_model=InventoryCountResponse)
def get_count(
    count_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Get a specific count by ID (All authenticated users)
    """
    count = db.query(InventoryCount).filter(InventoryCount.id == count_id).first()
    if not count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Count not found"
        )
    return count

@router.get("/counts/session/{session_id}/round/{round_number}", response_model=List[InventoryCountWithArticle])
def get_counts_by_session_and_round(
    session_id: int,
    round_number: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Get counts for a specific session and round with article details (All authenticated users)
    """
    counts_with_articles = db.query(
        InventoryCount,
        Article.numero_article,
        Article.description_article,
        Article.code_emplacement
    ).join(
        Article, InventoryCount.article_id == Article.id
    ).filter(
        InventoryCount.session_id == session_id,
        InventoryCount.round == round_number
    ).all()
    
    results = []
    for count, numero, description, location in counts_with_articles:
        results.append(InventoryCountWithArticle(
            id=count.id,
            session_id=count.session_id,
            article_id=count.article_id,
            round=count.round,
            quantity_counted=float(count.quantity_counted),
            counted_by_user_id=count.counted_by_user_id,
            counted_at=count.counted_at,
            is_new=count.is_new,
            notes=count.notes,
            article_numero=numero,
            article_description=description,
            article_location=location
        ))
    
    return results

@router.delete("/counts/{count_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_count(
    count_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can delete counts
):
    """
    Delete a count (Admin only)
    """
    count = db.query(InventoryCount).filter(InventoryCount.id == count_id).first()
    if not count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Count not found"
        )
    
    db.delete(count)
    db.commit()
    
    print(f"Admin {current_user.username} deleted count ID: {count_id}")
    
    return

def log_counting_history(
    db: Session,
    session_id: int,
    article_id: int,
    round: int,
    quantity_counted: float,
    counted_by_user_id: int,
    action: str,
    previous_quantity: Optional[float] = None,
    count_id: Optional[int] = None,
    correction_reason: Optional[str] = None,
    notes: Optional[str] = None
):
    """Helper function to log counting history"""
    history_entry = CountingHistory(
        session_id=session_id,
        article_id=article_id,
        round=round,
        quantity_counted=quantity_counted,
        counted_by_user_id=counted_by_user_id,
        action=action,
        previous_quantity=previous_quantity,
        count_id=count_id,
        correction_reason=correction_reason,
        notes=notes
    )
    db.add(history_entry)
    db.commit()
    return history_entry

# ===============================
# STATISTICS ENDPOINTS
# ===============================

@router.get("/sessions/{session_id}/statistics")
def get_session_statistics(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Get statistics for a session (All authenticated users)
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Basic counts
    total_counts = db.query(InventoryCount).filter(InventoryCount.session_id == session_id).count()
    unique_articles = db.query(InventoryCount.article_id).filter(
        InventoryCount.session_id == session_id
    ).distinct().count()
    
    # Counts by round
    counts_by_round = db.query(
        InventoryCount.round,
        db.func.count(InventoryCount.id).label('count')
    ).filter(
        InventoryCount.session_id == session_id
    ).group_by(InventoryCount.round).all()
    
    # Counts by user
    counts_by_user = db.query(
        AppUser.username,
        db.func.count(InventoryCount.id).label('count')
    ).join(
        InventoryCount, InventoryCount.counted_by_user_id == AppUser.id
    ).filter(
        InventoryCount.session_id == session_id
    ).group_by(AppUser.username).all()
    
    # New articles found
    new_articles_count = db.query(InventoryCount).filter(
        InventoryCount.session_id == session_id,
        InventoryCount.is_new == True
    ).count()
    
    return {
        "session_id": session_id,
        "session_name": session.nom_session,
        "total_counts": total_counts,
        "unique_articles": unique_articles,
        "new_articles_found": new_articles_count,
        "counts_by_round": [{"round": row.round, "count": row.count} for row in counts_by_round],
        "counts_by_user": [{"username": row.username, "count": row.count} for row in counts_by_user],
        "status": session.status,
        "started_at": session.started_at,
        "finished_at": session.finished_at
    }


class CountCorrection(BaseModel):
    new_quantity: float
    correction_reason: str
    notes: Optional[str] = None

@router.put("/counts/{count_id}/correct", response_model=InventoryCountResponse)
def correct_count(
    count_id: int,
    correction: CountCorrection,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Correct an existing count with audit trail
    """
    # Get the original count
    original_count = db.query(InventoryCount).filter(InventoryCount.id == count_id).first()
    if not original_count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Count not found"
        )
    
    # Verify user owns the count or is admin
    if original_count.counted_by_user_id != current_user.id and current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only correct your own counts"
        )
    
    # Store old quantity for history
    old_quantity = original_count.quantity_counted
    
    # Update the count
    original_count.quantity_counted = correction.new_quantity
    original_count.notes = correction.notes
    original_count.version += 1
    
    db.commit()
    db.refresh(original_count)
    
    # Log correction to history
    log_counting_history(
        db=db,
        session_id=original_count.session_id,
        article_id=original_count.article_id,
        round=original_count.round,
        quantity_counted=correction.new_quantity,
        counted_by_user_id=current_user.id,
        action="corrected",
        previous_quantity=old_quantity,
        count_id=count_id,
        correction_reason=correction.correction_reason,
        notes=correction.notes
    )
    
    print(f"User {current_user.username} corrected count {count_id}: {old_quantity} → {correction.new_quantity}")
    
    return original_count


@router.get("/counting-history/", response_model=List[CountingHistoryWithDetails])
def get_counting_history(
    session_id: Optional[int] = None,
    article_id: Optional[int] = None,
    user_id: Optional[int] = None,
    round: Optional[int] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get counting history with filters (All authenticated users)
    """
    query = db.query(
        CountingHistory,
        Article.numero_article,
        Article.description_article,
        AppUser.username,
        AppUser.full_name,
        InventorySession.nom_session
    ).join(
        Article, CountingHistory.article_id == Article.id
    ).join(
        AppUser, CountingHistory.counted_by_user_id == AppUser.id
    ).join(
        InventorySession, CountingHistory.session_id == InventorySession.id
    )
    
    if session_id:
        query = query.filter(CountingHistory.session_id == session_id)
    if article_id:
        query = query.filter(CountingHistory.article_id == article_id)
    if user_id:
        query = query.filter(CountingHistory.counted_by_user_id == user_id)
    if round:
        query = query.filter(CountingHistory.round == round)
    if action:
        query = query.filter(CountingHistory.action == action)
    
    results = query.order_by(CountingHistory.counted_at.desc()).offset(skip).limit(limit).all()
    
    history_list = []
    for history, art_num, art_desc, username, full_name, session_name in results:
        history_list.append(CountingHistoryWithDetails(
            id=history.id,
            session_id=history.session_id,
            article_id=history.article_id,
            round=history.round,
            quantity_counted=float(history.quantity_counted),
            counted_by_user_id=history.counted_by_user_id,
            counted_at=history.counted_at,
            action=history.action,
            previous_quantity=float(history.previous_quantity) if history.previous_quantity else None,
            count_id=history.count_id,
            correction_reason=history.correction_reason,
            notes=history.notes,
            created_at=history.created_at,
            updated_at=history.updated_at,
            article_numero=art_num,
            article_description=art_desc,
            user_username=username,
            user_full_name=full_name,
            session_name=session_name
        ))
    
    return history_list

@router.get("/counting-history/session/{session_id}/article/{article_id}", response_model=List[CountingHistoryWithDetails])
def get_article_counting_history(
    session_id: int,
    article_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get complete counting history for an article in a session (All authenticated users)
    """
    return get_counting_history(
        session_id=session_id,
        article_id=article_id,
        db=db,
        current_user=current_user
    )