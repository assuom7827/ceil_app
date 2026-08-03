CREATE TABLE "training_training_levels" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "trainingLevelId" TEXT NOT NULL,

    CONSTRAINT "training_training_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_training_levels_trainingId_trainingLevelId_key" ON "training_training_levels"("trainingId", "trainingLevelId");
CREATE INDEX "training_training_levels_trainingId_idx" ON "training_training_levels"("trainingId");
CREATE INDEX "training_training_levels_trainingLevelId_idx" ON "training_training_levels"("trainingLevelId");

ALTER TABLE "training_training_levels" ADD CONSTRAINT "training_training_levels_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_training_levels" ADD CONSTRAINT "training_training_levels_trainingLevelId_fkey" FOREIGN KEY ("trainingLevelId") REFERENCES "training_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy data from the implicit relation table to the explicit join table
INSERT INTO "training_training_levels" ("id", "trainingId", "trainingLevelId")
SELECT gen_random_uuid()::text, "A", "B"
FROM "_TrainingToTrainingLevel"
WHERE "A" IS NOT NULL AND "B" IS NOT NULL;

-- Drop the implicit relation table — replaced by the explicit model
DROP TABLE "_TrainingToTrainingLevel";
