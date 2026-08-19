"""Seed script — creates demo organization, project, and admin user."""
import asyncio
import os
import selectors
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.database.connection import AsyncSessionLocal
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.security.password import hash_password


async def seed():
    async with AsyncSessionLocal() as db:
        org = Organization(name="MI-RA Lab", slug="mira-lab", description="MI-RA Lab organization")
        db.add(org)
        admin = User(
            email="admin@mira-lab.ai",
            username="admin",
            full_name="MI-RA Admin",
            hashed_password=hash_password("admin1234"),
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        await db.commit()
        print("Seeded: MI-RA Lab org + admin user (admin@mira-lab.ai / admin1234)")


if __name__ == "__main__":
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        loop.run_until_complete(seed())
        loop.close()
    else:
        asyncio.run(seed())
