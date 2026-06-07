/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "FileAnalysis" ADD COLUMN     "clusterId" TEXT;

-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "lastClusteredCommit" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planActiveUntil" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "centroid" vector(1536) NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cluster_repoId_snapshotId_idx" ON "Cluster"("repoId", "snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "FileAnalysis" ADD CONSTRAINT "FileAnalysis_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
