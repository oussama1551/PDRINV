from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, distinct, func
from typing import List, Optional, Dict

from app.database import get_db
from app.models.articles import Article
from app.schemas.articles import ArticleResponse, ArticleCreate, ArticleUpdate
from app.api.dependencies import get_current_user, require_admin, can_edit_articles, can_create_articles, can_delete_articles
from app.models.users import AppUser

router = APIRouter()

# ===============================
# PUBLIC ENDPOINTS (No auth required)
# ===============================

# In your articles router, update the get_articles endpoint:

@router.get("/articles/", response_model=dict)
def get_articles(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=10000, description="Number of records to return"),
    code_entrepot: Optional[str] = None,
    code_emplacement: Optional[str] = None,
    has_stock: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Get all articles with pagination and filtering
    """
    # Build query
    query = db.query(Article)
    
    if code_entrepot:
        query = query.filter(Article.code_entrepot == code_entrepot)
    if code_emplacement:
        query = query.filter(Article.code_emplacement == code_emplacement)
    if has_stock is not None:
        if has_stock:
            query = query.filter(Article.quantite_en_stock > 0)
        else:
            query = query.filter(Article.quantite_en_stock == 0)
    
    # Get total count
    total = query.count()
    
    # Get paginated results
    articles = query.order_by(Article.numero_article).offset(skip).limit(limit).all()
    
    # Convert SQLAlchemy models to Pydantic models
    articles_data = [ArticleResponse.from_orm(article) for article in articles]
    
    return {
        "items": articles_data,
        "total": total,
        "page": (skip // limit) + 1,
        "pages": (total + limit - 1) // limit,  # Ceiling division
        "limit": limit
    }

@router.get("/articles/{article_id}", response_model=ArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    """
    Get a specific article by ID (Public - no auth required)
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    return article

@router.get("/articles/by-number/{numero_article}", response_model=ArticleResponse)
def get_article_by_number(numero_article: str, db: Session = Depends(get_db)):
    """
    Get article by article number (Public - no auth required)
    """
    article = db.query(Article).filter(Article.numero_article == numero_article).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    return article

