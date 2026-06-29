-- Store the human-readable error detail (not just the code) for failed AI requests,
-- so the admin dashboard can surface what went wrong for audio and text alike.
ALTER TABLE "AiUsageLog" ADD COLUMN "errorMessage" TEXT;
