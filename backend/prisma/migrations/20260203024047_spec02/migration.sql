-- DropForeignKey
ALTER TABLE "WorkflowJob" DROP CONSTRAINT "WorkflowJob_runId_fkey";

-- CreateIndex
CREATE INDEX "WorkflowRun_repositoryName_idx" ON "WorkflowRun"("repositoryName");

-- CreateIndex
CREATE INDEX "WorkflowRun_startedAt_idx" ON "WorkflowRun"("startedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_completedAt_idx" ON "WorkflowRun"("completedAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- AddForeignKey
ALTER TABLE "WorkflowJob" ADD CONSTRAINT "WorkflowJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
