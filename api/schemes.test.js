// ponytail 自检: 槽位语义 + 用户隔离, 假 pool 跑全, 不碰真库。跑: npm test
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { makeSchemesRouter } = require('./schemes');

// 内存假库: rows=[{id,user_sub,name,class_id,data}]
function fakePool() {
  const rows = [];
  let n = 0;
  return {
    rows,
    async query(sql, p) {
      if (sql.startsWith('SELECT name FROM schemes')) {
        return { rows: rows.filter(r => r.user_sub === p[0]).map(r => ({ name: r.name })) };
      }
      if (sql.startsWith('SELECT id, name')) { // 列表 / 详情
        const mine = rows.filter(r => r.user_sub === (p.length === 2 ? p[1] : p[0]));
        if (p.length === 2) {
          const hit = mine.filter(r => r.id === p[0]);
          return { rows: hit.map(r => ({ id: r.id, name: r.name, classId: r.class_id, data: r.data })) };
        }
        return { rows: mine.map(r => ({ id: r.id, name: r.name, classId: r.class_id })) };
      }
      if (sql.startsWith('UPDATE schemes SET class_id')) { // POST 同名更新
        const hit = rows.filter(r => r.user_sub === p[2] && r.name === p[3]);
        if (hit.length) { hit[0].class_id = p[0]; hit[0].data = p[1]; return { rows: [{ id: hit[0].id }] }; }
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO schemes')) {
        const id = 'id' + (++n);
        rows.push({ id, user_sub: p[0], name: p[1], class_id: p[2], data: p[3] });
        return { rows: [{ id }] };
      }
      throw new Error('unexpected sql: ' + sql);
    },
  };
}

function appWith(pool, sub) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.userSub = sub; next(); }); // 绕过真验签, 只测槽位逻辑
  app.use('/api/schemes', makeSchemesRouter(pool));
  return app;
}

test('3 槽满后第 4 个新名 409 + 名单, 覆盖旧槽成功', async () => {
  const pool = fakePool();
  const app = appWith(pool, 'u1');
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/api/schemes`;
  const post = (body) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  for (const nm of ['A', 'B', 'C']) {
    const r = await post({ name: nm, classId: 'quanji', data: {} });
    assert.equal(r.status, 201);
  }
  const full = await post({ name: 'D', classId: 'quanji', data: {} });
  assert.equal(full.status, 409);
  assert.deepEqual((await full.json()).slots.sort(), ['A', 'B', 'C']);
  // 覆盖 B: 同名 POST 变更新, 不新增
  const over = await post({ name: 'B', classId: 'zonghe', data: { x: 1 } });
  assert.equal(over.status, 200);
  assert.equal(pool.rows.length, 3);
  assert.equal(pool.rows.find(r => r.name === 'B').class_id, 'zonghe');
  await new Promise(r => { srv.closeAllConnections(); srv.close(r); });
});

test('用户隔离: u2 看不到 u1 的方案', async () => {
  const pool = fakePool();
  pool.rows.push({ id: 'x', user_sub: 'u1', name: 'A', class_id: 'quanji', data: {} });
  const app = appWith(pool, 'u2');
  const srv = app.listen(0);
  const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/schemes`);
  assert.deepEqual(await r.json(), []);
  await new Promise(r => { srv.closeAllConnections(); srv.close(r); });
});
