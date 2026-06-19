import { env } from '../config/env.js';

function parseRepo(repo) {
  const trimmed = String(repo || '').trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0) {
    throw new Error('BACKUP_GITHUB_REPO must be owner/repo');
  }
  return {
    owner: trimmed.slice(0, slash),
    repo: trimmed.slice(slash + 1),
  };
}

function isBackupConfigured() {
  return Boolean(
    env.backupEnabled &&
      env.backupGithubToken &&
      env.backupGithubRepo
  );
}

async function githubRequest(path, { method = 'GET', body } = {}) {
  const { owner, repo } = parseRepo(env.backupGithubRepo);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.backupGithubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} ${path}: ${text.slice(0, 500)}`);
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return null;
}

function toBase64Content(content) {
  if (Buffer.isBuffer(content)) {
    return content.toString('base64');
  }
  return Buffer.from(String(content), 'utf8').toString('base64');
}

/**
 * @param {{ path: string, content: Buffer|string, encoding?: 'base64'|'utf8' }[]} files
 */
export async function pushBackupFiles({ files, message }) {
  if (!isBackupConfigured()) {
    throw new Error('Backup GitHub not configured (BACKUP_ENABLED, TOKEN, REPO)');
  }

  const branch = env.backupGithubBranch || 'main';
  const results = [];

  for (const file of files) {
    const content =
      file.encoding === 'base64' && Buffer.isBuffer(file.content)
        ? file.content.toString('base64')
        : toBase64Content(file.content);

    let sha;
    try {
      const existing = await githubRequest(`${file.path}?ref=${encodeURIComponent(branch)}`);
      if (existing?.sha) sha = existing.sha;
    } catch (err) {
      if (!String(err.message).includes('404')) {
        throw err;
      }
    }

    const payload = {
      message: message || `backup: ${file.path}`,
      content,
      branch,
      ...(sha ? { sha } : {}),
    };

    const result = await githubRequest(file.path, { method: 'PUT', body: payload });
    results.push({
      path: file.path,
      sha: result?.content?.sha ?? result?.commit?.sha ?? null,
    });
  }

  return results;
}

export function backupGithubConfigured() {
  return isBackupConfigured();
}
