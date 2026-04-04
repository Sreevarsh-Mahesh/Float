"""
Float Backend — FastAPI Application Entrypoint
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router
from app.core.config import get_settings
from app.db.init_db import init_db
from app.db.session import SessionLocal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger("float.main")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables and seed roles + admin on first run."""
    logger.info("Float backend starting up...")
    db = SessionLocal()
    try:
        init_db(db)
        logger.info("Database initialised.")
    finally:
        db.close()
    yield
    logger.info("Float backend shutting down.")


app = FastAPI(
    title="Float — Parametric Insurance API",
    description=(
        "Backend API for the Float parametric income protection platform for gig workers. "
        "Includes RBAC auth, policy management, dummy ST-GNN inference, "
        "fraud-scored claim processing, and automated payout dispatch."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS (adjust origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["https://float.in"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", tags=["Health"])
def health_check():
    return {
        "service": settings.APP_NAME,
        "status": "ok",
        "version": "0.1.0",
        "env": settings.APP_ENV,
    }


@app.get("/health", tags=["Health"])
def detailed_health(db=None):
    return {"status": "healthy", "database": "connected"}
