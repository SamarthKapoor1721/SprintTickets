-- Add password reset fields to users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "reset_password_token" TEXT,
  ADD COLUMN IF NOT EXISTS "reset_password_token_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_reset_password_token_key" ON "users"("reset_password_token");
