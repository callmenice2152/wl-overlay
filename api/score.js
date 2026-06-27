// In-memory score store. No external database needed.
// Note: this resets to 0/0 whenever the serverless function "cold starts"
// (e.g. after a period of no traffic) - fine for day-to-day use where the
// score is reset every stream anyway.

let score = { win: 0, loss: 0 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    return res.status(200).json(score);
  }

  if (req.method === 'POST') {
    const action = req.body && req.body.action;

    switch (action) {
      case 'win_plus':   score.win += 1; break;
      case 'win_minus':  score.win = Math.max(0, score.win - 1); break;
      case 'loss_plus':  score.loss += 1; break;
      case 'loss_minus': score.loss = Math.max(0, score.loss - 1); break;
      case 'reset':      score = { win: 0, loss: 0 }; break;
    }

    return res.status(200).json(score);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
