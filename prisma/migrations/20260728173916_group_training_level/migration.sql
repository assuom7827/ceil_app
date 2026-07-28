-- AlterTable
ALTER TABLE "student_groups" ADD COLUMN     "trainingLevelId" TEXT;

-- CreateIndex
CREATE INDEX "student_groups_trainingSessionId_trainingLevelId_sequence_idx" ON "student_groups"("trainingSessionId", "trainingLevelId", "sequence");

-- AddForeignKey
ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_trainingLevelId_fkey" FOREIGN KEY ("trainingLevelId") REFERENCES "training_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

