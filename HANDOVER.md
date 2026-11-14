# 交接文档 — 26级MBA课程预选表 `v0.8.7`

> 生成日期：2026-10-29 ｜ 面向：下一位接手的人（或 agent）
> 本文只写**当前实测状态**与**必须知道的坑**，功能清单看 `README.md`，发版纪律看 `AGENTS.md`。

---

## 0. 一句话现状

产品功能已完成并容器化部署在自己 1Panel 上。**没做完的只有收尾三件事**：测试里有一处版本断言没跟着发版改（3 项红）、最新一个提交没推到 GitHub、部署文档有两份互相冲突的版本。

---

## 1. 五分钟上手

```bash
# 直接用（无需构建、无依赖）
open MBA-Schedule.html

# 端到端测试（4 个 spec × 3 个手机视口）
cd tests && npm install && npx playwright install chromium && npx playwright test

# API 单测（node 自带 test runner，不碰真库）
cd api && npm test
```

**2026-10-29 实测结果**

| 项 | 结果 | 命令 |
|---|---|---|
| Playwright | 102 项：**99 过 / 3 红** | `cd tests && npx playwright test`（约 1.3 分钟） |
| API 单测 | **2/2 过** | `cd api && npm test` |
| 3 项红的唯一原因 | `tests/mobile.spec.mjs:379` 断言 `'v0.8.6'`，实际 `'v0.8.7'` | 三个视口各红一次 |

---

## 2. 仓库状态（接手第一眼看这里）

| 项 | 状态 |
|---|---|
| 分支 | `master`，**领先 `origin/master` 1 个提交** |
| 未推送提交 | `9b96032 完好备份` —— 只新增了 `docs/1panel-deploy.md` 与 `docs/1panel-deploy-questions.md`（+210 行），无代码变更 |
| 其他分支 | `codex/others`（旧的移动端适配分支，已合入 master，可忽略） |
| 未跟踪 | `.qoder/`（本地权限配置，含一条 commit 白名单），建议保持不入库 |
| Tag | **没有任何 tag**，回滚只能靠 commit hash |
| 远程 | `git@github.com:rivenmu/Class-Schedule-for-MBA.git`（当前机器 SSH 22 端口不通，未验证远端最新状态） |

---

## 3. 它是什么

单文件课表应用：七班合一（全集 / 综合 / 非全日制集中 / 人工智能 / 数字化 / 脱产 / 金融）、双学期（2026 秋 + 2027 春夏预测）、日历视图 + 勾选选课 + 冲突组 + 学分进度 + 打印 PDF + 本地下载固化。

叠加了两层云端能力（v0.8.0 起）：
- **Logto OIDC（PKCE）登录**，ID Token 存 `sessionStorage`，后端用 JWKS 验签
- **每人 3 份命名云方案**（PG `JSONB` 直接吞前端 `stateData`），满 3 份存新名返回 `409 + 槽位名单`，前端弹三选一覆盖
- **未登录兜底**：勾选结果写 `mba_draft` Cookie（一年），换设备/清缓存后恢复，登录时提示合并

课程数据全部硬编码在 `MBA-Schedule.html` 的 `CLASSES` / `SEMESTERS` 里，**没有构建步骤、没有数据源文件**，改课表就是手改这个 HTML。

---

## 4. 文件地图

