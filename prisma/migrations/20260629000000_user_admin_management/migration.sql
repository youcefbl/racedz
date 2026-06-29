-- Admin user management: block accounts and track sign-in activity.
ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "firstLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
