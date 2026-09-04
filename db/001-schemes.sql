-- mba.schemes: 每用户最多 3 份命名选课方案, data 直接吞前端 stateData JSON
-- stateData 形状见 MBA-Schedule.html saveState(): {classId,sem,year,month,selections,electiveSel,filter}
CREATE TABLE IF NOT EXISTS schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sub TEXT NOT NULL,            -- Logto ID Token 的 sub, 业务用户唯一键
  name TEXT NOT NULL,                -- 方案名 (每用户唯一, 如“冲刺版”)
  class_id TEXT NOT NULL DEFAULT 'quanji',
  data JSONB NOT NULL,               -- stateData 全量
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_sub, name)            -- ponytail: 3 份上限放 API 层 (409+名单), 唯一键只防并发同名翻倍
);
CREATE INDEX IF NOT EXISTS idx_schemes_user ON schemes (user_sub);
