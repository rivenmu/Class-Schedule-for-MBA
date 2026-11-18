-- 会计练习页云同步与在线人数 (2026-11-18, 从 report_service 迁入)。
-- 键用 Logto 的 username (旧数据就是按 username 存的), 缺失时 API 回落 sub。
CREATE TABLE IF NOT EXISTS study_progress (
  username TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 公开心跳: 只存随机访客 ID 与最后活跃时间, 不存 IP。
CREATE TABLE IF NOT EXISTS study_presence (
  visitor_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_presence_seen ON study_presence (last_seen);
