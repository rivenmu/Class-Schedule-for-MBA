// schemes CRUD: 每用户 3 份命名方案。满 3 槽存新名 -> 409 {slots:[names]}, 前端弹三选一覆盖。
// ponytail: 上限放 API 层做 (409+名单), DB 唯一键 (user_sub,name) 只防并发同名翻倍。
const { Router } = require('express');

const MAX_SLOTS = 3;

function makeSchemesRouter(pool) {
  const r = Router();
  // ponytail: Express 4 不收 async throw, 包一层进错误中间件 (500), 否则请求 hang 死
  const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  async function slotNames(userSub) {
    const { rows } = await pool.query(
      'SELECT name FROM schemes WHERE user_sub=$1 ORDER BY updated_at ASC', [userSub]);
    return rows.map(x => x.name);
  }

  // 列表: 轻量, 不含 data
  r.get('/', ah(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, name, class_id AS "classId", updated_at AS "updatedAt" FROM schemes WHERE user_sub=$1 ORDER BY updated_at DESC',
      [req.userSub]);
    res.json(rows);
  }));

  // 全量: 回放进前端 state 用
  r.get('/:id', ah(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, name, class_id AS "classId", data, updated_at AS "updatedAt" FROM schemes WHERE id=$1 AND user_sub=$2',
      [req.params.id, req.userSub]);
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  }));

  // 新建: 同名=更新(200); 新名且满槽=409+名单; 否则 201
  r.post('/', ah(async (req, res) => {
    const { name, classId, data } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim() || data === undefined) {
      return res.status(400).json({ error: 'bad_request' });
    }
    const nm = name.trim().slice(0, 40);
    const up = await pool.query(
      `UPDATE schemes SET class_id=$1, data=$2, updated_at=now()
       WHERE user_sub=$3 AND name=$4 RETURNING id`,
      [classId || 'quanji', data, req.userSub, nm]);
    if (up.rows.length) return res.json({ id: up.rows[0].id, updated: true });
    if ((await slotNames(req.userSub)).length >= MAX_SLOTS) {
      return res.status(409).json({ error: 'slots_full', slots: await slotNames(req.userSub) });
    }
    const ins = await pool.query(
      'INSERT INTO schemes (user_sub, name, class_id, data) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.userSub, nm, classId || 'quanji', data]);
    res.status(201).json({ id: ins.rows[0].id });
  }));

  // 更新: 改名冲突 -> 409; 跨用户 -> 404 (WHERE 带 user_sub, 天然隔离)
  r.put('/:id', ah(async (req, res) => {
    const { name, classId, data } = req.body || {};
    const sets = [], vals = [];
    if (name !== undefined) { sets.push(`name=$${sets.length + 1}`); vals.push(String(name).trim().slice(0, 40)); }
    if (classId !== undefined) { sets.push(`class_id=$${sets.length + 1}`); vals.push(classId); }
    if (data !== undefined) { sets.push(`data=$${sets.length + 1}`); vals.push(data); }
    if (!sets.length) return res.status(400).json({ error: 'bad_request' });
    sets.push('updated_at=now()');
    try {
      const { rows } = await pool.query(
        `UPDATE schemes SET ${sets.join(', ')} WHERE id=$${vals.length + 1} AND user_sub=$${vals.length + 2} RETURNING id`,
        [...vals, req.params.id, req.userSub]);
      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      res.json({ id: rows[0].id });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'name_taken' });
      throw e;
    }
  }));

  r.delete('/:id', ah(async (req, res) => {
    const { rowCount } = await pool.query(
      'DELETE FROM schemes WHERE id=$1 AND user_sub=$2', [req.params.id, req.userSub]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  }));

  return r;
}

module.exports = { makeSchemesRouter, MAX_SLOTS };
