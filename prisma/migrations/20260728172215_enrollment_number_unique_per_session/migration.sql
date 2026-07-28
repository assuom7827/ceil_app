-- DropIndex
DROP INDEX "enrollments_registrationNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_trainingSessionId_registrationNumber_key" ON "enrollments"("trainingSessionId", "registrationNumber");

