-- Keep the checked-in baseline compatible with the current Prisma schema and
-- add the Jira-style work tracking tables/fields.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'super_admin';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done');
  END IF;
END $$;

ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'backlog';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'blocked';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskPriority') THEN
    CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SprintStatus') THEN
    CREATE TYPE "SprintStatus" AS ENUM ('planned', 'active', 'completed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskIssueType') THEN
    CREATE TYPE "TaskIssueType" AS ENUM ('story', 'task', 'bug', 'epic');
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "hashed_password" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_token" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_onboarding_token_key" ON "users"("onboarding_token");

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "issue_type" "TaskIssueType" NOT NULL DEFAULT 'task',
  "status" "TaskStatus" NOT NULL DEFAULT 'todo',
  "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
  "project_id" INTEGER NOT NULL,
  "sprint_id" INTEGER,
  "assignee_id" INTEGER,
  "creator_id" INTEGER NOT NULL,
  "due_date" DATE,
  "estimate_minutes" INTEGER,
  "logged_minutes" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "issue_type" "TaskIssueType" NOT NULL DEFAULT 'task';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "sprint_id" INTEGER;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "due_date" DATE;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimate_minutes" INTEGER;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "logged_minutes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "daily_progress_reports" (
  "id" SERIAL NOT NULL,
  "content" TEXT NOT NULL,
  "yesterday" TEXT,
  "today" TEXT,
  "blockers" TEXT,
  "minutes_spent" INTEGER,
  "date" DATE NOT NULL,
  "submitter_id" INTEGER NOT NULL,
  "project_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  CONSTRAINT "daily_progress_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "daily_progress_reports" ADD COLUMN IF NOT EXISTS "yesterday" TEXT;
ALTER TABLE "daily_progress_reports" ADD COLUMN IF NOT EXISTS "today" TEXT;
ALTER TABLE "daily_progress_reports" ADD COLUMN IF NOT EXISTS "blockers" TEXT;
ALTER TABLE "daily_progress_reports" ADD COLUMN IF NOT EXISTS "minutes_spent" INTEGER;

CREATE TABLE IF NOT EXISTS "sprints" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "status" "SprintStatus" NOT NULL DEFAULT 'planned',
  "start_date" DATE,
  "end_date" DATE,
  "project_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" SERIAL NOT NULL,
  "content" TEXT NOT NULL,
  "task_id" INTEGER NOT NULL,
  "author_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "daily_progress_report_tasks" (
  "report_id" INTEGER NOT NULL,
  "task_id" INTEGER NOT NULL,
  CONSTRAINT "daily_progress_report_tasks_pkey" PRIMARY KEY ("report_id", "task_id")
);

DO $$
BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_id_fkey"
    FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_fkey"
    FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "daily_progress_reports" ADD CONSTRAINT "daily_progress_reports_submitter_id_fkey"
    FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "daily_progress_reports" ADD CONSTRAINT "daily_progress_reports_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "daily_progress_report_tasks" ADD CONSTRAINT "daily_progress_report_tasks_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "daily_progress_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "daily_progress_report_tasks" ADD CONSTRAINT "daily_progress_report_tasks_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX IF NOT EXISTS "tasks_sprint_id_idx" ON "tasks"("sprint_id");
CREATE INDEX IF NOT EXISTS "tasks_assignee_id_idx" ON "tasks"("assignee_id");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks"("due_date");
CREATE INDEX IF NOT EXISTS "daily_progress_reports_submitter_id_idx" ON "daily_progress_reports"("submitter_id");
CREATE INDEX IF NOT EXISTS "daily_progress_reports_project_id_idx" ON "daily_progress_reports"("project_id");
CREATE INDEX IF NOT EXISTS "daily_progress_reports_date_idx" ON "daily_progress_reports"("date");
CREATE INDEX IF NOT EXISTS "sprints_project_id_idx" ON "sprints"("project_id");
CREATE INDEX IF NOT EXISTS "sprints_status_idx" ON "sprints"("status");
CREATE INDEX IF NOT EXISTS "task_comments_task_id_idx" ON "task_comments"("task_id");
