CREATE TABLE IF NOT EXISTS "event_collaborator" (
  "id" VARCHAR(255) PRIMARY KEY,
  "created_at" TIMESTAMP(6),
  "event_id" BIGINT,
  "user_id" BIGINT
);