// 验 Logto ID Token: JWKS 远程取公钥, 校验 iss/aud/exp。非法一律 401, 不透细节。
// ponytail: 不自造 session, 不存 token, 每次请求验签了事。
const { createRemoteJWKSet, jwtVerify } = require('jose');

function required(name) {
  const v = process.env[name];
  if (!v) { console.error(`[api] 缺环境变量 ${name}, 拒绝启动`); process.exit(1); }
  return v;
}

let jwks = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(required('LOGTO_ISSUER') + '/.well-known/jwks.json'));
  return jwks;
}

// Express 中间件: 通过则 req.userSub = sub
async function requireUser(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const m = h.match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ error: 'unauthorized' });
    const { payload } = await jwtVerify(m[1], getJwks(), {
      issuer: required('LOGTO_ISSUER'),
      audience: required('LOGTO_CLIENT_ID'),
    });
    if (!payload.sub) return res.status(401).json({ error: 'unauthorized' });
    req.userSub = payload.sub;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

module.exports = { requireUser };