| 文件 | 作用 | 注意 |
|---|---|---|
| `MBA-Schedule.html` | **交付物本体**，2517 行 / 249KB 单文件 | 离线双击可用；里面的 `LOGTO` 占位符**永远不许填真值** |
| `api/index.js` | Express 入口，24 行 | 缺任一环境变量直接退出（fail-fast） |
| `api/auth.js` | Logto ID Token 验签中间件 | 任何失败一律 401，不回细节 |
| `api/schemes.js` | 5 个接口 + 3 槽语义 | 上限放 API 层（409+名单），DB 唯一键只防并发同名 |
| `db/001-schemes.sql` | `schemes` 表（12 行） | 幂等 `IF NOT EXISTS`，可重复执行 |
| `docker-compose.yml` | web(nginx) + mba-api 两容器 | web 绑 `0.0.0.0:7899`；api **不发布端口**（避开宿主机 3000 与 new-api 冲突） |
| `nginx.conf` | 静态站 + `/api/` 反代 `mba-api:3000` | |
| `deploy.sh` | 一键更新：`git pull` → sed 注入 → 写 `.env` → compose up → health 自检 | 真值只注入到 `./web/` 副本（git 忽略） |
| `tests/` | 4 个 spec（mobile / auth / guest / schemes）× 3 视口 | 自带 node 静态服务器，不依赖 python |
| `docs/1panel-deploy.md` | **当前有效**的部署文档（compose 路线） | 另见下方「文档冲突」 |
| `docs/deploy.md` | v0.8.0 的旧路线（1Panel Node 运行环境 + 静态站） | **已被取代**，照它做会配错 |
| `docs/rollback.md` | 降级与回滚演练 | 设计原则：API/Logto 挂掉站点仍可离线用 |
| `AGENTS.md` | 发版纪律 + 约定（agent 启动默认读） | `CLAUDE.md` 只做转发 |
| `.omo/plans/…md` | v0.8.0 的开发计划 | **全部未勾选**，历史产物，别当待办清单 |

---

## 5. 前端关键位置索引

| 位置（`MBA-Schedule.html`） | 内容 |
|---|---|
| 675 | `const VERSION = "v0.8.7"`（发版必改的第一处） |
| 677 | `const CLASSES` 七班课程数据起点 |
| 1144 / 1219 | `renderCalendar` / `renderDayList`（≤720px 走 day-list） |
| 1598 / 1669 | `renderCourseList` / `renderAll` |
| 1805 / 1865 | `exportPDF` / `genPrintMonth`（打印分页与封面） |
| 1921 | `saveState()` —— 保存选课并下载 HTML，**不许删** |
| 1996 / 2010 | 跨学期马克思两课互斥（防重复计学分） |
| 2044 | `switchClass`（切班，会重置到 fall2026） |
| 2226 | `LOGTO = {issuer, clientId, redirectUri}` 占位符 |
| 2249 / 2261 | `login()` / `exchange()`（PKCE） |
| 2292 | `api()` —— 所有 `/api` 请求的唯一出口，401 自动登出 |
| 2299 / 2320 | `collectState` / `applyStateData`（`stateData` 形状的读写两端） |
| 2338–2362 | `mba_draft` Cookie 读写（一年过期） |
| 2367 / 2401 / 2412 | 云方案面板：`setMeta` / `delScheme` / `askName` |
| 2472 | 登录后合并本地 Cookie 的提示（`mba-merged` 会话 flag） |

`stateData` 形状（三处共用，改它要同时改 DB JSONB、Cookie 精简格式、下载 HTML）：
`{classId, sem, year, month, selections, electiveSel, filter}`

---

## 6. 发版纪律（强制，摘自 `AGENTS.md`）

- 每次有内容变更自动升**小版本** `v0.8.7 → v0.8.8`，无需询问；重大改动可升次版本 `v0.9.0`
- **禁止**自行升到 `1.0.0`
- 版本号必须同步 **3 处**：HTML 的 `VERSION` 常量、标题徽章 + 页脚徽标、`README.md`（以及 `AGENTS.md` 本段）
- 提交前先 `git log --oneline -1` 确认上一版号，**禁止同号**（历史上出过并行提交都标 v0.8.0 的事故）
- 测试里版本断言是精确匹配，号不同步测试就红 —— **这次红的 3 项正是踩了这一条**

---

## 7. 部署现状

```
用户 → Lucky 转发 mba.rivenmu.cn:20001 → 10.0.0.2:7899 (web 容器)
web(nginx) → 静态 HTML + /api/ 反代 → mba-api 容器:3000 → 宿主机 PG (host-gateway)
```

