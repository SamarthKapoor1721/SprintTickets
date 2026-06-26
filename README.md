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
- **Framework:** Node.js + Express
- **Language:** TypeScript
- **Database:** Neon Postgres
- **ORM / Migrations:** Prisma + SQL migration baseline
- **Auth:** JWT (`jsonwebtoken`) + bcrypt password hashing

### Ports
| Service | URL |
|---------|-----|
| Backend API | http://127.0.0.1:8008 (health at `/api/v1/status`) |
| Frontend | http://localhost:4321 |

> Port **8008** is used (instead of 8000) to avoid clashing with other local Docker stacks.

---

## 🚀 Running the Project Locally

### Prerequisites
- Node.js 20+
- npm 10+

### 1. Backend (Node.js + Neon)
The backend uses Neon Postgres directly. No local Postgres container or SQLite file is required.

```bash
cd backend

# Install dependencies
npm install

# Initialize the Neon project locally if needed
npx neonctl@latest init

# Copy backend/.env.example to backend/.env and set DATABASE_URL
# to your Neon connection string with sslmode=require.

# Apply the migration baseline and seed demo data
npm run db:migrate
npm run db:seed
```

Then start it. The helper script frees the port first, so you can re-run it anytime
without "Address already in use":

```bash
./run.sh
```

<details>
<summary>Or start it manually</summary>

```bash
npm run dev
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

Backend settings live in [`backend/.env.example`](backend/.env.example) and can be overridden with a `backend/.env` file.

Required variables:
- `DATABASE_URL` - your Neon connection string, including `sslmode=require`
- `JWT_SECRET` - a strong random secret
- `PORT` - defaults to `8008`
- `CORS_ORIGINS` - comma-separated frontend origins

The schema is defined in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) and the initial Neon migration lives in [`backend/prisma/migrations/0001_init/migration.sql`](backend/prisma/migrations/0001_init/migration.sql).

Demo data is seeded from [`backend/prisma/seed.ts`](backend/prisma/seed.ts) and is safe to rerun.

---

## 🎨 UI / Design Philosophy
A clean, professional **light** design system (Linear / Stripe / Vercel-inspired):
- **Light theme** built on a slate canvas with white, softly-elevated cards.
- **Trust-blue accent** (`#2563EB`) with status colors (amber = pending, emerald = approved, red = rejected, orange = needs changes).
- **Inter** typography and subtle Framer Motion micro-interactions.
