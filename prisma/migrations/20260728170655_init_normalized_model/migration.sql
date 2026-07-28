-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TeacherType" AS ENUM ('VACATAIRE', 'PERMANENT');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('WOMAN', 'MAN');

-- CreateEnum
CREATE TYPE "WorkflowState" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('SESSION', 'EXAM');

-- CreateEnum
CREATE TYPE "EnrollmentKind" AS ENUM ('NEW', 'RETURNING');

-- CreateEnum
CREATE TYPE "ReceiptState" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "arName" TEXT,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherType" "TeacherType" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "minimumPoints" INTEGER NOT NULL,
    "maximumPoints" INTEGER NOT NULL,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diploma_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "universityLogo" TEXT,
    "associationLogo" TEXT,
    "backgroundImage" TEXT,
    "heading" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diploma_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" TEXT NOT NULL,
    "frName" TEXT NOT NULL,
    "arName" TEXT,
    "code" TEXT,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "type" "ParticipantType" NOT NULL DEFAULT 'STUDENT',
    "familyName" TEXT,
    "firstName" TEXT,
    "arabName" TEXT,
    "arabFirstName" TEXT,
    "registrationNumber" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "arabBirthPlace" TEXT,
    "birthDateIsApproximate" BOOLEAN NOT NULL DEFAULT false,
    "approximateBirth" TEXT,
    "gender" "Gender",
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "facultyId" TEXT,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "academicYear" TEXT,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "admissionThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "matriculePrefix" TEXT,
    "state" "WorkflowState" NOT NULL DEFAULT 'OPEN',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainingId" TEXT NOT NULL,
    "trainingLevelId" TEXT,
    "diplomaModelId" TEXT,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupType" "GroupType" NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "site" TEXT,
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "hourlyVolume" INTEGER,
    "capacity" INTEGER,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainingSessionId" TEXT,
    "teacherId" TEXT,

    CONSTRAINT "student_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "kind" "EnrollmentKind" NOT NULL DEFAULT 'NEW',
    "registrationNumber" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "participantId" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "assignedLevelId" TEXT,
    "sessionGroupId" TEXT,
    "examGroupId" TEXT,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positioning_tests" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "date" TIMESTAMP(3),
    "state" "WorkflowState" NOT NULL DEFAULT 'OPEN',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainingId" TEXT NOT NULL,
    "diplomaModelId" TEXT,

    CONSTRAINT "positioning_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positioning_scores" (
    "id" TEXT NOT NULL,
    "writtenExpression" DOUBLE PRECISION,
    "writtenComprehension" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "positioningTestId" TEXT NOT NULL,

    CONSTRAINT "positioning_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliberation_entries" (
    "id" TEXT NOT NULL,
    "oralExpression" DOUBLE PRECISION,
    "writtenExpression" DOUBLE PRECISION,
    "oralComprehension" DOUBLE PRECISION,
    "writtenComprehension" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enrollmentId" TEXT NOT NULL,

    CONSTRAINT "deliberation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "state" "ReceiptState" NOT NULL DEFAULT 'DRAFT',
    "paymentDate" TIMESTAMP(3),
    "amount" DECIMAL(10,2) NOT NULL,
    "memo" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "participantId" TEXT NOT NULL,
    "trainingSessionId" TEXT,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_counters" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TrainingToTrainingLevel" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TrainingToTrainingLevel_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ParticipantToStudentCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ParticipantToStudentCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "faculties_name_key" ON "faculties"("name");

-- CreateIndex
CREATE INDEX "faculties_disabled_idx" ON "faculties"("disabled");

-- CreateIndex
CREATE INDEX "specialities_disabled_idx" ON "specialities"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "specialities_name_key" ON "specialities"("name");

-- CreateIndex
CREATE INDEX "teachers_disabled_idx" ON "teachers"("disabled");

-- CreateIndex
CREATE INDEX "teachers_teacherType_idx" ON "teachers"("teacherType");

-- CreateIndex
CREATE UNIQUE INDEX "student_categories_name_key" ON "student_categories"("name");

-- CreateIndex
CREATE INDEX "student_categories_disabled_idx" ON "student_categories"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "training_levels_name_key" ON "training_levels"("name");

-- CreateIndex
CREATE INDEX "training_levels_sequence_idx" ON "training_levels"("sequence");

-- CreateIndex
CREATE INDEX "training_levels_disabled_idx" ON "training_levels"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "diploma_models_name_key" ON "diploma_models"("name");

-- CreateIndex
CREATE INDEX "diploma_models_isDefault_idx" ON "diploma_models"("isDefault");

-- CreateIndex
CREATE INDEX "diploma_models_disabled_idx" ON "diploma_models"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "trainings_code_key" ON "trainings"("code");

-- CreateIndex
CREATE INDEX "trainings_disabled_idx" ON "trainings"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "trainings_frName_key" ON "trainings"("frName");

-- CreateIndex
CREATE UNIQUE INDEX "participants_registrationNumber_key" ON "participants"("registrationNumber");

-- CreateIndex
CREATE INDEX "participants_familyName_firstName_idx" ON "participants"("familyName", "firstName");

-- CreateIndex
CREATE INDEX "participants_type_idx" ON "participants"("type");

-- CreateIndex
CREATE INDEX "participants_facultyId_idx" ON "participants"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "training_sessions_code_key" ON "training_sessions"("code");

-- CreateIndex
CREATE INDEX "training_sessions_trainingId_idx" ON "training_sessions"("trainingId");

-- CreateIndex
CREATE INDEX "training_sessions_trainingLevelId_idx" ON "training_sessions"("trainingLevelId");

-- CreateIndex
CREATE INDEX "training_sessions_academicYear_idx" ON "training_sessions"("academicYear");

-- CreateIndex
CREATE INDEX "training_sessions_state_idx" ON "training_sessions"("state");

-- CreateIndex
CREATE INDEX "training_sessions_disabled_idx" ON "training_sessions"("disabled");

-- CreateIndex
CREATE INDEX "student_groups_trainingSessionId_groupType_idx" ON "student_groups"("trainingSessionId", "groupType");

-- CreateIndex
CREATE INDEX "student_groups_isTemplate_groupType_sequence_idx" ON "student_groups"("isTemplate", "groupType", "sequence");

-- CreateIndex
CREATE INDEX "student_groups_disabled_idx" ON "student_groups"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_registrationNumber_key" ON "enrollments"("registrationNumber");

-- CreateIndex
CREATE INDEX "enrollments_trainingSessionId_idx" ON "enrollments"("trainingSessionId");

-- CreateIndex
CREATE INDEX "enrollments_participantId_idx" ON "enrollments"("participantId");

-- CreateIndex
CREATE INDEX "enrollments_sessionGroupId_idx" ON "enrollments"("sessionGroupId");

-- CreateIndex
CREATE INDEX "enrollments_examGroupId_idx" ON "enrollments"("examGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_participantId_trainingSessionId_key" ON "enrollments"("participantId", "trainingSessionId");

-- CreateIndex
CREATE INDEX "positioning_tests_trainingId_idx" ON "positioning_tests"("trainingId");

-- CreateIndex
CREATE INDEX "positioning_tests_state_idx" ON "positioning_tests"("state");

-- CreateIndex
CREATE INDEX "positioning_tests_disabled_idx" ON "positioning_tests"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "positioning_scores_enrollmentId_key" ON "positioning_scores"("enrollmentId");

-- CreateIndex
CREATE INDEX "positioning_scores_positioningTestId_idx" ON "positioning_scores"("positioningTestId");

-- CreateIndex
CREATE UNIQUE INDEX "deliberation_entries_enrollmentId_key" ON "deliberation_entries"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receiptNumber_key" ON "payment_receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "payment_receipts_participantId_idx" ON "payment_receipts"("participantId");

-- CreateIndex
CREATE INDEX "payment_receipts_trainingSessionId_idx" ON "payment_receipts"("trainingSessionId");

-- CreateIndex
CREATE INDEX "payment_receipts_state_idx" ON "payment_receipts"("state");

-- CreateIndex
CREATE INDEX "payment_receipts_disabled_idx" ON "payment_receipts"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_counters_scope_key" ON "sequence_counters"("scope");

-- CreateIndex
CREATE INDEX "_TrainingToTrainingLevel_B_index" ON "_TrainingToTrainingLevel"("B");

-- CreateIndex
CREATE INDEX "_ParticipantToStudentCategory_B_index" ON "_ParticipantToStudentCategory"("B");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_trainingLevelId_fkey" FOREIGN KEY ("trainingLevelId") REFERENCES "training_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_diplomaModelId_fkey" FOREIGN KEY ("diplomaModelId") REFERENCES "diploma_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_assignedLevelId_fkey" FOREIGN KEY ("assignedLevelId") REFERENCES "training_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sessionGroupId_fkey" FOREIGN KEY ("sessionGroupId") REFERENCES "student_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_examGroupId_fkey" FOREIGN KEY ("examGroupId") REFERENCES "student_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positioning_tests" ADD CONSTRAINT "positioning_tests_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positioning_tests" ADD CONSTRAINT "positioning_tests_diplomaModelId_fkey" FOREIGN KEY ("diplomaModelId") REFERENCES "diploma_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positioning_scores" ADD CONSTRAINT "positioning_scores_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positioning_scores" ADD CONSTRAINT "positioning_scores_positioningTestId_fkey" FOREIGN KEY ("positioningTestId") REFERENCES "positioning_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliberation_entries" ADD CONSTRAINT "deliberation_entries_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TrainingToTrainingLevel" ADD CONSTRAINT "_TrainingToTrainingLevel_A_fkey" FOREIGN KEY ("A") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TrainingToTrainingLevel" ADD CONSTRAINT "_TrainingToTrainingLevel_B_fkey" FOREIGN KEY ("B") REFERENCES "training_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantToStudentCategory" ADD CONSTRAINT "_ParticipantToStudentCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantToStudentCategory" ADD CONSTRAINT "_ParticipantToStudentCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "student_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
