from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import threading
from app.database import engine, Base
from app.models import articles, users, counting, results
from app.services.sap_to_pg_sync import sync_articles
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Run sync in background thread
    logger.info("🚀 Starting SAP sync in background...")
    
    def run_sync():
        try:
            sync_articles()
        except Exception as e:
            logger.error(f"❌ SAP sync failed: {e}")
    
    # Run sync in separate thread to not block startup
    sync_thread = threading.Thread(target=run_sync)
    sync_thread.daemon = True
    sync_thread.start()
    
    yield  # App runs here
    
    # Shutdown (if needed)
    logger.info("🛑 Shutting down...")

app = FastAPI(
    title="PDR Inventory API", 
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - ADD THIS SECTION
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://127.0.0.1:3000",  # Alternative localhost
        # Add production domains here when deployed
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
    expose_headers=["*"]  # Expose all headers to frontend
)

@app.get("/")
def read_root():
    return {"message": "PDR Inventory API is running successfully 🚀"}

# Create tables
Base.metadata.create_all(bind=engine)

# Include routers
from app.api.endpoints import articles, users, counting, results

app.include_router(articles.router, prefix="/api/v1", tags=["articles"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(counting.router, prefix="/api/v1", tags=["counting"])
app.include_router(results.router, prefix="/api/v1", tags=["results"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "PDR Inventory API"}

# Manual sync endpoint
@app.post("/sync/articles")
def manual_sync():
    """
    Manually trigger SAP articles sync
    """
    try:
        sync_articles()
        return {"status": "success", "message": "SAP sync completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")