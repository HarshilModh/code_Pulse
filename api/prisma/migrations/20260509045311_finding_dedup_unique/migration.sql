/*
  Warnings:

  - A unique constraint covering the columns `[repoId,type,filePath]` on the table `Finding` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Finding_repoId_type_filePath_key" ON "Finding"("repoId", "type", "filePath");
