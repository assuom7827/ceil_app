-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('PRESENTIAL', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN     "mode" "SessionMode" NOT NULL DEFAULT 'PRESENTIAL',
ADD COLUMN     "registrationEndDate" TIMESTAMP(3),
ADD COLUMN     "registrationStartDate" TIMESTAMP(3),
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "training_sessions_mode_idx" ON "training_sessions"("mode");

-- CreateIndex
CREATE INDEX "training_sessions_status_idx" ON "training_sessions"("status");
