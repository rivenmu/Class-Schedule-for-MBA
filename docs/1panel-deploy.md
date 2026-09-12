# 26级MBA课程预选表 — 1Panel 部署指南

## 项目概述

单文件可视化日历，支持七班合一（全集/综合/非集/人工智能/数字化/脱产/金融），双学期，日历+选课+冲突+进度+打印。

- **前端**：单 HTML 文件，浏览器直接打开
- **后端**：Node.js API，提供选课方案存储和 OIDC 登录
- **数据库**：PostgreSQL，存储选课方案

## 架构

```
用户访问 → 1Panel 网站 (nginx) → 反向代理到 web 容器
web 容器 (nginx) → 前端 HTML + 代理 /api 请求
mba-api 容器 → Node.js 后端 → PostgreSQL 数据库
```

## 前置条件

1. 已安装 1Panel 的服务器
2. 已安装 Docker（1Panel 依赖）
3. PostgreSQL 数据库（可用 1Panel 应用商店安装）
4. OIDC 登录服务（如 Logto，可用 1Panel 应用商店安装）
5. 域名和 SSL 证书（可选）

## 部署步骤

### 第一步：上传代码到服务器

```bash
# 在服务器上创建目录
ssh root@10.0.0.2 "mkdir -p /opt/mba-deploy"

# 上传代码（从本地）
rsync -avz --exclude='.git' ./ root@10.0.0.2:/opt/mba-deploy/
```

### 第二步：创建配置模板

```bash
ssh root@10.0.0.2 << 'EOF'
cat > ~/.mba-deploy.env << 'ENV'
# 必填：你的 OIDC 登录服务地址（如 Logto）
LOGTO_ISSUER=https://login.你的域名/oidc
LOGTO_CLIENT_ID=你的Logto应用ID
# 必填：PostgreSQL 连接字符串（PG 必须发布到宿主机端口，如 5432）
PGURL=postgres://mba:密码@host.docker.internal:5432/mba
ENV
EOF
```

### 第三步：在 1Panel 中创建编排

1. 登录 1Panel 面板
2. 进入 **容器 → 编排**
3. 点击 **创建**
4. 填入：
   - **名称**：`mba-schedule`
   - **路径**：`/opt/mba-deploy/docker-compose.yml`
   - **端口**：`7899`
   - **网络**：`bridge`
   - **启动命令**：`docker compose up -d`
   - **停止命令**：`docker compose down`
   - **重启命令**：`docker compose up -d --force-recreate`
5. 点击 **创建**

### 第四步：创建 1Panel 网站并反向代理

1. 进入 **网站 → 创建**
2. 选择 **反向代理**
3. 域名填：`mba.你的域名`（或 `mba.rivenmu.cn`）
4. 代理地址填：`http://10.0.0.2:7899`
5. 开启 SSL（可选）
6. 点击 **创建**

### 第五步：部署并验证

```bash
# 在服务器上运行部署脚本
ssh root@10.0.0.2 "cd /opt/mba-deploy && bash deploy.sh"

# 验证
curl -s http://127.0.0.1:7899/api/health
# 预期输出：{"ok":true}
```

## 后续更新

```bash
# 每次更新只需：
cd /opt/mba-deploy && git pull && bash deploy.sh
```

或者在 1Panel 编排页面点击 **重启** 按钮。

## 关键配置项

- `LOGTO_ISSUER`：OIDC 登录服务地址（如 Logto）
- `LOGTO_CLIENT_ID`：Logto 应用 ID
- `PGURL`：PostgreSQL 连接字符串（PG 必须发布到宿主机端口，因为 compose 网络中 `host.docker.internal` 指向宿主机）

## 常见问题

### 1. 部署后无法访问

检查：
- 1Panel 编排是否启动成功
- 1Panel 网站是否创建成功
- 反向代理地址是否正确
- Docker 容器是否运行：`docker ps`

### 2. 登录失败

检查：
- `LOGTO_ISSUER` 和 `LOGTO_CLIENT_ID` 是否正确
- Logto 应用是否配置了正确的 Redirect URI
- PostgreSQL 是否可访问

### 3. 选课方案保存失败

检查：
- PostgreSQL 连接字符串是否正确
- `mba` 数据库是否存在
- 数据库表是否创建成功

### 4. 版本更新后测试失败

检查：
- `MBA-Schedule.html` 中的 `VERSION` 常量是否与标题/页脚徽标一致
- 版本号是否递增（不能与上一版本同号）
- 测试中徽章断言用精确匹配（`toBe('vX.Y.Z')`），号没同步测试即红

## 版本管理

- 每次更新自动升 **小版本**：`v0.8.7` → `v0.8.8` … 以此类推，无需询问。
- 较重大的 bug 修复或功能更新：可升 **次版本**：`v0.8.x` → `v0.9.0`。
- **禁止**自行升至 `1.0.0`，需用户明确通知后方可升级。
- 版本号需同步更新三处：`MBA-Schedule.html` 内 `VERSION` 常量与标题/页脚徽标、`README`、`AGENTS.md`/`CLAUDE.md` 本段。
- **提交前必查版本（禁重复号）**：凡带内容变更的提交，先 `git log --oneline -1` 确认上一版本号，
  本次必须递增一档后再提交，禁止与上一版本同号（曾出现并行提交同标 `v0.8.0` 的事故）。
  测试中徽章断言用精确匹配（`toBe('vX.Y.Z')`），号没同步测试即红。
