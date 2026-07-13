-- Opt-in profile privacy: hide the runner from public leaderboards, other users' feeds, and following.
ALTER TABLE "User" ADD COLUMN "profilePrivate" BOOLEAN NOT NULL DEFAULT false;
