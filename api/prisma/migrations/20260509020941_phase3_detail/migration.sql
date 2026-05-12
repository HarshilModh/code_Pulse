-- CreateTable
CREATE TABLE "FunctionMetric" (
    "id" TEXT NOT NULL,
    "fileAnalysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "cyclomatic" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FunctionMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoSettings" (
    "repoId" TEXT NOT NULL,
    "driftThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.72,
    "digestCadence" TEXT NOT NULL DEFAULT 'weekly',
    "digestRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alertRules" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepoSettings_pkey" PRIMARY KEY ("repoId")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "filePath" TEXT,
    "line" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "snoozedUntil" TIMESTAMP(3),
    "dismissReason" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingComment" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunctionMetric_fileAnalysisId_idx" ON "FunctionMetric"("fileAnalysisId");

-- CreateIndex
CREATE INDEX "Finding_repoId_status_idx" ON "Finding"("repoId", "status");

-- CreateIndex
CREATE INDEX "Finding_repoId_type_idx" ON "Finding"("repoId", "type");

-- AddForeignKey
ALTER TABLE "FunctionMetric" ADD CONSTRAINT "FunctionMetric_fileAnalysisId_fkey" FOREIGN KEY ("fileAnalysisId") REFERENCES "FileAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoSettings" ADD CONSTRAINT "RepoSettings_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingComment" ADD CONSTRAINT "FindingComment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
