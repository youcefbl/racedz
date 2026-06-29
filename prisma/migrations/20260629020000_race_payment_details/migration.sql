-- Manual payment details organizers show to runners (BaridiMob / CCP).
ALTER TABLE "RaceEvent" ADD COLUMN "baridiMobNumber" TEXT;
ALTER TABLE "RaceEvent" ADD COLUMN "ccpAccount" TEXT;
ALTER TABLE "RaceEvent" ADD COLUMN "ccpKey" TEXT;
ALTER TABLE "RaceEvent" ADD COLUMN "paymentNote" TEXT;
