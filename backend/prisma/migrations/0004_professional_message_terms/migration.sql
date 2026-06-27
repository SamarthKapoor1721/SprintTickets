-- Rename generic tables to business-specific names.

ALTER TABLE "comments" RENAME TO "review_comments";
ALTER TABLE "review_comments" RENAME CONSTRAINT "comments_pkey" TO "review_comments_pkey";
ALTER TABLE "review_comments" RENAME CONSTRAINT "comments_review_request_id_fkey" TO "review_comments_review_request_id_fkey";
ALTER TABLE "review_comments" RENAME CONSTRAINT "comments_author_id_fkey" TO "review_comments_author_id_fkey";

ALTER TABLE "messages" RENAME TO "direct_messages";
ALTER TABLE "direct_messages" RENAME CONSTRAINT "messages_pkey" TO "direct_messages_pkey";
ALTER TABLE "direct_messages" RENAME CONSTRAINT "messages_sender_id_fkey" TO "direct_messages_sender_id_fkey";
ALTER TABLE "direct_messages" RENAME CONSTRAINT "messages_recipient_id_fkey" TO "direct_messages_recipient_id_fkey";

ALTER INDEX "messages_sender_id_idx" RENAME TO "direct_messages_sender_id_idx";
ALTER INDEX "messages_recipient_id_idx" RENAME TO "direct_messages_recipient_id_idx";

CREATE INDEX "review_comments_review_request_id_created_at_id_idx"
  ON "review_comments"("review_request_id", "created_at", "id");

CREATE INDEX "direct_messages_sender_id_recipient_id_created_at_id_idx"
  ON "direct_messages"("sender_id", "recipient_id", "created_at", "id");

CREATE INDEX "direct_messages_recipient_id_sender_id_created_at_id_idx"
  ON "direct_messages"("recipient_id", "sender_id", "created_at", "id");
