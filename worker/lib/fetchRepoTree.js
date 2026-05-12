import { getRepoTree } from "../../api/services/octokit.js";
import { getPublicRepoTree } from "../../api/services/publicOctokit.js";

export async function fetchRepoTree(jobData) {
    const { source, installationId, owner, repoName, ref } = jobData;
    if (source === "github_app") {
        return getRepoTree(installationId, owner, repoName, ref);
    }
    return getPublicRepoTree(owner, repoName, ref);
}

