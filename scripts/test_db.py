import asyncio
import selectors
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


import asyncio
from sqlalchemy import text

from app.database.connection import engine


async def main():
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT 1"))
        print("DB OK", result.scalar())


if __name__ == "__main__":
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        loop.run_until_complete(main())
        loop.close()
    else:
        asyncio.run(main())
