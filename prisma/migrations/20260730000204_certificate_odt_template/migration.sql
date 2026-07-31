-- CreateEnum
CREATE TYPE "DocumentTemplateKind" AS ENUM ('CERTIFICATE');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "kind" "DocumentTemplateKind" NOT NULL DEFAULT 'CERTIFICATE',
    "fileName" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "diplomaModelId" TEXT NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_diplomaModelId_kind_key" ON "document_templates"("diplomaModelId", "kind");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_diplomaModelId_fkey" FOREIGN KEY ("diplomaModelId") REFERENCES "diploma_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

