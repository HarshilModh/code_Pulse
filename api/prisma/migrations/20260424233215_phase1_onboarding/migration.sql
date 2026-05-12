/*
  Warnings:

  - A unique constraint covering the columns `[userId,githubRepoId]` on the table `Repo` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clerkId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Repo_githubRepoId_key";

-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "defaultBranch" TEXT NOT NULL DEFAULT 'main',
ADD COLUMN     "isPublicDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'github_app',
ALTER COLUMN "installationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkId" TEXT,
ADD COLUMN     "githubLogin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Repo_userId_githubRepoId_key" ON "Repo"("userId", "githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- AddForeignKey
ALTER TABLE "FileAnalysis" ADD CONSTRAINT "FileAnalysis_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
