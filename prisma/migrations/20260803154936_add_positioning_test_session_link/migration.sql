-- AlterTable
ALTER TABLE "positioning_tests" ADD COLUMN     "trainingSessionId" TEXT;

-- CreateIndex
CREATE INDEX "positioning_tests_trainingSessionId_idx" ON "positioning_tests"("trainingSessionId");

-- AddForeignKey
ALTER TABLE "positioning_tests" ADD CONSTRAINT "positioning_tests_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
