// MBA 选课云方案小 API。面板环境变量缺任一即拒绝启动 (fail-fast, 不带病运行)。
const express = require('express');
const { Pool } = require('pg');
const { requireUser } = require('./auth');
const { makeSchemesRouter } = require('./schemes');
const { makeStudyRouter, makePresenceRouter } = require('./study');

for (const k of ['PGURL', 'LOGTO_ISSUER', 'LOGTO_CLIENT_ID', 'LOGTO_ORG_ID']) {
  if (!process.env[k]) { console.error(`[api] 缺环境变量 ${k}, 拒绝启动`); process.exit(1); }
}

const pool = new Pool({ connectionString: process.env.PGURL });
const app = express();
app.use(express.json({ limit: '256kb' })); // stateData 约几十 KB, 256k 够且防滥用

app.get('/api/health', (req, res) => res.json({ ok: true }));
// 公开配置：门户/学习页续期只需要 issuer 与 client_id（都是公开值，不含密钥）
app.get('/api/auth/config', (req, res) =>
  res.json({ issuer: process.env.LOGTO_ISSUER, clientId: process.env.LOGTO_CLIENT_ID })
);
app.get('/api/me', requireUser, (req, res) => res.json({ sub: req.userSub, name: req.userName }));
app.use('/api/schemes', requireUser, makeSchemesRouter(pool));
app.use('/api/study/online', makePresenceRouter(pool)); // 公开心跳, 必须挂在 requireUser 之前
app.use('/api/study', requireUser, makeStudyRouter(pool));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'internal' }); });

const port = process.env.PORT || 3000;
// 绑 0.0.0.0: compose 下 nginx 从别的容器经网桥进来, 只绑回环则 /api 全挂.
app.listen(port, '0.0.0.0', () => console.log(`[api] listening on 0.0.0.0:${port}`));
