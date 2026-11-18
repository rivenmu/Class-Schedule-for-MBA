// 验签自检: 本地 JWKS + 自签 token, 不依赖真 Logto。跑: npm test
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const CLIENT_ID = 'test-client';
const ORG = 'org-ucas';

async function startJwks() {
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 'test-key', alg: 'RS256', use: 'sig' });

  const server = http.createServer((req, res) => {
    if (req.url === '/oidc/jwks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404).end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const issuer = `http://127.0.0.1:${server.address().port}/oidc`;

  async function sign(claims, opts = {}) {
    let jwt = new SignJWT({ organizations: [ORG], username: 'test_ucas', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(opts.issuer || issuer)
      .setAudience(opts.audience || CLIENT_ID)
      .setSubject('user-sub')
      .setIssuedAt()
      .setExpirationTime(opts.exp || '5m');
    return jwt.sign(privateKey);
  }

  return { server, issuer, sign };
}

function callMiddleware(requireUser, token) {
  return new Promise((resolve) => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = {
      statusCode: 200,
      status(n) { this.statusCode = n; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    requireUser(req, res, () => resolve({ status: 200, body: null, req }));
  });
}

test('jwksUrl: Logto 的地址是 <issuer>/jwks', async () => {
  const { jwksUrl } = require('./auth');
  assert.equal(jwksUrl('https://login.example/oidc'), 'https://login.example/oidc/jwks');
  assert.equal(jwksUrl('https://login.example/oidc/'), 'https://login.example/oidc/jwks');
});

test('requireUser: 合法 token 通过, 组织/aud 不对拒绝', async () => {
  const { server, issuer, sign } = await startJwks();
  process.env.LOGTO_ISSUER = issuer;
  process.env.LOGTO_CLIENT_ID = CLIENT_ID;
  process.env.LOGTO_ORG_ID = ORG;
  delete require.cache[require.resolve('./auth')];
  const { requireUser } = require('./auth');

  try {
    const good = await callMiddleware(requireUser, await sign({}));
    assert.equal(good.status, 200);
    assert.equal(good.req.userName, 'test_ucas');
    assert.equal(good.req.userSub, 'user-sub');

    const wrongOrg = await callMiddleware(requireUser, await sign({ organizations: ['other'] }));
    assert.equal(wrongOrg.status, 403);

    const wrongAud = await callMiddleware(requireUser, await sign({}, { audience: 'other-client' }));
    assert.equal(wrongAud.status, 401);

    const missing = await callMiddleware(requireUser, null);
    assert.equal(missing.status, 401);
  } finally {
    await new Promise((resolve) => {
      if (server.closeAllConnections) server.closeAllConnections();
      server.close(resolve);
    });
  }
});
