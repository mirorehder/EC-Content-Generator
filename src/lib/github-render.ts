const WORKFLOW_FILE = "render.yml";

function getConfig() {
  const token = process.env.RENDER_GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const callbackSecret = process.env.RENDER_CALLBACK_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;

  if (!token || !owner || !repo || !callbackSecret || !appUrl) return null;
  return { token, owner, repo, callbackSecret, appUrl };
}

export function isGithubRenderConfigured(): boolean {
  return getConfig() !== null;
}

export interface GithubRenderScene {
  driveFileId: string;
  timingSeconds: number;
}

/**
 * Dispatches the render.yml workflow, which does the actual FFmpeg work on
 * a full GitHub-hosted runner (Vercel's own compute is too CPU-constrained
 * for real 4K/HEVC footage — see the workflow file for why). There's no
 * run ID returned by the dispatch API, so `renderId` is how the workflow's
 * completion callback (/api/render-callback) gets matched back to this job.
 */
export async function triggerGithubRender(
  renderId: string,
  driveAccessToken: string,
  scenes: GithubRenderScene[],
  caption: string
): Promise<void> {
  const config = getConfig();
  if (!config) {
    throw new Error("GitHub-Render ist nicht konfiguriert.");
  }

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          renderId,
          driveAccessToken,
          scenesJson: JSON.stringify(scenes),
          caption,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub Actions Dispatch fehlgeschlagen (${res.status}): ${detail}`);
  }
}
