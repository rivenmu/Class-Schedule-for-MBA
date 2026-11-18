# 部署（compose：web + api）

生产：`10.0.0.2` 上 `mba-schedule-web`（nginx，`7899`）+ `mba-schedule-api`（Node，内网 3000），
接 `iqair_work_default` 网络，用容器名 `iqair_db` 连 `mba` 库。域名 `https://mba.rivenmu.cn:20001`。

## 0. 一次性准备

1. **建库与角色**（在服务器 `iqair_db` 容器里，密码自己生成，只写 `~/.mba-deploy.env`）：

   ```sql
   CREATE ROLE mba_user LOGIN PASSWORD '<随机>';
   CREATE DATABASE mba OWNER mba_user;
   ```

2. **建表**（仓库根执行，幂等）：

   ```bash
   docker exec -i iqair_db psql -U mba_user -d mba < db/001-schemes.sql
   docker exec -i iqair_db psql -U mba_user -d mba < db/002-study.sql
   ```

3. **服务器配置** `~/.mba-deploy.env`（600，不进 git）：

   ```bash
   PGURL=postgres://mba_user:<随机>@iqair_db:5432/mba
   LOGTO_ISSUER=https://login.rivenmu.cn:20001/oidc
   LOGTO_CLIENT_ID=k6js5d0fjavi80ivthb8y
   LOGTO_ORG_ID=a1fmpcvuzkg0
   ```

4. **Logto 应用**：`MBA 课表`（SPA/PKCE），回调登记
   `https://mba.rivenmu.cn:20001/`、`https://mba.rivenmu.cn:20001/MBA-Schedule.html`、
   `http://10.0.0.2:7899/`。

## 1. 日常更新

Mac 上先推到两个远端（GitHub 给公开下载，`server` 是服务器裸仓）：

```bash
git push origin master      # GitHub
git push server master      # ssh://rivenmu@10.0.0.2/home/rivenmu/repos/mba_class.git
```

服务器上：

```bash
cd /opt/mba-deploy && bash deploy.sh
```

`/opt/mba-deploy` 的 `origin` 指向服务器本地裸仓，不依赖 GitHub（服务器访问 GitHub 曾因 TLS 失败）。

脚本：`git pull` → 注入 Logto 真值到 `web/`（`index.html` 学习区首页 + `MBA-Schedule.html`）→ 同步 `accounting_study/` 与 `favicon.svg` → 写 `.env`（含 PGURL / Logto / UCAS 组织）→ `docker compose up -d`。

- **手册**：`bash scripts/publish_handbook.sh [html路径]`，原子替换服务器 `web/accounting_study/handbook/index.html`，不重建容器。
- **不要**在服务器手改代码；`/opt/mba-deploy` 是 git clone。

## 2. 验证

```bash
curl -s http://127.0.0.1:7899/api/health            # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7899/                    # 200（学习区首页）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7899/schedule           # 200（课表）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7899/accounting_study   # 200（会计练习）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7899/study/             # 301 → accounting_study
```

浏览器（局域网）`http://10.0.0.2:7899/` 可登录；生产 HTTPS 下走 Logto PKCE。

登录态存 `localStorage`（`mba-id-token` / `mba-refresh-token`），ID Token 30 分钟、refresh token 7 天轮换；打开页面/401 时自动续期，续不上才要求重新登录。学习页续期通过公开接口 `/api/auth/config` 拿 issuer/clientId，因此 API 必须能读到 `LOGTO_ISSUER` / `LOGTO_CLIENT_ID` 环境变量。
`/api/study/progress` 需 Bearer ID Token，且 `organizations` 含 UCAS，否则 403。

## 3. 入口与回滚

- Lucky：`mba.rivenmu.cn` 应直连 `http://10.0.0.2:7899`。
- 过渡期 Lucky 仍指 `7900` 时，1Panel 静态站配置被临时改成反代到 `7899`；切 Lucky 后把
  `/opt/1panel/www/conf.d/mba.conf.bak-static-20261118` 还原成静态站作回滚。
- 回滚：停 compose，Lucky 指回 `7900`，静态站文件仍在 `/opt/1panel/www/sites/mba/index/`。
