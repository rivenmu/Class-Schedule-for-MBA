# AGENTS — 默认读取

> opencode / codex / Muse 等 agent 启动时默认读取本文件。

## 项目
26级MBA 学习站 —— 单文件课表 `MBA-Schedule.html`（七班合一、双学期、日历+选课+冲突+进度+打印）+ 会计练习页 `study/`（部署为 `/accounting_study`）+ 开卷手册 + 选课云方案 API。线上 `https://mba.rivenmu.cn:20001` 是学习区首页，课表在 `/schedule`。

## 当前版本
`v0.8.10` — 展示于 `MBA-Schedule.html` 标题徽章与页脚，代码内 `const VERSION = "v0.8.10"`，`README` 标题区同步。

## 发版规则（强制）
- 每次更新自动升 **小版本**：`v0.8.10` → `v0.8.11` … 以此类推，无需询问。
- 较重大的 bug 修复或功能更新：可升 **次版本**：`v0.8.x` → `v0.9.0`。
- **禁止**自行升至 `1.0.0`，需用户明确通知后方可升级。
- 版本号需同步更新三处：`MBA-Schedule.html` 内 `VERSION` 常量与标题/页脚徽标、`README`、`AGENTS.md`/`CLAUDE.md` 本段。
- **提交前必查版本（禁重复号）**：凡带内容变更的提交，先 `git log --oneline -1` 确认上一版本号，
  本次必须递增一档后再提交，禁止与上一版本同号（曾出现并行提交同标 `v0.8.0` 的事故）。
  测试中徽章断言用精确匹配（`toBe('vX.Y.Z')`），号没同步测试即红。

## 命名规范（全仓通用 · 硬性）

**默认规则**：新建的目录名、以及 AI 新建的文件名，一律**全小写英文 + 下划线连词**（`mba_class`、`schedule_analysis`、`build_deck.py`）。禁止中文、大写字母、空格、连字符。

**只有这两类受本规则约束**：

1. 目录名
2. AI 新建的产物与脚本：`.html` / `.css` / `.py` / `.sh` / 自建 `.json` / 图片 / pptx、pdf、csv 等导出文件

**例外清单（命中即保持原名，禁止为「统一风格」改名）**：

| # | 例外 | 例子 |
|---|---|---|
| 1 | `.md` 文档 | `AGENTS.md`、`README.md`、`HANDOVER.md` |
| 2 | 生态约定俗称的固定文件名 | `Dockerfile`、`Dockerfile.dev`、`Makefile`、`CMakeLists.txt`、`LICENSE`、`Procfile`、`Gemfile`、`Cargo.toml`、`package.json`、`package-lock.json`、`tsconfig*.json`、`requirements.txt`、`docker-compose.yml`、`nginx.conf`、`pytest.ini` |
| 3 | 点文件与工具配置 | `.gitignore`、`.gitattributes`、`.editorconfig`、`.env*`、`.eslintrc*`、`.prettierrc*`、`.npmrc`、`.DS_Store` |
| 4 | 代码源文件：跟随语言 / 框架约定，且必须与引用路径一致 | React 组件 PascalCase（`EChart.tsx`）、camelCase 工具（`chartTheme.ts`）、Vue 单文件（`App.vue`）、既有交付物（`MBA-Schedule.html`）。**已存在的代码文件永不因本规则改名** |
| 5 | 用户提供 / 第三方产出 | 原始数据、下载包、解压目录、厂商模板、软件安装目录 |
| 6 | 既有历史文件与目录 | 只约束新建；发现不合规**先报告，不擅自批量改名** |
| 7 | 外部硬性要求 | 平台 / 工具强制的大小写、系统保留名 |

**判定顺序**：先比对例外表 1–7，命中则保持原名；全部未命中才套默认规则。若某名字命中例外、但明显是 AI 自己造的临时文件（`新建文件夹`、`未命名-2`、`111`），仍按默认规则重命名。

> 本节与 `../../platform/AGENTS.md` 同名小节保持一致，冲突时以 platform 为准。

## 学习页与 API
- `/accounting_study`：MBA 会计三表练习，单文件 `study/index.html`，公开可看，进度默认只存浏览器；旧 `/study/` 301 过来。
- 云同步：课表与学习页共用 `localStorage` 的 `mba-id-token` / `mba-refresh-token`（新标签页、关浏览器都保持登录）；续期用公开的 `/api/auth/config` 取 issuer/clientId，再调 Logto `/token`，401 时先续期重试一次；不自己做 OIDC 跳转。
- 登录会话：课表页 scope 含 `offline_access`，回调校验 `state`；打开页面若无令牌但本机登录过，`prompt=none` 静默登回；登出结束 Logto 会话，避免被静默登回。Logto 应用须开 `alwaysIssueRefreshToken`。
- API（`api/`，Express）：先验 Logto ID Token，再校验 `organizations` 含 UCAS（`LOGTO_ORG_ID`），否则 403；`schemes`、`study` 都走同一道校验。
- 数据库：`mba` 库，`db/001-schemes.sql`、`db/002-study.sql`，复用 `iqair_db` 实例。
- 手册：源文件在 `../会计期末考试资料/开卷考试极速快查手册.html`，用 `scripts/publish_handbook.sh` 原子发布。

## 部署
- 站点结构：`/` 学习区首页（`home/index.html`）→ `/schedule` 课表、`/accounting_study` 会计练习；旧 `/study/` 301。
- 全部走 `docker-compose.yml`（web nginx `7899` + mba-api 内网），Mac 推 `origin`（GitHub）与 `server`（服务器裸仓），服务器 `bash deploy.sh` 注入 Logto 真值并重建。
- 真值在服务器 `~/.mba-deploy.env`（600，不进 git）；Lucky 把 `mba.rivenmu.cn` 指向 `10.0.0.2:7899`。
- 回滚：Lucky 指回 `7900` 静态站（文件保留一周）。

## 约定
- 单文件交付，直接双击可用；测试 `cd tests && npx playwright test` 保持 `102` 项通过。
- 原始 PDF 已加入 `.gitignore`，不提交。
