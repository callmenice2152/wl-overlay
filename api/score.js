import fs from 'fs';
import path from 'path';

// Memory fallback store with cold-start detection
let inMemoryScore = { win: 0, loss: 0, initialized: false, version: 0 };

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_FILE = path.join('/tmp', 'wl_score.json');

async function getScore() {
  if (KV_URL && KV_TOKEN) {
    try {
      const res = await fetch(`${KV_URL}/get/wl_score`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: 'no-store'
      });
      const data = await res.json();
      if (data && data.result !== undefined && data.result !== null) {
        const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        if (parsed && typeof parsed.win === 'number') {
          inMemoryScore = { ...parsed, initialized: true };
          return inMemoryScore;
        }
      }
    } catch (e) {
      console.error('KV get error:', e);
    }
  }

  try {
    if (fs.existsSync(LOCAL_FILE)) {
      const content = fs.readFileSync(LOCAL_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.win === 'number') {
        inMemoryScore = { ...parsed, initialized: true };
        return inMemoryScore;
      }
    }
  } catch (e) {}

  return inMemoryScore;
}

async function saveScore(score) {
  inMemoryScore = score;

  if (KV_URL && KV_TOKEN) {
    try {
      await fetch(`${KV_URL}/set/wl_score/${encodeURIComponent(JSON.stringify(score))}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
    } catch (e) {
      console.error('KV set error:', e);
    }
  }

  try {
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(score));
  } catch (e) {}
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  let currentScore = await getScore();

  if (req.method === 'GET') {
    return res.status(200).json(currentScore);
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const action = (body && body.action) || (req.query && req.query.action);
    const clientVersion = (body && body.version) || Date.now();

    let score = { ...currentScore };

    if (action === 'win_plus') {
      score.win += 1;
      score.initialized = true;
      score.version = Date.now();
    } else if (action === 'win_minus') {
      score.win = Math.max(0, score.win - 1);
      score.initialized = true;
      score.version = Date.now();
    } else if (action === 'loss_plus') {
      score.loss += 1;
      score.initialized = true;
      score.version = Date.now();
    } else if (action === 'loss_minus') {
      score.loss = Math.max(0, score.loss - 1);
      score.initialized = true;
      score.version = Date.now();
    } else if (action === 'reset') {
      score = { win: 0, loss: 0, initialized: true, version: Date.now() };
    } else if (action === 'sync') {
      if (body && typeof body.win === 'number' && typeof body.loss === 'number') {
        if (!currentScore.initialized || clientVersion >= (currentScore.version || 0)) {
          score = {
            win: Math.max(0, body.win),
            loss: Math.max(0, body.loss),
            initialized: true,
            version: clientVersion || Date.now()
          };
        }
      }
    }

    await saveScore(score);
    return res.status(200).json(score);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
