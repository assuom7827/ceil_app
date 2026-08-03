-- CreateTable
CREATE TABLE "session_agents" (
    "id" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_agents_userId_idx" ON "session_agents"("userId");

-- CreateIndex
CREATE INDEX "session_agents_trainingSessionId_idx" ON "session_agents"("trainingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "session_agents_trainingSessionId_userId_key" ON "session_agents"("trainingSessionId", "userId");

-- AddForeignKey
ALTER TABLE "session_agents" ADD CONSTRAINT "session_agents_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_agents" ADD CONSTRAINT "session_agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_agents" ADD CONSTRAINT "session_agents_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
