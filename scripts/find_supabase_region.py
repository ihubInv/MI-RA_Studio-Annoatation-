import asyncio
import selectors
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import psycopg

REGIONS = [
    "us-east-1",
    "us-west-1",
    "us-west-2",
    "eu-west-1",
    "eu-west-2",
    "eu-central-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-south-1",
    "sa-east-1",
    "ca-central-1",
]

PASSWORD = "MiraStudio@123"
PROJECT = "bythpdyeveywebbhvwbf"


def try_region(region: str, port: int = 5432) -> bool:
    host = f"aws-0-{region}.pooler.supabase.com"
    user = f"postgres.{PROJECT}"
    conninfo = (
        f"host={host} port={port} dbname=postgres user={user} password={PASSWORD} sslmode=require"
    )
    try:
        with psycopg.connect(conninfo, connect_timeout=8) as conn:
            row = conn.execute("SELECT 1").fetchone()
            print(f"SUCCESS region={region} port={port} result={row}")
            return True
    except Exception as exc:
        print(f"FAIL region={region} port={port}: {exc.__class__.__name__}: {str(exc)[:120]}")
        return False


if __name__ == "__main__":
    for region in REGIONS:
        if try_region(region, 5432):
            break
    else:
        print("No working region found on port 5432")
        for region in REGIONS:
            if try_region(region, 6543):
                break
