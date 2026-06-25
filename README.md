# Executive Review Hub (ERH)

**Executive Review Hub** is an internal enterprise web platform designed to streamline and formalize project review requests sent to the CEO. 

By replacing ad-hoc communication (WhatsApp, Slack, hallway conversations) with a unified digital workflow, ERH provides complete transparency into the project review lifecycle, reduces backlogs, and ensures executives have all the context they need to make rapid decisions.

---

## 👥 User Roles & Capabilities

The platform is driven by a strict role-based access control system:

### 1. The CEO (System Admin)
* **Singleton Role:** There is only one CEO account in the system.
* **Capabilities:** View every project and employee, review all submissions, approve/reject requests, add comments, assign secondary reviewers, and track pending review metrics.
* **Dashboard:** A bird's-eye view of all pending, urgent, and recently approved reviews across the company.

### 2. Project Manager / Team Lead
* **Capabilities:** Create projects, add team members, review employee work before escalating it to the CEO, submit projects to the CEO, and track approval status.
* **Dashboard:** Focused on team output, pending team reviews, and tracking CEO bottlenecks.

### 3. Employee
* **Capabilities:** View assigned projects, upload deliverables (Figma, GitHub PRs, staging links), and submit milestones for review.
* **Dashboard:** Focused on personal submissions, draft reviews, and recent activity statuses.

---

## 🛠 Tech Stack & Architecture

This project is structured as a **Monorepo** containing decoupled frontend and backend services.

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Premium Dark Mode Aesthetic)
- **Components:** Shadcn UI + Radix UI
- **Animations:** Framer Motion
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI
- **Language:** Python 3.10+
- **Database:** SQLite (Local Dev) / PostgreSQL (Production)
- **ORM:** SQLAlchemy (Async) + Alembic (Migrations)
- **Auth:** JWT-based authentication (Upcoming)

---

## 🚀 Running the Project Locally

Follow these steps to spin up the entire stack on your local machine. 

### Prerequisites
- Node.js 18+
- Python 3.10+
- `uv` or `pip` package manager

### 1. Start the Backend API (FastAPI)
The backend is currently configured to use `aiosqlite` for local development, meaning no Docker container is required for the database yet.

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run database migrations to create tables
alembic upgrade head

# 5. (First run only) Seed demo accounts + sample data
python -m app.seed

# 6. Start the FastAPI development server (port 8008 to avoid 8000 conflicts)
uvicorn app.main:app --port 8008 --reload
```
*The backend API will be available at [http://127.0.0.1:8008](http://127.0.0.1:8008)*
*Interactive Swagger Documentation is available at [http://127.0.0.1:8008/docs](http://127.0.0.1:8008/docs)*

**Demo accounts** (all use password `password123`): `ceo@erh.dev`, `manager@erh.dev`, `employee@erh.dev`

### 2. Start the Frontend Application (Next.js)
Open a **new terminal window** to start the frontend.

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start the Next.js development server
npm run dev
```
*The frontend will run on [http://localhost:4321](http://localhost:4321).*

---

## 🎨 UI / Design Philosophy
The frontend utilizes a premium, "Vercel/Linear-inspired" design system:
- **Deep Dark Mode:** Enforced global dark theme using rich `oklch` color spaces.
- **Glassmorphism:** Heavy use of `backdrop-blur` and translucent cards to create depth.
- **Micro-interactions:** Staggered fade-ins and dynamic hover states powered by Framer Motion.
