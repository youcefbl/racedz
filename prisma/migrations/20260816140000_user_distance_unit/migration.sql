-- NATRUN-06.8: account-synced distance unit preference; null means km (Algeria default).
ALTER TABLE "User" ADD COLUMN "distanceUnit" TEXT;
