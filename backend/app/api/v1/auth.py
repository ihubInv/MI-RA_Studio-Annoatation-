"""Authentication API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, CurrentUser
from app.schemas.auth import LoginRequest, TokenResponse, RegisterRequest
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DB):
    service = AuthService(db)
    return await service.login(payload.email, payload.password)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DB):
    service = AuthService(db)
    return await service.register(payload)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: DB):
    service = AuthService(db)
    return await service.refresh(refresh_token)


@router.get("/me")
async def get_me(current_user: CurrentUser):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }


@router.post("/logout")
async def logout(current_user: CurrentUser):
    # Stateless JWT — client discards token; add token blacklist if needed
    return {"message": "Logged out successfully"}
