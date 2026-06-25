from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings

# pool_pre_ping is meant for server databases (Postgres/MySQL) and breaks the
# async greenlet bridge with aiosqlite, so it is left off for local SQLite.
engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)

# expire_on_commit=False keeps ORM attributes accessible after commit without
# triggering a lazy reload (which would need an active async context).
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)
