from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func

from app.database import get_db
from app.models.results import InventoryResult, ArticleAddLog
from app.models.counting import InventorySession, InventoryCount
from app.models.articles import Article
from app.models.users import AppUser
from app.schemas.results import (
    InventoryResultCreate, InventoryResultUpdate, InventoryResultResponse,
    InventoryResultWithArticle, ArticleAddLogCreate, ArticleAddLogResponse,
    VarianceSummary, SessionResultsSummary
)
from app.api.dependencies import get_current_user, require_admin, can_view_results

router = APIRouter()

# ===============================
# RESULTS ENDPOINTS
# ===============================

@router.post("/results/", response_model=InventoryResultResponse, status_code=status.HTTP_201_CREATED)
def create_result(
    result: InventoryResultCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can create results
):
    """
    Create a result entry (Admin only - typically done after counting completion)
    """
    # Verify session exists
    session = db.query(InventorySession).filter(InventorySession.id == result.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Verify article exists
    article = db.query(Article).filter(Article.id == result.article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    
    # Check if result already exists
    existing_result = db.query(InventoryResult).filter(
        InventoryResult.session_id == result.session_id,
        InventoryResult.article_id == result.article_id
    ).first()
    
    if existing_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Result already exists for this article in this session"
        )
    
    db_result = InventoryResult(**result.dict())
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    
    print(f"Admin {current_user.username} created result for session {session.nom_session}, article {article.numero_article}")
    
    return db_result

@router.get("/results/", response_model=List[InventoryResultResponse])
def get_results(
    session_id: Optional[int] = None,
    article_id: Optional[int] = None,
    has_variance: Optional[bool] = None,
    ajuste: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_view_results)  # Admin, compteurs, viewer
):
    """
    Get results with filtering (Admin, compteurs, viewer)
    """
    query = db.query(InventoryResult)
    
    if session_id:
        query = query.filter(InventoryResult.session_id == session_id)
    if article_id:
        query = query.filter(InventoryResult.article_id == article_id)
    if has_variance is not None:
        if has_variance:
            query = query.filter(InventoryResult.ecart_final != 0)
        else:
            query = query.filter(InventoryResult.ecart_final == 0)
    if ajuste is not None:
        query = query.filter(InventoryResult.ajuste == ajuste)
    
    return query.order_by(InventoryResult.ecart_final.desc()).offset(skip).limit(limit).all()

@router.get("/results/{result_id}", response_model=InventoryResultResponse)
def get_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_view_results)  # Admin, compteurs, viewer
):
    """
    Get a specific result by ID (Admin, compteurs, viewer)
    """
    result = db.query(InventoryResult).filter(InventoryResult.id == result_id).first()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    return result

@router.get("/results/session/{session_id}/with-details", response_model=List[InventoryResultWithArticle])
def get_results_with_details(
    session_id: int,
    has_variance: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_view_results)  # Admin, compteurs, viewer
):
    """
    Get results with article details for a session (Admin, compteurs, viewer)
    """
    query = db.query(
        InventoryResult,
        Article.numero_article,
        Article.description_article,
        Article.code_emplacement,
        Article.quantite_en_stock
    ).join(
        Article, InventoryResult.article_id == Article.id
    ).filter(
        InventoryResult.session_id == session_id
    )
    
    if has_variance is not None:
        if has_variance:
            query = query.filter(InventoryResult.ecart_final != 0)
        else:
            query = query.filter(InventoryResult.ecart_final == 0)
    
    results_with_details = query.all()
    
    formatted_results = []
    for result, numero, description, location, sap_stock in results_with_details:
        formatted_results.append(InventoryResultWithArticle(
            id=result.id,
            session_id=result.session_id,
            article_id=result.article_id,
            quantite_initiale=float(result.quantite_initiale) if result.quantite_initiale else None,
            quantite_finale=float(result.quantite_finale) if result.quantite_finale else None,
            ecart_final=float(result.ecart_final) if result.ecart_final else None,
            ajuste=result.ajuste,
            created_at=result.created_at,
            updated_at=result.updated_at,
            article_numero=numero,
            article_description=description,
            article_location=location,
            sap_stock=float(sap_stock) if sap_stock else None
        ))
    
    return formatted_results

@router.put("/results/{result_id}", response_model=InventoryResultResponse)
def update_result(
    result_id: int,
    result_update: InventoryResultUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can update results
):
    """
    Update a result (Admin only)
    """
    result = db.query(InventoryResult).filter(InventoryResult.id == result_id).first()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    update_data = result_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(result, field, value)
    
    db.commit()
    db.refresh(result)
    
    print(f"Admin {current_user.username} updated result ID: {result_id}")
    
    return result

@router.delete("/results/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can delete results
):
    """
    Delete a result (Admin only)
    """
    result = db.query(InventoryResult).filter(InventoryResult.id == result_id).first()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    db.delete(result)
    db.commit()
    
    print(f"Admin {current_user.username} deleted result ID: {result_id}")
    
    return

# ===============================
# VARIANCE ANALYSIS ENDPOINTS
# ===============================

