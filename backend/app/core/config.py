from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Executive Review Hub"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = "supersecretkey"  # Change in production
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Frontend origins allowed to call the API during local dev.
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:4321",
        "http://localhost:3000",
        "http://localhost:3002",
    ]

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "erh_user"
    POSTGRES_PASSWORD: str = "erh_password"
    POSTGRES_DB: str = "erh_db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return "sqlite+aiosqlite:///./erh.db"
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
