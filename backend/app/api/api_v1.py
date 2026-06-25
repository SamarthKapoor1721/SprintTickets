from fastapi import APIRouter

from app.api.routes import auth, messages, projects, reviews, users

router = APIRouter()


@router.get("/status")
def get_status():
    return {"status": "ok", "service": "Executive Review Hub API"}


router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
router.include_router(messages.router, prefix="/messages", tags=["messages"])
