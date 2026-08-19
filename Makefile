# MI-RA Studio Makefile
# Local-first targets (no Docker required). Docker targets kept as optional.

.PHONY: help setup dev-backend dev-frontend dev-worker migrate seed test

PYTHON = backend/.venv/Scripts/python
PIP = backend/.venv/Scripts/pip
UVICORN = backend/.venv/Scripts/uvicorn
CELERY = backend/.venv/Scripts/celery
ALEMBIC = backend/.venv/Scripts/alembic

help:
	@echo ""
	@echo "  MI-RA Studio — Local Development"
	@echo "  ─────────────────────────────────────────"
	@echo "  make setup         One-time local setup"
	@echo "  make dev-backend   Start FastAPI (port 8000)"
	@echo "  make dev-frontend  Start Vite (port 5173)"
	@echo "  make dev-worker    Start Celery worker"
	@echo "  make migrate       Run Alembic migrations"
	@echo "  make seed          Seed demo data"
	@echo ""

setup:
	python -m venv backend/.venv
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements-core.txt
	cd frontend && npm install

dev-backend:
	cd backend && set PYTHONPATH=.&& $(UVICORN) app.main:app --reload --host 127.0.0.1 --port 8000

dev-frontend:
	cd frontend && npm run dev

dev-worker:
	cd backend && set PYTHONPATH=.&& $(CELERY) -A app.workers.celery_app worker -l info

migrate:
	cd backend && set PYTHONPATH=.&& $(ALEMBIC) upgrade head

seed:
	cd backend && set PYTHONPATH=.&& $(PYTHON) ../scripts/seed.py

test:
	cd backend && set PYTHONPATH=.&& $(PYTHON) -m pytest -v ../tests
