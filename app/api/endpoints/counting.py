from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict
from datetime import datetime

from app.database import get_db
from app.models.counting import InventorySession, InventoryCount
from app.models.articles import Article
from app.models.users import AppUser
from app.schemas.counting import (
    InventorySessionCreate, InventorySessionUpdate, InventorySessionResponse,
    InventoryCountCreate, InventoryCountUpdate, InventoryCountResponse, InventoryCountWithArticle, SessionWithCounts,
    CountingHistoryResponse, CountingHistoryWithDetails, LastCountedArticle, LastCountedArticleForUser, SuccessMessage
)
from app.api.dependencies import get_current_user, require_admin, can_count_round
from app.models.counting import CountingHistory


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
         Article.numero_article.label("article_numero"),
        Article.description_article.label("article_description"),
        Article.code_emplacement.label("article_location"), InventoryCount.article_id == Article.id
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

@router.post("/counts/", response_model=SuccessMessage, status_code=status.HTTP_201_CREATED)
def create_count(
    count: InventoryCountCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users can count
):
    """
    Submit a count (All authenticated users). If a count already exists for the same article, session, round, and user, it is corrected.
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
    
    # Check for existing count (same session, article, round, user)
    existing_count = db.query(InventoryCount).filter(
        InventoryCount.session_id == count.session_id,
        InventoryCount.article_id == count.article_id,
        InventoryCount.round == count.round,
        InventoryCount.counted_by_user_id == count.counted_by_user_id
    ).first()
    
    if existing_count:
        # User requested: "we dont search again if find again and must count"
        # This is interpreted as correcting the existing count.
        
        old_quantity = existing_count.quantity_counted
        
        # Update the existing count
        existing_count.quantity_counted = count.quantity_counted
        existing_count.notes = count.notes
        existing_count.version += 1
        
        db.commit()
        db.refresh(existing_count)
        
        # Log correction to history
        log_counting_history(
            db=db,
            session_id=count.session_id,
            article_id=count.article_id,
            round=count.round,
            quantity_counted=count.quantity_counted,
            counted_by_user_id=count.counted_by_user_id,
            action="corrected",
            previous_quantity=old_quantity,
            count_id=existing_count.id,
            correction_reason="Recount/Correction by same user",
            notes=count.notes
        )
        
        print(f"User {current_user.username} corrected count for article {article.numero_article} in round {count.round}: {old_quantity} -> {count.quantity_counted}")
        
        return SuccessMessage(message="Count corrected successfully.")
    
    else:
        # Create a new count
        db_count = InventoryCount(**count.dict(exclude={'article_location'}))
        db.add(db_count)
        
        # 2. Update article location if provided in the count data
        if count.article_location and article.code_emplacement != count.article_location:
            article.code_emplacement = count.article_location
            db.add(article) # Mark article as dirty for update
            
        db.commit() # Commit both the count and the article update
        db.refresh(db_count)
        db.refresh(article)
        
        # 3. Log the new count to history
        log_counting_history(
            db=db,
            session_id=db_count.session_id,
            article_id=db_count.article_id,
            round=db_count.round,
            quantity_counted=db_count.quantity_counted,
            counted_by_user_id=db_count.counted_by_user_id,
            action="created",
            count_id=db_count.id,
            notes=db_count.notes
        )
        
        print(f"User {current_user.username} created new count for article {article.numero_article} in round {count.round}: {count.quantity_counted}. Location updated to {article.code_emplacement}")
        
        return SuccessMessage(message="Count submitted successfully")

@router.get("/counts/", response_model=List[InventoryCountResponse])
def get_counts(
    session_id: Optional[int] = None,
    article_id: Optional[int] = None,
    round_number: Optional[int] = None,
    counted_by_user_id: Optional[int] = None,
    location: Optional[str] = None,  # New filter for location
    article_search: Optional[str] = None, # New filter for article number or description
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get all counts with filters (All authenticated users)
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
    
    # Filtering by location and article search requires joining with the Article table
    if location or article_search:
        query = query.join(Article, InventoryCount.article_id == Article.id)
        
        if location:
            query = query.filter(Article.code_emplacement == location)
            
        if article_search:
            # Case-insensitive search on article number or description
            search_term = f"%{article_search}%"
            query = query.filter(
                (Article.numero_article.ilike(search_term)) |
                (Article.description_article.ilike(search_term))
            )
    
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
         Article.numero_article.label("article_numero"),
        Article.description_article.label("article_description"),
        Article.code_emplacement.label("article_location"), InventoryCount.article_id == Article.id
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
# NEW ENDPOINT: UPDATE COUNT BY DELTA
# ===============================

@router.patch("/counts/{count_id}/update_quantity", response_model=InventoryCountResponse)
def update_count_quantity(
    count_id: int,
    update: InventoryCountUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Update the quantity of an existing count by adding or subtracting a value.
    """
    existing_count = db.query(InventoryCount).filter(InventoryCount.id == count_id).first()

    if not existing_count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Count not found"
        )

    # Check if the user is authorized to update this count
    if existing_count.counted_by_user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this count"
        )

    old_quantity = existing_count.quantity_counted
    new_quantity = old_quantity + update.quantity_change

    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity cannot be negative"
        )

    existing_count.quantity_counted = new_quantity
    if update.notes:
        existing_count.notes = update.notes
    existing_count.version += 1

    db.commit()

    log_counting_history(
        db=db,
        session_id=existing_count.session_id,
        article_id=existing_count.article_id,
        round=existing_count.round,
        quantity_counted=new_quantity,
        counted_by_user_id=current_user.id,
        action="updated_by_delta",
        previous_quantity=old_quantity,
        count_id=existing_count.id,
        correction_reason=f"Quantity updated by {update.quantity_change}",
        notes=update.notes
    )

    db.refresh(existing_count)
    return existing_count

