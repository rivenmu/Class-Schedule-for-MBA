// 会计练习页的云同步与在线人数。
// progress: 登录 (组织已由 auth.js 校验) 后整份 JSON 覆盖, 按 username 一行;
// online: 公开心跳, 只看最近 5 分钟, 不存 IP。
const { Router } = require('express');

const MAX_STUDY_BYTES = 100_000;
const ONLINE_WINDOW_MINUTES = 5;

function studyKey(req) {
  return req.userName || req.userSub;
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function makeStudyRouter(pool) {
  const r = Router();
  const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  r.get('/progress', ah(async (req, res) => {
    const key = studyKey(req);
    const { rows } = await pool.query(
      'SELECT username, data, updated_at FROM study_progress WHERE username=$1', [key]);
    res.set('Cache-Control', 'no-store, max-age=0');
    if (!rows.length) return res.json({ ok: true, user: key, data: null, updated_at: null });
    res.json({ ok: true, user: rows[0].username, data: rows[0].data, updated_at: rows[0].updated_at });
  }));

  r.post('/progress', ah(async (req, res) => {
    const data = req.body && req.body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ ok: false, error: 'bad_request' });
    }
    if (byteLength(data) > MAX_STUDY_BYTES) {
      return res.status(413).json({ ok: false, error: 'too_large' });
    }
    const key = studyKey(req);
    const { rows } = await pool.query(
      `INSERT INTO study_progress(username, data, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (username) DO UPDATE SET data=EXCLUDED.data, updated_at=now()
       RETURNING updated_at`,
      [key, JSON.stringify(data)]);
    res.json({ ok: true, user: key, updated_at: rows[0].updated_at });
  }));

  return r;
}

// 在线人数不需要登录: 单独挂, 不吃 requireUser。
function makePresenceRouter(pool) {
  const r = Router();
  const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  r.get('/', ah(async (req, res) => {
    const id = String(req.query.id || '').slice(0, 64);
    if (id) {
      await pool.query(
        `INSERT INTO study_presence(visitor_id, last_seen) VALUES ($1, now())
         ON CONFLICT (visitor_id) DO UPDATE SET last_seen=now()`, [id]);
    }
    // 低频清理, 避免表无限增长。
    if (Math.random() < 0.02) {
      await pool.query("DELETE FROM study_presence WHERE last_seen < now() - interval '1 day'");
    }
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM study_presence
       WHERE last_seen >= now() - ($1 || ' minutes')::interval`,
      [String(ONLINE_WINDOW_MINUTES)]);
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ online: rows[0].n, window_minutes: ONLINE_WINDOW_MINUTES });
  }));

  return r;
}

module.exports = { makeStudyRouter, makePresenceRouter, MAX_STUDY_BYTES, byteLength };
