/**
 * api/trigger.js — Vercel Serverless Function
 * Triggers GitHub Actions workflow via PAT
 * POST body: { suite: "api" | "ui" | "all", token: "<optional client token>" }
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { suite = 'all', token } = req.body || {};

  // Optional: protect endpoint with a client token
  const CLIENT_TOKEN = process.env.CLIENT_TOKEN;
  if (CLIENT_TOKEN && token !== CLIENT_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const PAT    = process.env.GITHUB_PAT;
  const OWNER  = process.env.GITHUB_OWNER;   // e.g. "rezaldy"
  const REPO   = process.env.GITHUB_REPO;    // e.g. "khayr-api-tests"
  const BRANCH = process.env.GITHUB_BRANCH || 'main';

  if (!PAT || !OWNER || !REPO) {
    return res.status(500).json({ error: 'Server misconfigured: missing env vars' });
  }

  const validSuites = ['api', 'ui', 'all'];
  if (!validSuites.includes(suite)) {
    return res.status(400).json({ error: `Invalid suite. Must be one of: ${validSuites.join(', ')}` });
  }

  // Map suite → workflow file(s)
  const workflowMap = {
    api: ['api-tests.yml'],
    ui:  ['ui-tests.yml'],
    all: ['api-tests.yml', 'ui-tests.yml'],
  };

  const workflows = workflowMap[suite];

  async function triggerWorkflow(workflow) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/dispatches`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: BRANCH }),
    });
    return { workflow, status: resp.status, ok: resp.ok };
  }

  try {
    const results = await Promise.all(workflows.map(triggerWorkflow));
    const allOk   = results.every(r => r.ok);

    return res.status(allOk ? 200 : 207).json({
      triggered: allOk,
      suite,
      results,
      message: allOk
        ? `✅ ${suite} test(s) triggered on branch "${BRANCH}"`
        : '⚠️ Some workflows failed to trigger',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
