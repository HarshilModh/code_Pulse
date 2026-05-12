import { getFileContent } from "../../api/services/octokit.js";
import { getPublicFileContent } from "../../api/services/publicOctokit.js";
import prisma from "../../api/lib/prisma.js";
export async function fetchFile(jobData, filePath) {
    const { source, installationId, owner, repoName, ref } = jobData;
    if (source === 'github_app') {
        return getFileContent(installationId, owner, repoName, filePath, ref);
    } else {
        return getPublicFileContent(owner, repoName, filePath, ref);
    }
}
   