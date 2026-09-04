# AGENTS — 默认读取

> opencode / codex / Muse 等 agent 启动时默认读取本文件。

## 项目
26级MBA课程预选表 — 单文件可视化日历 `MBA-Schedule.html`，七班合一（全集/综合/非集/人工智能/数字化/脱产/金融），双学期，日历+选课+冲突+进度+打印。

## 当前版本
`v0.8.0` — 展示于 `MBA-Schedule.html` 标题徽章与页脚，代码内 `const VERSION = "v0.8.0"`，`README` 标题区同步。

## 发版规则（强制）
- 每次更新自动升 **小版本**：`v0.8.0` → `v0.8.1` … 以此类推，无需询问。
- 较重大的 bug 修复或功能更新：可升 **次版本**：`v0.8.x` → `v0.9.0`。
- **禁止**自行升至 `1.0.0`，需用户明确通知后方可升级。
- 版本号需同步更新三处：`MBA-Schedule.html` 内 `VERSION` 常量与标题/页脚徽标、`README`、`AGENTS.md`/`CLAUDE.md` 本段。

## 约定
- 单文件交付，直接双击可用；测试 `cd tests && npx playwright test` 保持 `72` 项通过。
- 原始 PDF 已加入 `.gitignore`，不提交。
