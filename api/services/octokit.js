import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env from api/ regardless of where the process is started from
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../api/.env') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const githubApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, 'utf8'),
  webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET },
  Octokit: Octokit,
});

export async function getInstallationOctokit(installationId) {
  const octokit = await githubApp.getInstallationOctokit(installationId);
  console.log('[octokit] instance type:', typeof octokit, 'has rest:', !!octokit?.rest);
  return octokit;
}

export async function getFileContent(installationId, owner, repo, filePath, ref) {
  const octokit = await getInstallationOctokit(installationId);
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

export async function getRepoTree(installationId, owner, repo, ref) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: '1',
  });
  return data.tree.filter(item => item.type === 'blob').map(item => item.path);
}
