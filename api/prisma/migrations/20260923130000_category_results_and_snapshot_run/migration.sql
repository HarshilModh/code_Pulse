-- CreateEnum
CREATE TYPE "AnalysisCategory" AS ENUM ('complexity', 'deadcode', 'vuln', 'coverage', 'drift');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "AnalysisRun" ADD COLUMN     "prCommentClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "runId" TEXT;

-- CreateTable
CREATE TABLE "CategoryResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "category" "AnalysisCategory" NOT NULL,
    "status" "CategoryStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "report" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryResult_runId_category_key" ON "CategoryResult"("runId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_runId_key" ON "Snapshot"("runId");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryResult" ADD CONSTRAINT "CategoryResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

