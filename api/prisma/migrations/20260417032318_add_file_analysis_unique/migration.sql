/*
  Warnings:

  - A unique constraint covering the columns `[repoId,filePath]` on the table `FileAnalysis` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FileAnalysis_repoId_filePath_key" ON "FileAnalysis"("repoId", "filePath");
