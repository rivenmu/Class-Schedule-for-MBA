// 验 Logto ID Token: JWKS 远程取公钥, 校验 iss/aud/exp, 再校验 organizations 含 UCAS。
// 拿不到组织声明一律拒绝 (Q59 默认拒绝); 非法一律 401, 不透明细节。
// ponytail: 不自造 session, 不存 token, 每次请求验签了事。
const { createRemoteJWKSet, jwtVerify } = require('jose');

function required(name) {
  const v = process.env[name];
  if (!v) { console.error(`[api] 缺环境变量 ${name}, 拒绝启动`); process.exit(1); }
  return v;
}

// Logto 1.45 的 ID Token 用 organizations 数组 (元素是组织 ID), 不是裸角色名。
// 兼容不同版本/声明的几种写法, 但只认数组里的目标组织 ID。
function orgOk(payload, orgId) {
  if (!payload) return false;
  const orgs = payload.organizations || payload.organization_ids || payload.organizationIds || [];
  return Array.isArray(orgs) && orgs.includes(orgId);
}

let jwks = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(required('LOGTO_ISSUER') + '/.well-known/jwks.json'));
  return jwks;
}

// Express 中间件: 通过则 req.userSub / req.userName
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
    if (!orgOk(payload, required('LOGTO_ORG_ID'))) {
      return res.status(403).json({ error: 'not_in_organization' });
    }
    req.userSub = payload.sub;
    req.userName = payload.username || payload.preferred_username || '';
    next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

module.exports = { requireUser, orgOk };
