// HTTP 冒烟：等待健康检查端点就绪，再校验首页可访问且包含 React 挂载点。
const base = (process.env.WEB_URL || 'http://web:80').replace(/\/$/, '');

async function get(path) {
  const res = await fetch(base + path);
  return { status: res.status, text: await res.text() };
}

async function waitHealthy(attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await get('/health');
      if (r.status === 200) return true;
    } catch {
      // web 尚未就绪，继续等待
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

if (!(await waitHealthy())) {
  console.error(`冒烟失败：${base}/health 在 30 秒内未返回 200`);
  process.exit(1);
}
console.log(`GET ${base}/health → 200`);

const home = await get('/');
if (home.status !== 200 || !home.text.includes('id="root"')) {
  console.error(`冒烟失败：${base}/ 状态 ${home.status} 或缺少 React 挂载点`);
  process.exit(1);
}
console.log(`GET ${base}/ → 200，包含 React 挂载点`);
console.log('HTTP 冒烟全部通过');
