-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RUNNER', 'ORGANIZER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizerRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "RaceSource" AS ENUM ('ORGANIZATION', 'PLATFORM');

-- CreateEnum
CREATE TYPE "RaceType" AS ENUM ('ROAD', 'TRAIL', 'ULTRA_TRAIL', 'MARATHON', 'HALF_MARATHON', 'TEN_K', 'FIVE_K', 'KIDS', 'CHARITY', 'OTHER');

-- CreateEnum
CREATE TYPE "RaceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('NOT_OPEN', 'OPEN', 'CLOSED', 'FULL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'WAITING_LIST');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'BARIDIMOB', 'ONLINE_CARD', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "arabicFullName" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'RUNNER',
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "nationalId" TEXT,
    "avatarUrl" TEXT,
    "wilaya" TEXT,
    "city" TEXT,
    "commune" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "wilaya" TEXT,
    "city" TEXT,
    "commune" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizerRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "source" "RaceSource" NOT NULL DEFAULT 'ORGANIZATION',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "raceType" "RaceType" NOT NULL,
    "status" "RaceStatus" NOT NULL DEFAULT 'DRAFT',
    "registrationStatus" "EventRegistrationStatus" NOT NULL DEFAULT 'NOT_OPEN',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "registrationOpenAt" TIMESTAMP(3),
    "registrationCloseAt" TIMESTAMP(3),
    "wilaya" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "commune" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mainImageUrl" TEXT,
    "organizerName" TEXT,
    "organizerUrl" TEXT,
    "rules" TEXT,
    "requiredDocuments" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "maxParticipants" INTEGER,
    "availablePlaces" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceCategory" (
    "id" TEXT NOT NULL,
    "raceEventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "elevationGainM" INTEGER,
    "priceDzd" INTEGER,
    "maxParticipants" INTEGER,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "startTime" TIMESTAMP(3),
    "cutoffTimeMin" INTEGER,
    "gpxFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raceEventId" TEXT NOT NULL,
    "raceCategoryId" TEXT NOT NULL,
    "bibNumber" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "paymentProofUrl" TEXT,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "clubName" TEXT,
    "tshirtSize" TEXT,
    "medicalCertificateUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceEvent_slug_key" ON "RaceEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RaceRegistration_userId_raceCategoryId_key" ON "RaceRegistration"("userId", "raceCategoryId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEvent" ADD CONSTRAINT "RaceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceCategory" ADD CONSTRAINT "RaceCategory_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "RaceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceRegistration" ADD CONSTRAINT "RaceRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceRegistration" ADD CONSTRAINT "RaceRegistration_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "RaceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceRegistration" ADD CONSTRAINT "RaceRegistration_raceCategoryId_fkey" FOREIGN KEY ("raceCategoryId") REFERENCES "RaceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

