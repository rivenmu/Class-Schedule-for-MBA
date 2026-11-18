// 学习页云同步自检: 组织声明 + 整份覆盖 + 100KB 上限 + 公开在线人数。
// 假 pool 跑全, 不碰真库。跑: npm test
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { orgOk } = require('./auth');
const { makeStudyRouter, makePresenceRouter, MAX_STUDY_BYTES } = require('./study');

function fakePool() {
  const progress = new Map();
  const presence = new Map();
  return {
    progress,
    presence,
    async query(sql, p) {
      if (sql.startsWith('SELECT username, data, updated_at FROM study_progress')) {
        const row = progress.get(p[0]);
        return { rows: row ? [{ username: p[0], data: row.data, updated_at: row.updated_at }] : [] };
      }
      if (sql.startsWith('INSERT INTO study_progress')) {
        const at = new Date().toISOString();
        progress.set(p[0], { data: JSON.parse(p[1]), updated_at: at });
        return { rows: [{ updated_at: at }] };
      }
      if (sql.startsWith('INSERT INTO study_presence')) {
        presence.set(p[0], new Date().toISOString());
        return { rows: [] };
      }
      if (sql.startsWith('DELETE FROM study_presence')) return { rows: [] };
      if (sql.startsWith('SELECT count(*)::int AS n FROM study_presence')) {
        return { rows: [{ n: presence.size }] };
      }
      throw new Error('unexpected sql: ' + sql);
    },
  };
}

function appWithStudy(pool, name) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => { req.userSub = 'sub-1'; req.userName = name; next(); });
  app.use('/api/study', makeStudyRouter(pool));
  return app;
}

function appWithOnline(pool) {
  const app = express();
  app.use('/api/study/online', makePresenceRouter(pool));
  return app;
}

async function withServer(app, fn) {
  const srv = app.listen(0);
  try { return await fn(`http://127.0.0.1:${srv.address().port}`); }
  finally { await new Promise(r => { srv.closeAllConnections(); srv.close(r); }); }
}

test('orgOk: 只认目标组织 ID', () => {
  assert.equal(orgOk({ organizations: ['a1fmpcvuzkg0'] }, 'a1fmpcvuzkg0'), true);
  assert.equal(orgOk({ organizations: ['9ohggsux2alx'] }, 'a1fmpcvuzkg0'), false);
  assert.equal(orgOk({}, 'a1fmpcvuzkg0'), false);
  assert.equal(orgOk(null, 'a1fmpcvuzkg0'), false);
});

test('progress: 空 -> 覆盖 -> 回读, 按 username 比对', async () => {
  const pool = fakePool();
  await withServer(appWithStudy(pool, 'alice'), async (base) => {
    const empty = await (await fetch(`${base}/api/study/progress`)).json();
    assert.equal(empty.data, null);
    assert.equal(empty.user, 'alice');

    const post = await fetch(`${base}/api/study/progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { v: 2, xp: 30 } }),
    });
    assert.equal(post.status, 200);

    const back = await (await fetch(`${base}/api/study/progress`)).json();
    assert.deepEqual(back.data, { v: 2, xp: 30 });
    assert.equal(back.user, 'alice');
  });
});

test('progress: 超 100KB -> 413', async () => {
  const pool = fakePool();
  const big = { blob: 'x'.repeat(MAX_STUDY_BYTES) };
  await withServer(appWithStudy(pool, 'alice'), async (base) => {
    const r = await fetch(`${base}/api/study/progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: big }),
    });
    assert.equal(r.status, 413);
  });
});

test('online: 公开可调, 返回窗口内人数', async () => {
  const pool = fakePool();
  pool.presence.set('v1', new Date().toISOString());
  await withServer(appWithOnline(pool), async (base) => {
    const r = await fetch(`${base}/api/study/online?id=v2`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.window_minutes, 5);
    assert.equal(j.online, 2);
  });
});
