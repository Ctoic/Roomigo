# Roomigo Hostel Management System

Roomigo is a full-stack hostel management platform for day-to-day operations:
- Student and room management
- Monthly fee collection and fee status tracking
- Expense tracking and PDF reporting
- Employee and salary management
- Public hostel registration form with admin review workflow
- Dashboard analytics for income, expenses, occupancy, and salary totals

## Tech Stack
- Backend: Flask, Flask-Login, Flask-Migrate, SQLAlchemy, Alembic
- Frontend: Next.js (Pages Router), React, TypeScript, Tailwind CSS, Chart.js
- Database: SQLite by default (PostgreSQL-compatible via `DATABASE_URL`)
- Containers: Docker + Docker Compose

## Project Structure
```text
.
├── app.py                    # Flask app factory + API routes
├── models.py                 # SQLAlchemy models
├── migrations/               # Alembic migrations
├── hostel-frontend/          # Next.js frontend
├── Dockerfile.backend
├── docker-compose.yml
└── Readme.md
```

## Architecture Overview
- Frontend (`hostel-frontend`) calls backend APIs using bearer-token auth.
- Backend exposes auth endpoints at root (`/login`, `/check-auth`, `/logout`) and feature APIs under `/api/*`.
- Database schema is managed through Alembic migrations, while `bootstrap_data()` seeds default rooms and initial employees when explicitly invoked.
- Uploaded assets are stored in `static/uploads` (mounted to Docker volume in containerized setup).

## Quick Start (Docker)

### Prerequisites
- Docker Engine 24+
- Docker Compose v2

### Start the full stack
```bash
docker compose up --build
```

Services:
- Backend API: `http://localhost:5051`
- Frontend UI: `http://localhost:3000`

### Stop services
```bash
docker compose down
```

### Reset persistent data (destructive)
```bash
docker compose down -v
```

## Local Development (Without Docker)

### Backend
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask db upgrade
flask --app app:create_app seed-data
python app.py
```

### Frontend
```bash
cd hostel-frontend
npm install
npm run dev
```

## Environment Variables
Create a `.env` in project root (or export in shell):

```env
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=sqlite:///hostel.db
UPLOAD_FOLDER=static/uploads
RUN_SEED_DATA=true
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:5051
```

Notes:
- In Docker, `DATABASE_URL` defaults to `sqlite:////data/hostel.db`.
- Frontend code uses `NEXT_PUBLIC_API_BASE_URL` (not `NEXT_PUBLIC_API_URL`).
- For production, set `RUN_SEED_DATA=false` after the initial seed.
- For split-origin deployments, set `CORS_ORIGINS` to the exact frontend URL(s), separated by commas.

## Database Bootstrap Behavior
- `bootstrap_data()` creates default rooms `1-14` with capacity `3`.
- `bootstrap_data()` creates default rooms `15-18` with capacity `4`.
- It also seeds initial employee records.
- It does not create an initial admin account.
- In production, run it with `flask --app app:create_app seed-data` instead of relying on app startup.

## Deployment

### Railway backend
Set these Railway variables:

```env
FLASK_ENV=production
SECRET_KEY=<long-random-secret>
DATABASE_URL=<railway-postgres-url>
CORS_ORIGINS=https://your-site.netlify.app
RUN_SEED_DATA=false
```

Use this start command:

```bash
gunicorn 'app:create_app()'
```

Run these one-off commands after the first deploy:

```bash
flask --app app:create_app db upgrade
flask --app app:create_app seed-data
```

### Netlify frontend
Set the Netlify base directory to `hostel-frontend` and add:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.up.railway.app
```

The frontend now uses bearer tokens, so it does not depend on cross-site cookies.

## Create Admin User (manual)
Use a Python shell and insert an `Admin` with a bcrypt hash:

```python
from app import create_app
from models import db, Admin
from flask_bcrypt import Bcrypt

app = create_app()
bcrypt = Bcrypt(app)

with app.app_context():
    admin = Admin(
        username="admin",
        name="System Admin",
        email="admin@example.com",
        password_hash=bcrypt.generate_password_hash("change-me").decode("utf-8"),
    )
    db.session.add(admin)
    db.session.commit()
```

## API Documentation
Full API reference is available at:
- [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)

## UML Diagrams
Class, component, and sequence UML diagrams are available at:
- [`docs/UML_DIAGRAMS.md`](docs/UML_DIAGRAMS.md)

## Key API Areas
- Authentication: bearer-token login/logout/auth-check
- Dashboard analytics
- Rooms and occupancy
- Students (CRUD + bulk upload + template download)
- Fees and quick fee collection
- Expenses and monthly PDF export
- Employees and salary records
- Public registration + admin registration management