# ===============================
# NEW ENDPOINT: LAST COUNTED ARTICLE FOR CURRENT USER
# ===============================

@router.get("/counts/last-for-user/", response_model=List[LastCountedArticleForUser])
def get_last_counts_for_user(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get the last N counts for the currently logged-in user across all sessions.
    """
    counts = db.query(
        InventoryCount.id.label("count_id"),
        Article.id.label("article_id"),
        Article.numero_article.label("article_numero"),
        Article.description_article.label("article_description"),
        Article.code_emplacement.label("article_location"),
        InventoryCount.quantity_counted,
        InventoryCount.round,
        InventoryCount.counted_at,
        InventorySession.id.label("session_id"),
        InventorySession.nom_session.label("session_name")
    ).join(
        Article, InventoryCount.article_id == Article.id
    ).join(
        InventorySession, InventoryCount.session_id == InventorySession.id
    ).filter(
        InventoryCount.counted_by_user_id == current_user.id
    ).order_by(desc(InventoryCount.counted_at)).limit(limit).all()

    return [LastCountedArticleForUser(**count._asdict()) for count in counts]


# ===============================
# NEW ENDPOINT: LAST COUNTED ARTICLE
# ===============================


class LastCountedArticle(BaseModel):
    article_numero: str
    article_description: Optional[str]
    article_location: Optional[str]
    counted_at: datetime
    quantity_counted: float
    round: int
    user_id: int
    username: str

@router.get("/counts/last-counted/{session_id}", response_model=Dict[int, LastCountedArticle])
def get_last_counted_articles(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get the last article counted by each user in a specific session.
    Returns a dictionary where the key is the user_id and the value is the LastCountedArticle.
    """
    
    # 1. Find the maximum counted_at timestamp for each user in the session
    subquery = db.query(
        InventoryCount.counted_by_user_id,
        func.max(InventoryCount.counted_at).label('max_counted_at')
    ).filter(
        InventoryCount.session_id == session_id
    ).group_by(InventoryCount.counted_by_user_id).subquery()
    
    # 2. Join the subquery with InventoryCount, Article, and AppUser to get the full details
    # We use the max_counted_at to filter for the single latest count per user.
    # Note: If a user has two counts at the exact same millisecond, this might return both, 
    # but for practical purposes, it should be fine.
    latest_counts = db.query(
        InventoryCount,
        Article.numero_article,
        Article.description_article,
        Article.code_emplacement,
        AppUser.username
    ).join(
        subquery, 
        (InventoryCount.counted_by_user_id == subquery.c.counted_by_user_id) & 
        (InventoryCount.counted_at == subquery.c.max_counted_at)
    ).join(
        Article, InventoryCount.article_id == Article.id
    ).join(
        AppUser, InventoryCount.counted_by_user_id == AppUser.id
    ).filter(
        InventoryCount.session_id == session_id
    ).all()
    
    results = {}
    for count, numero, description, location, username in latest_counts:
        # Ensure we only keep one entry per user_id in case of ties in timestamp
        if count.counted_by_user_id not in results:
            results[count.counted_by_user_id] = LastCountedArticle(
                article_numero=numero,
                article_description=description,
                article_location=location,
                counted_at=count.counted_at,
                quantity_counted=float(count.quantity_counted),
                round=count.round,
                user_id=count.counted_by_user_id,
                username=username
            )
            
    return results

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
        func.count(InventoryCount.id).label('count')
    ).filter(
        InventoryCount.session_id == session_id
    ).group_by(InventoryCount.round).all()
    
    # Counts by user
    counts_by_user = db.query(
        AppUser.username,
        func.count(InventoryCount.id).label('count')
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