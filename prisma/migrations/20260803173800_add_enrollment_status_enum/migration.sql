-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "enrollments" ADD COLUMN "statusChangedAt" TIMESTAMP;
ALTER TABLE "enrollments" ADD COLUMN "statusChangedBy" TEXT;
