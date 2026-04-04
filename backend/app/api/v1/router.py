from fastapi import APIRouter

from app.api.v1 import auth, users, policies, inference, claims, admin

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(users.router)
router.include_router(policies.router)
router.include_router(inference.router)
router.include_router(claims.router)
router.include_router(admin.router)
