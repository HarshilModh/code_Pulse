import { Octokit } from "@octokit/rest";

let _octokit = null;
function getOctokit() {
    if (!_octokit) {
        _octokit = new Octokit(
            process.env.GITHUB_PUBLIC_PAT
                ? { auth: process.env.GITHUB_PUBLIC_PAT }
                : {}
        );
    }
    return _octokit;
}
const octokit = new Proxy({}, { get: (_, prop) => getOctokit()[prop] });

export async function getPublicFileContent(owner, repo, filePath, ref) {
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref,
        });
        return Buffer.from(data.content, 'base64').toString('utf8');
    } catch (err) {
        if (err.status === 404) return null;
        throw err;
    }
}

export async function getPublicRepoTree(owner, repo, ref) {
    const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: ref,
        recursive: '1',
    });
    return data.tree.filter(item => item.type === 'blob').map(item => item.path);
}

export async function getPublicHeadSha(owner, repo) {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    const { data: branchData } = await octokit.rest.repos.getBranch({ owner, repo, branch: defaultBranch });
    return { sha: branchData.commit.sha, defaultBranch };
}

