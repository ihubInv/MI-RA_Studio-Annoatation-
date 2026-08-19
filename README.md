# MI-RA Studio

**Universal Multimodal Annotation & Dataset Intelligence Platform**  
*Built by MI-RA Lab*

---

## Overview

MI-RA Studio is a research-grade, extensible annotation platform supporting image, video, audio, text, documents, pose, LiDAR, medical, geospatial, and multimodal data.

**Local-first:** run on your machine with **no Docker**. Database lives on **Supabase Postgres**.

---

## Quick Start (Local + Supabase)

### Prerequisites

| Tool | Purpose |
|---|---|
| Node.js 20+ | Frontend (Vite) |
| Python 3.11+ | Backend (FastAPI) |
| Redis | Celery queue (Memurai on Windows, or WSL) |
| Supabase account | Hosted Postgres + optional Storage |

### 1. Configure environment

```powershell
cd mi-ra-studio
.\scripts\setup-local.ps1
```

Edit `.env` and set your **Supabase database password**:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_DB_PASSWORD@db.bythpdyeveywebbhvwbf.supabase.co:5432/postgres?sslmode=require
```

Get the password from: **Supabase Dashboard → Project Settings → Database**.

### 2. Enable Postgres extensions

In Supabase **SQL Editor**, run:

```powershell
# contents of scripts/setup-supabase.sql
```

### 3. Start services (3 terminals)

```powershell
# Terminal 1 — API (creates tables on first run)
.\scripts\dev-backend.ps1

# Terminal 2 — UI
.\scripts\dev-frontend.ps1

# Terminal 3 — background workers (optional; needs Redis)
.\scripts\dev-worker.ps1
```

### 4. Open the platform

| Service | URL |
|---|---|
| MI-RA Studio UI | http://localhost:5173 |
| API (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

### 5. Seed demo data (optional)

```powershell
.\scripts\seed-local.ps1
# admin@mira-lab.ai / admin1234
```

### 6. Run migrations (when Alembic revisions exist)

```powershell
.\scripts\migrate.ps1
```

---

## Architecture

```
mi-ra-studio/
├── frontend/        React + TypeScript + Vite
├── backend/         FastAPI + SQLAlchemy + Celery
├── ai-services/     PyTorch AI workers (optional phase)
├── database/        Supabase SQL helpers
├── scripts/         Local dev PowerShell scripts
├── data/            Local media storage (gitignored)
└── tests/
```

**What runs where**

| Component | Location |
|---|---|
| Frontend, Backend, Redis, Celery | Your PC |
| PostgreSQL + pgvector | Supabase (cloud) |
| Media files | `./data/` (default) or Supabase Storage |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | FastAPI + Python 3.11+ |
| Database | **Supabase Postgres** + pgvector |
| Cache/Queue | Redis (local) |
| Workers | Celery (local) |
| Object Storage | Local `./data` (dev) / Supabase Storage (optional) |

---

## Environment variables

See `.env.example` and `frontend/.env.example`.

**Never commit** `.env` or `frontend/.env.local`.

---

## Docker (optional, not required)

`docker-compose.yml` remains for teams that want containers, but **local development does not require Docker**.

---

## License

MIT © MI-RA Lab
