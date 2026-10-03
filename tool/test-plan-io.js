/* 计划导入/导出闭环测试 v2：拦截 blob 拿导出内容，DataTransfer 模拟文件上传 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const DL_DIR = 'C:/Users/森/Desktop/新建文件夹 (3)/出片地图-源码/docs/screenshots';
const PORT = process.env.PORT || 8000;
const CHROME_PATH = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  if (!fs.existsSync(CHROME_PATH)) throw new Error(`Chrome not found: ${CHROME_PATH}`);
  const b = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true, args: ['--no-sandbox']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });

  await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
  await p.waitForFunction(() => typeof spotsData !== 'undefined' && spotsData.length > 0, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1000));

  // 1. 加 3 个点位
  const names = await p.evaluate(() => {
    spotsData.slice(0, 3).forEach(s => plan.push({ name: s.name, lng: s.lng, lat: s.lat }));
    savePlan(); renderPlan(); updatePlanBtn(); renderNetwork();
    return plan.map(x => x.name);
  });
  console.log('plan after add:', names.length, JSON.stringify(names));

  // 2. 切到计划页截图
  await p.click('#top-tab-plan');
  await new Promise(r => setTimeout(r, 600));
  await p.screenshot({ path: path.join(DL_DIR, 'plan-io-ui.png') });

  // 3. 导出：拦截 createObjectURL 捕获 blob 内容
  const exported = await p.evaluate(() => new Promise((resolve) => {
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsText(blob);
      return orig(blob);
    };
    document.getElementById('plan-export-btn').click();
    setTimeout(() => resolve(null), 3000);
  }));
  if (!exported) { console.log('EXPORT CAPTURE FAILED'); await b.close(); process.exit(1); }
  const parsed = JSON.parse(exported);
  console.log('export type:', parsed.type, '| version:', parsed.version, '| spots:', parsed.spots.length);
  console.log('export first item keys:', Object.keys(parsed.spots[0]).join(','));

  // 4. 清空
  await p.evaluate(() => { plan = []; savePlan(); renderPlan(); updatePlanBtn(); renderNetwork(); });
  console.log('plan after clear:', await p.evaluate(() => plan.length));

  // 5. 导入：DataTransfer 构造文件
  await p.evaluate((json) => {
    const dt = new DataTransfer();
    dt.items.add(new File([json], 'plan.json', { type: 'application/json' }));
    const input = document.getElementById('plan-file-input');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, exported);
  await new Promise(r => setTimeout(r, 1200));

  const restored = await p.evaluate(() => plan.map(x => x.name));
  console.log('plan after import:', restored.length, JSON.stringify(restored));
  await p.screenshot({ path: path.join(DL_DIR, 'plan-io-imported.png') });

  const pass = restored.length === names.length && restored.every((n, i) => n === names[i]);
  console.log(pass ? 'TEST PASS' : 'TEST FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
