# Sprint Tickets

**Sprint Tickets** is an internal enterprise web platform that streamlines and formalizes project review requests sent to the CEO.

By replacing ad-hoc communication (WhatsApp, Slack, hallway conversations) with a unified digital workflow, it provides complete transparency into the project review lifecycle, reduces backlogs, and ensures executives have all the context they need to make rapid decisions.

---

## 👥 User Roles & Capabilities

The platform is driven by a role-based access control system enforced on both the API and the UI.

### 1. The CEO (System Admin)
* View every project, team, and user across the company.
* Review all submissions: **approve / reject / request changes**, add comments, assign reviewers.
* Create and delete teams, manage any team's members.
* Direct-message any employee or manager.

### 2. Project Manager / Team Lead
* Create teams (projects) and manage their members.
* See all reviews; act on submissions (approve / reject / request changes) and comment.
* Delete teams they own.
* Message teammates and the CEO.

### 3. Employee
* View teams they belong to and submit review requests with deliverables (Figma, GitHub PRs, staging links, docs).
* Track the status of their own submissions and comment on them.
* Message teammates and the CEO.

---

## ✨ Features

- **JWT authentication** with role-based access control (CEO / Manager / Employee).
- **Teams** — every project is a team with a **lead** (owner) and members; add/remove members, view a team's reviews, delete a team.
- **Review lifecycle** — submit a review → reviewers approve / reject / request changes → threaded comments → status reflected across dashboards.
- **Role-aware dashboards** — live pending / urgent / approved metrics and activity lists computed from real data.
- **Private direct messaging** — 1:1 chat between any users (e.g. CEO ↔ employee/manager) with unread counts and live polling.
- **Light, professional UI** — Linear/Stripe-inspired light theme.

---

## 🛠 Tech Stack & Architecture

This project is a **monorepo** with decoupled frontend and backend services.

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (professional **light** theme)
- **Components:** shadcn / base-ui
- **Animations:** Framer Motion
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI
- **Language:** Python 3.10+
- **Database:** SQLite (local dev, via `aiosqlite`) / PostgreSQL (production)
- **ORM:** SQLAlchemy (Async) + Alembic (Migrations)
- **Auth:** JWT (`python-jose`) + bcrypt password hashing

### Ports
| Service | URL |
|---------|-----|
| Backend API | http://127.0.0.1:8008 (Swagger at `/docs`) |
| Frontend | http://localhost:4321 |

> Port **8008** is used (instead of 8000) to avoid clashing with other local Docker stacks.

---

## 🚀 Running the Project Locally

### Prerequisites
- Node.js 18+
- Python 3.10+

### 1. Backend (FastAPI)
The backend uses `aiosqlite` for local development — no Docker/database container required.

```bash
cd backend

# Create & activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create the database tables
alembic upgrade head

# (First run only) seed demo accounts + sample data
python -m app.seed
```

Then start it. The helper script frees the port first, so you can re-run it anytime
without "Address already in use":

```bash
./run.sh
```

<details>
<summary>Or start it manually</summary>

```bash
venv/bin/uvicorn app.main:app --port 8008 --reload
```
</details>

### 2. Frontend (Next.js)
Open a **second terminal**:

```bash
cd frontend
npm install
./run.sh        # frees port 4321 then runs `npm run dev`
```

Open **http://localhost:4321**.

### Demo accounts
All use the password **`password123`**:

| Role | Email |
|------|-------|
| CEO | `ceo@erh.dev` |
| Manager | `manager@erh.dev` |
| Employee | `employee@erh.dev` |

> Tip: to see direct messaging live, log in as the CEO in one browser and as the Employee in an incognito window.

---

## ⚙️ Configuration

Backend settings live in [`backend/app/core/config.py`](backend/app/core/config.py) and can be
overridden with a `backend/.env` file (see [`backend/.env.example`](backend/.env.example)).

> **Production note:** set a strong `SECRET_KEY` in `backend/.env` — the default in code is for local dev only.

To switch to PostgreSQL, point `SQLALCHEMY_DATABASE_URI` at your Postgres instance and run `alembic upgrade head`.

The local SQLite database (`backend/erh.db`) is git-ignored; recreate it anytime with
`alembic upgrade head && python -m app.seed`.

---

## 🎨 UI / Design Philosophy
A clean, professional **light** design system (Linear / Stripe / Vercel-inspired):
- **Light theme** built on a slate canvas with white, softly-elevated cards.
- **Trust-blue accent** (`#2563EB`) with status colors (amber = pending, emerald = approved, red = rejected, orange = needs changes).
- **Inter** typography and subtle Framer Motion micro-interactions.