@router.get("/articles/search/", response_model=List[ArticleResponse])
def search_articles(
    q: str = Query(..., min_length=1, description="Search term"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Search articles by number, description, or supplier catalog (Public)
    """
    search_term = f"%{q}%"
    articles = db.query(Article).filter(
        or_(
            Article.numero_article.ilike(search_term),
            Article.description_article.ilike(search_term),
            Article.catalogue_fournisseur.ilike(search_term),
            Article.code_emplacement.ilike(search_term)
        )
    ).order_by(Article.numero_article).offset(skip).limit(limit).all()
    
    return articles

# ===============================
# PROTECTED ENDPOINTS (Auth required)
# ===============================

@router.post("/articles/", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    article: ArticleCreate, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_create_articles)  # Admin AND Compteurs can create
):
    """
    Create a new article (Admin & Compteurs)
    """
    # Check if article number already exists
    existing_article = db.query(Article).filter(Article.numero_article == article.numero_article).first()
    if existing_article:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article number already exists"
        )
    
    db_article = Article(**article.dict())
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    
    print(f"User {current_user.username} (role: {current_user.role}) created article: {article.numero_article}")
    
    return db_article

@router.put("/articles/{article_id}", response_model=ArticleResponse)
def update_article(
    article_id: int, 
    article_update: ArticleUpdate, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_edit_articles)  # Admin AND Compteurs can update
):
    """
    Update an existing article (Admin & Compteurs)
    """
    db_article = db.query(Article).filter(Article.id == article_id).first()
    if not db_article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    
    update_data = article_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_article, field, value)
    
    db.commit()
    db.refresh(db_article)
    
    print(f"User {current_user.username} (role: {current_user.role}) updated article: {db_article.numero_article}")
    
    return db_article

@router.patch("/articles/{article_id}", response_model=ArticleResponse)
def partial_update_article(
    article_id: int, 
    article_update: ArticleUpdate, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_edit_articles)  # Admin AND Compteurs can update
):
    """
    Partially update an article (Admin & Compteurs)
    """
    return update_article(article_id, article_update, db)

@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article_by_id(
    article_id: int, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_delete_articles)  # Only admin can delete
):
    """
    Delete an article by ID (Admin only)
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    
    db.delete(article)
    db.commit()
    
    print(f"Admin {current_user.username} deleted article ID: {article_id}")
    
    return

@router.delete("/articles/by-number/{numero_article}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article_by_number(
    numero_article: str, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(can_delete_articles)  # Only admin can delete
):
    """
    Delete an article by article number (Admin only)
    """
    article = db.query(Article).filter(Article.numero_article == numero_article).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )
    
    db.delete(article)
    db.commit()
    
    print(f"Admin {current_user.username} deleted article: {numero_article}")
    
    return

# ===============================
# BULK OPERATIONS
# ===============================

@router.post("/articles/bulk/", response_model=List[ArticleResponse], status_code=status.HTTP_201_CREATED)
def create_articles_bulk(
    articles: List[ArticleCreate], 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can bulk create
):
    """
    Create multiple articles at once (Admin only)
    """
    db_articles = []
    created_count = 0
    skipped_count = 0
    
    for article_data in articles:
        # Check for duplicates
        existing = db.query(Article).filter(Article.numero_article == article_data.numero_article).first()
        if existing:
            skipped_count += 1
            continue
        
        db_article = Article(**article_data.dict())
        db.add(db_article)
        db_articles.append(db_article)
        created_count += 1
    
    db.commit()
    
    # Refresh all created articles
    for article in db_articles:
        db.refresh(article)
    
    print(f"Admin {current_user.username} bulk created: {created_count} articles, {skipped_count} skipped")
    
    return db_articles

@router.put("/articles/bulk/update-stock", response_model=List[ArticleResponse])
def bulk_update_stock(
    updates: List[dict],
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(require_admin)  # Only admin can bulk update
):
    """
    Bulk update stock quantities for multiple articles (Admin only)
    """
    updated_articles = []
    
    for update in updates:
        article_number = update.get("numero_article")
        new_stock = update.get("quantite_en_stock")
        
        if not article_number or new_stock is None:
            continue
            
        article = db.query(Article).filter(Article.numero_article == article_number).first()
        if article:
            article.quantite_en_stock = new_stock
            updated_articles.append(article)
    
    db.commit()
    
    # Refresh all updated articles
    for article in updated_articles:
        db.refresh(article)
    
    print(f"Admin {current_user.username} bulk updated stock for {len(updated_articles)} articles")
    
    return updated_articles

# ===============================
# ENHANCED FILTERING ENDPOINTS (All authenticated users)
# ===============================

@router.get("/articles/unique_values", response_model=Dict[str, List[str]])
def get_unique_column_values(
    columns: str = Query(..., description="Comma-separated list of column names to get unique values for"),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get all unique, non-null values for specified columns across the entire dataset.
    """
    column_names = [col.strip() for col in columns.split(',')]
    valid_columns = {
        "code_emplacement": Article.code_emplacement,
        "code_entrepot": Article.code_entrepot,
        "catalogue_fournisseur": Article.catalogue_fournisseur,
        # Add other columns here if needed for filtering
    }
    
    results = {}
    
    for col_name in column_names:
        if col_name in valid_columns:
            column = valid_columns[col_name]
            # Query for distinct, non-null values
            unique_values = db.query(distinct(column)).filter(column.isnot(None)).all()
            
            # Flatten the list of tuples and convert to string
            values_list = [str(val[0]) for val in unique_values if val[0] is not None]
            results[col_name] = values_list
        else:
            # Optionally raise an error or just skip invalid columns
            print(f"Warning: Requested unique values for invalid column: {col_name}")

    return results

@router.get("/articles/by-location/{code_emplacement}", response_model=List[ArticleResponse])
def get_articles_by_location(
    code_emplacement: str, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get articles by storage location (All authenticated users)
    """
    articles = db.query(Article).filter(Article.code_emplacement == code_emplacement).all()
    return articles

@router.get("/articles/by-warehouse/{code_entrepot}", response_model=List[ArticleResponse])
def get_articles_by_warehouse(
    code_entrepot: str, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get articles by warehouse code (All authenticated users)
    """
    articles = db.query(Article).filter(Article.code_entrepot == code_entrepot).all()
    return articles

@router.get("/articles/warehouse/{code_entrepot}/location/{code_emplacement}", response_model=List[ArticleResponse])
def get_articles_by_warehouse_and_location(
    code_entrepot: str, 
    code_emplacement: str, 
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get articles by specific warehouse and location (All authenticated users)
    """
    articles = db.query(Article).filter(
        Article.code_entrepot == code_entrepot,
        Article.code_emplacement == code_emplacement
    ).all()
    return articles

@router.get("/articles/with-stock/", response_model=List[ArticleResponse])
def get_articles_with_stock(
    min_stock: float = Query(0, ge=0, description="Minimum stock quantity"),
    max_stock: Optional[float] = Query(None, ge=0, description="Maximum stock quantity"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get articles with stock quantity filtering (All authenticated users)
    """
    query = db.query(Article).filter(Article.quantite_en_stock >= min_stock)
    
    if max_stock is not None:
        query = query.filter(Article.quantite_en_stock <= max_stock)
    
    return query.order_by(Article.quantite_en_stock.desc()).offset(skip).limit(limit).all()

@router.get("/articles/without-stock/", response_model=List[ArticleResponse])
def get_articles_without_stock(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get articles with zero stock (All authenticated users)
    """
    articles = db.query(Article).filter(Article.quantite_en_stock == 0).offset(skip).limit(limit).all()
    return articles

# ===============================
# STATISTICS & ANALYTICS (All authenticated users)
# ===============================

@router.get("/articles/statistics/summary")
def get_articles_statistics(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Get articles statistics (All authenticated users)
    """
    # ... (keep the same statistics code as before)
    total_articles = db.query(Article).count()
    total_warehouses = db.query(Article.code_entrepot).distinct().count()
    total_locations = db.query(Article.code_emplacement).distinct().count()
    
    total_stock = db.query(func.sum(Article.quantite_en_stock)).scalar() or 0
    articles_with_stock = db.query(Article).filter(Article.quantite_en_stock > 0).count()
    articles_without_stock = db.query(Article).filter(Article.quantite_en_stock == 0).count()
    
    warehouse_stats = db.query(
        Article.code_entrepot,
        func.count(Article.id).label("article_count"),
      func.sum(Article.quantite_en_stock).label("total_stock")    ).group_by(Article.code_entrepot).all()
    
    return {
        "total_articles": total_articles,
        "total_warehouses": total_warehouses,
        "total_locations": total_locations,
        "total_stock_quantity": float(total_stock),
        "articles_with_stock": articles_with_stock,
        "articles_without_stock": articles_without_stock,
        "warehouses": [
            row[0] for row in 
            db.query(Article.code_entrepot).distinct().all()
            if row[0]
        ],
        "warehouse_distribution": [
            {
                "warehouse": stat.code_entrepot,
                "article_count": stat.article_count,
                "total_stock": float(stat.total_stock or 0)
            }
            for stat in warehouse_stats
            if stat.code_entrepot
        ]
    }

@router.get("/articles/export/csv")
def export_articles_csv(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Export articles as CSV format (All authenticated users)
    """
    articles = db.query(Article).order_by(Article.numero_article).all()
    
    csv_lines = ["numero_article,description_article,catalogue_fournisseur,code_entrepot,code_emplacement,quantite_en_stock"]
    
    for article in articles:
        csv_lines.append(
            f'"{article.numero_article}","{article.description_article or ""}","{article.catalogue_fournisseur or ""}","{article.code_entrepot or ""}","{article.code_emplacement or ""}",{article.quantite_en_stock or 0}'
        )
    
    return {
        "filename": f"articles_export_{current_user.username}.csv",
        "content": "\n".join(csv_lines),
        "count": len(articles)
    }