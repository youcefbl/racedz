-- Organizer-configurable race shirt: when enabled, runners pick a size at registration.
ALTER TABLE "RaceEvent" ADD COLUMN "shirtEnabled" BOOLEAN NOT NULL DEFAULT false;