- 代码目录（服务器）：`/opt/mba-deploy`（v0.8.7 刚从 `/root/mba-deploy` 迁过来）
- 配置真值：服务器 `~/.mba-deploy.env`（`PGURL` / `LOGTO_ISSUER` / `LOGTO_CLIENT_ID`）+ 仓库根 `.env`（`deploy.sh` 生成，600 权限，git 忽略）
- 日常更新只跑一条：`cd /opt/mba-deploy && bash deploy.sh`
- `deploy.sh` 的判定：`api/` 变了才 `--build`，纯前端改动只替换 `./web/MBA-Schedule.html`，不用重启
- 降级行为：API 或 Logto 挂掉 → 页面提示「云端暂不可用」，勾选 / Cookie / 离线下载全部照常
- **线上是否健康本次无法实测**：当前环境对 `mba.rivenmu.cn` 与 GitHub SSH 均不通。接手后请在能联网的机器上跑
  `curl https://mba.rivenmu.cn/api/health`（期望 `{"ok":true}`）并核对页面徽章版本。

### 文档冲突（必须先处理）

| 文档 | 路线 | 状态 |
|---|---|---|
| `docs/1panel-deploy.md` | compose 编排 + 反向代理 7899 | **有效** |
| `docs/deploy.md` | 1Panel「Node 运行环境」+ 静态站伪静态 | **已过时**（v0.8.3 起全面容器化） |

两份都写着「日常更新只跑一条命令」，但指的不是同一套东西。建议删掉或改写旧那份，否则下一个人一定踩坑。

---

## 8. 已知问题 / 技术债（按优先级）

| 级别 | 问题 | 建议做法 |
|---|---|---|
| **P0** | `tests/mobile.spec.mjs:376-379` 断言 `v0.8.6`，HTML 已是 `v0.8.7` → 3 项红 | 改成 `v0.8.7`；更稳的做法是断言「与 `VERSION` 常量一致」而非写死字符串（纯测试改动，不需要升版本号） |
| **P0** | `master` 领先远端 1 个提交（`9b96032`） | 联网后 `git push`；推之前确认仓库含 `api/.env`、`.env`、PDF 均未入库 |
| P1 | `README.md` / `AGENTS.md` 写「72 项测试」，实际 **102 项**（旧的 24×3 口径，后来加了 auth/guest/schemes 三个 spec） | 两处数字一并改掉 |
| P1 | 部署文档双份且冲突（见上） | 删 `docs/deploy.md` 或改成「历史路线」说明 |
| P2 | `api/package.json` 的 `version` 停在 `0.8.4`，没跟发版同步 | 要么删掉这个字段，要么发版时一起改 |
| P2 | 无 git tag | 下次发版 `git tag v0.8.8`，回滚会轻松很多 |
| P2 | `.omo/plans` 与 `.omo/run-continuation` 是历史产物，计划和实际代码已漂移 | 不要照它执行；以 `AGENTS.md` + 本文为准 |
| P3 | 课程数据纯手工维护，无 schema 校验；历史上出过两班课程 ID 撞车导致联动错误（`37f0e2e`） | 加课前在同一班内 grep 一遍新 ID |
| P3 | Logto **公开注册默认开启**（已拍板） | 想收紧需在 Logto 控制台改，不涉及代码 |

---

## 9. 建议的接手顺序

1. 修版本断言 → `cd tests && npx playwright test` 回到 **102/102 绿**
2. 联网机器上 `git push`，并 curl 线上 `/api/health` + 看徽章版本是否为 v0.8.7
3. 清理文档漂移：README/AGENTS 的 72 → 102；处理旧 `docs/deploy.md`
4. 有新的内容变更时，按规则升 `v0.8.8`，三处同步 + 打 tag
5. 改课表数据前，先读第 5 节的 `stateData` 形状与冲突组约定（A–F / G–J，脱产与金融周六下午为 K 组）

---

## 10. 红线（别碰）

- 不把真值写进仓库里的 `MBA-Schedule.html`：`https://login.你的域名/oidc` 和 `PASTE_LOGTO_APP_ID` 是**注入锚点**，改了就破坏「单文件离线可用」
- 不提交任何 `*.pdf`（原始课表本地自备，已在 `.gitignore`）
- 不改 `stateData` 形状而不改另外两端（DB `data` JSONB / `mba_draft` Cookie / 下载 HTML）
- 不删 `saveState()` 的离线下载能力
- 不在同一提交里重复上一版本号；不擅自升 `1.0.0`
- 不动 `CLASSES` 里的冲突判定与学分统计逻辑来「顺手优化」，这层改动风险远大于收益