@router.get("/results/session/{session_id}/variance-summary", response_model=VarianceSummary)
def get_variance_summary(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_view_results)  # Admin, compteurs, viewer
):
    """
    Get variance summary for a session (Admin, compteurs, viewer)
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Get all results for the session
    results = db.query(InventoryResult).filter(InventoryResult.session_id == session_id).all()
    
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No results found for this session"
        )
    
    total_articles = len(results)
    articles_with_variance = sum(1 for r in results if r.ecart_final and r.ecart_final != 0)
    total_variance_value = sum(abs(r.ecart_final or 0) for r in results)
    average_variance = total_variance_value / total_articles if total_articles > 0 else 0
    
    # Get major variances (top 10 by absolute value)
    major_variances = db.query(
        InventoryResult,
        Article.numero_article,
        Article.description_article,
        Article.code_emplacement
    ).join(
        Article, InventoryResult.article_id == Article.id
    ).filter(
        InventoryResult.session_id == session_id,
        InventoryResult.ecart_final != 0
    ).order_by(
        func.abs(InventoryResult.ecart_final).desc()
    ).limit(10).all()
    
    major_variances_list = []
    for result, numero, description, location in major_variances:
        major_variances_list.append(InventoryResultWithArticle(
            id=result.id,
            session_id=result.session_id,
            article_id=result.article_id,
            quantite_initiale=float(result.quantite_initiale) if result.quantite_initiale else None,
            quantite_finale=float(result.quantite_finale) if result.quantite_finale else None,
            ecart_final=float(result.ecart_final) if result.ecart_final else None,
            ajuste=result.ajuste,
            created_at=result.created_at,
            updated_at=result.updated_at,
            article_numero=numero,
            article_description=description,
            article_location=location
        ))
    
    return VarianceSummary(
        total_articles=total_articles,
        articles_with_variance=articles_with_variance,
        total_variance_value=total_variance_value,
        average_variance=average_variance,
        major_variances=major_variances_list
    )

@router.get("/results/session/{session_id}/results-summary", response_model=SessionResultsSummary)
def get_session_results_summary(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_view_results)  # Admin, compteurs, viewer
):
    """
    Get comprehensive results summary for a session (Admin, compteurs, viewer)
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Get counts data
    total_articles_counted = db.query(InventoryCount.article_id).filter(
        InventoryCount.session_id == session_id
    ).distinct().count()
    
    # Get results data
    results = db.query(InventoryResult).filter(InventoryResult.session_id == session_id).all()
    
    articles_with_variance = sum(1 for r in results if r.ecart_final and r.ecart_final != 0)
    
    # Calculate positive and negative variances
    total_positive_variance = sum(r.ecart_final for r in results if r.ecart_final and r.ecart_final > 0)
    total_negative_variance = sum(abs(r.ecart_final) for r in results if r.ecart_final and r.ecart_final < 0)
    
    # Adjustment rate
    adjusted_count = sum(1 for r in results if r.ajuste)
    adjustment_rate = (adjusted_count / len(results)) * 100 if results else 0
    
    # New articles found
    new_articles_found = db.query(InventoryCount).filter(
        InventoryCount.session_id == session_id,
        InventoryCount.is_new == True
    ).distinct(InventoryCount.article_id).count()
    
    return SessionResultsSummary(
        session_id=session_id,
        session_name=session.nom_session,
        total_articles_counted=total_articles_counted,
        articles_with_variance=articles_with_variance,
        total_positive_variance=total_positive_variance,
        total_negative_variance=total_negative_variance,
        adjustment_rate=adjustment_rate,
        new_articles_found=new_articles_found
    )

# ===============================
# ARTICLE ADD LOG ENDPOINTS
# ===============================

@router.post("/article-add-log/", response_model=ArticleAddLogResponse, status_code=status.HTTP_201_CREATED)
def create_article_add_log(
    log: ArticleAddLogCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)  # All authenticated users
):
    """
    Log a new article found during counting (All authenticated users)
    """
    # Verify session exists
    session = db.query(InventorySession).filter(InventorySession.id == log.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    db_log = ArticleAddLog(**log.dict())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    
    print(f"User {current_user.username} logged new article: {log.numero_article}")
    
    return db_log

@router.get("/article-add-log/", response_model=List[ArticleAddLogResponse])
def get_article_add_logs(
    session_id: Optional[int] = None,
    created_by_user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_view_results)  # Admin, compteurs, viewer
):
    """
    Get article add logs (Admin, compteurs, viewer)
    """
    query = db.query(ArticleAddLog)
    
    if session_id:
        query = query.filter(ArticleAddLog.session_id == session_id)
    if created_by_user_id:
        query = query.filter(ArticleAddLog.created_by_user_id == created_by_user_id)
    
    return query.order_by(ArticleAddLog.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/article-add-log/session/{session_id}", response_model=List[ArticleAddLogResponse])
def get_article_add_logs_by_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_view_results)  # Admin, compteurs, viewer
):
    """
    Get article add logs for a specific session (Admin, compteurs, viewer)
    """
    logs = db.query(ArticleAddLog).filter(ArticleAddLog.session_id == session_id).all()
    return logs