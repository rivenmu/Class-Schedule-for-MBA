# 部署 (v0.8.0, 路线A: Logto + 小 API, 全在 1Panel 里)

前置: 你已有 PG + 域名 + HTTPS + 静态站。**日常更新只跑一条命令**,
首次才做下面 0-4 步。

## 一键更新 (以后每次)

```bash
cd <仓库目录> && bash deploy.sh
```

首次先填一次配置 (`~/.mba-deploy.env`, 或直接改 `deploy.sh` 顶部):

```bash
SITE_DIR=/opt/1panel/www/sites/mba-rivenmu-cn/index   # 以面板实际路径为准
API_DIR=<Node 运行环境目录>
LOGTO_ISSUER=https://login.rivenmu.cn:20002/oidc
LOGTO_CLIENT_ID=<第 2 步抄下的>
```

脚本做的事: `git pull` → 拷 HTML 并注入真值(仓库占位符永远不动,
单文件离线可用不受影响) → 同步 `api/`(永不碰 `api/.env`) →
`package.json` 变了才 `npm install` 并提醒去面板点一下 Node 重启。
`api/` 没变时连重启都不用点。

## 1. PG 建库建表 (1 分钟)

数据库 → PostgreSQL → 新建数据库 `mba` → 进该库执行 `db/001-schemes.sql` 全文。
验证: `SELECT * FROM schemes LIMIT 1;` 能跑即成。

## 2. 装 Logto (应用商店, 5 分钟)

1. 域名商加两条 A 记录: `login.你的域名`、`login-admin.你的域名` → 指向服务器 IP。
2. 应用商店搜 `Logto` → 安装, 服务地址填 `https://login.你的域名`,
   控制台填 `https://login-admin.你的域名`, 数据库选已有 PG(它自己另建库, 与 `mba` 共存)。
3. 进控制台注册首个管理员 → 建应用 → 类型选**单页应用 / PKCE** →
   Redirect URI 填 `https://<你的课表站>/MBA-Schedule.html`(有子路径就写全),
   Post-logout URI 填站首页。抄下: Client ID、authorization/token 端点。
   公开注册默认开着 (已拍板), 后续想收紧另起需求。

## 3. 跑小 API (运行环境, 3 分钟)

1. 网站 → 运行环境 → 新建 Node: 目录 `api/`、启动命令 `npm start`、端口 `3000`,
   先 `npm install` 一次。
2. 环境变量 (面板里填, 不进 git): `PGURL`(含 `mba` 库密码)、`LOGTO_ISSUER`
   (如 `https://login.你的域名/oidc`)、`LOGTO_CLIENT_ID`、`PORT=3000`。
3. 你本站 → 配置/伪静态, 加:
   `location /api/ { proxy_pass http://127.0.0.1:3000/api/; proxy_set_header Host $http_host; }`

## 4. 传文件 + 填前端配置 (2 分钟)

1. 把新版 `MBA-Schedule.html` 通过网站「文件管理」覆盖上传。
2. 在该文件里搜 `login.你的域名` / `PASTE_LOGTO_APP_ID`, 换成第 2 步的真实值 (共 1 处)。
3. 验证: `curl https://<你的站>/api/health` → `{"ok":true}`;
   浏览器真登录一次 → 存一份方案 → 换浏览器登录加载一致。
