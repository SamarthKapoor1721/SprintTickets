"""Seed the local SQLite database with demo users, projects and reviews.

Run from the backend directory:  python -m app.seed
Idempotent: skips records that already exist (matched by email / name / title).
"""
import asyncio

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.project import Project, ProjectStatus, project_members
from app.models.review import ReviewPriority, ReviewRequest, ReviewStatus
from app.models.user import User, UserRole

DEMO_PASSWORD = "password123"

USERS = [
    {"email": "ceo@erh.dev", "full_name": "Alex Carter", "role": UserRole.ceo, "department": "Executive"},
    {"email": "manager@erh.dev", "full_name": "Jordan Lee", "role": UserRole.manager, "department": "Engineering"},
    {"email": "employee@erh.dev", "full_name": "Sam Rivera", "role": UserRole.employee, "department": "Engineering"},
]


async def get_or_create_user(db, data) -> User:
    existing = (await db.execute(select(User).where(User.email == data["email"]))).scalar_one_or_none()
    if existing:
        return existing
    user = User(hashed_password=hash_password(DEMO_PASSWORD), is_active=True, **data)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_or_create_project(db, name, owner_id, **kwargs) -> Project:
    existing = (await db.execute(select(Project).where(Project.name == name))).scalar_one_or_none()
    if existing:
        return existing
    project = Project(name=name, owner_id=owner_id, **kwargs)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_or_create_review(db, title, **kwargs) -> ReviewRequest:
    existing = (await db.execute(select(ReviewRequest).where(ReviewRequest.title == title))).scalar_one_or_none()
    if existing:
        return existing
    review = ReviewRequest(title=title, **kwargs)
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


async def main():
    async with AsyncSessionLocal() as db:
        ceo = await get_or_create_user(db, USERS[0])
        manager = await get_or_create_user(db, USERS[1])
        employee = await get_or_create_user(db, USERS[2])

        proj = await get_or_create_project(
            db,
            name="ERH Platform Revamp",
            owner_id=manager.id,
            description="Internal review platform replacing ad-hoc Slack approvals.",
            department="Engineering",
            status=ProjectStatus.active,
        )

        # Build the project's team (the manager owns it; employee + CEO are members).
        for uid in (employee.id, ceo.id):
            exists = (
                await db.execute(
                    select(project_members).where(
                        project_members.c.project_id == proj.id,
                        project_members.c.user_id == uid,
                    )
                )
            ).first()
            if not exists:
                await db.execute(
                    project_members.insert().values(project_id=proj.id, user_id=uid)
                )
        await db.commit()

        await get_or_create_review(
            db,
            title="Dashboard redesign — milestone 1",
            summary="New CEO bird's-eye dashboard with pending/urgent metrics.",
            objective="Approve the visual direction before building remaining screens.",
            status=ReviewStatus.pending,
            priority=ReviewPriority.high,
            review_type="design",
            figma_link="https://figma.com/file/demo",
            project_id=proj.id,
            submitter_id=employee.id,
        )
        await get_or_create_review(
            db,
            title="Auth service — JWT login",
            summary="Backend authentication endpoints with role-based access.",
            objective="Confirm the auth flow before wiring the frontend.",
            status=ReviewStatus.approved,
            priority=ReviewPriority.critical,
            review_type="backend",
            github_repo="https://github.com/erh/backend/pull/12",
            project_id=proj.id,
            submitter_id=employee.id,
            reviewer_id=ceo.id,
        )

    print("Seed complete. Demo accounts (password: %s):" % DEMO_PASSWORD)
    for u in USERS:
        print(f"  {u['role'].value:9} {u['email']}")


if __name__ == "__main__":
    asyncio.run(main())
