-- Create enums
CREATE TYPE "UserRole" AS ENUM ('ceo', 'manager', 'employee');
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'completed', 'on_hold');
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');
CREATE TYPE "ReviewPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- Users
CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "hashed_password" TEXT NOT NULL,
  "full_name" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'employee',
  "department" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_full_name_idx" ON "users"("full_name");

-- Projects
CREATE TABLE "projects" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "department" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'active',
  "owner_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "projects_name_idx" ON "projects"("name");

-- Project members
CREATE TABLE "project_members" (
  "project_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id", "user_id"),
  CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Review requests
CREATE TABLE "review_requests" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "objective" TEXT,
  "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
  "priority" "ReviewPriority" NOT NULL DEFAULT 'medium',
  "review_type" TEXT,
  "website_url" TEXT,
  "github_repo" TEXT,
  "figma_link" TEXT,
  "documentation_link" TEXT,
  "tech_details" JSONB,
  "project_id" INTEGER,
  "submitter_id" INTEGER,
  "reviewer_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "review_requests_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "review_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "review_requests_title_idx" ON "review_requests"("title");

-- Comments
CREATE TABLE "comments" (
  "id" SERIAL NOT NULL,
  "content" TEXT NOT NULL,
  "review_request_id" INTEGER,
  "author_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_review_request_id_fkey" FOREIGN KEY ("review_request_id") REFERENCES "review_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Direct messages
CREATE TABLE "messages" (
  "id" SERIAL NOT NULL,
  "content" TEXT NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "recipient_id" INTEGER NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");
CREATE INDEX "messages_recipient_id_idx" ON "messages"("recipient_id");
