#!/bin/sh
# 一次性校验：代码测试 → 构建检查 → HTTP 冒烟。
# 任一环节失败则以非零退出码结束；全部通过退出码为 0。
set -u
cd "$(dirname "$0")/.."

status=0
step() {
  echo ""
  echo "========== $1 =========="
}

step "1/3 代码测试（vitest：卷积边界 / 双层最优规则 / 同优计数位置）"
if npm test; then
  echo ">> 代码测试：通过"
else
  echo ">> 代码测试：失败"
  status=1
fi

step "2/3 构建检查（tsc --noEmit 类型检查 + vite 静态构建）"
if npm run build; then
  echo ">> 构建检查：通过"
else
  echo ">> 构建检查：失败"
  status=1
fi

step "3/3 HTTP 冒烟（目标：${WEB_URL:-http://web:80}）"
if node scripts/smoke.mjs; then
  echo ">> HTTP 冒烟：通过"
else
  echo ">> HTTP 冒烟：失败"
  status=1
fi

echo ""
if [ "$status" -eq 0 ]; then
  echo "VERIFY OK：代码测试、构建检查、HTTP 冒烟全部通过"
else
  echo "VERIFY FAIL：存在未通过的校验环节"
fi
exit "$status"
