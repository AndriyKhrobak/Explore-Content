-- AlterTable
ALTER TABLE "Upload" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Upload_status_scheduledAt_idx" ON "Upload"("status", "scheduledAt");
