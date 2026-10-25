// generate-isochrones.js —— 离线批量生成步行等时圈（路线 B：预计算，前端零依赖）
//
// 用法：
//   node tool/generate-isochrones.js --check   先探活 API（401/403 都算「通」，连不上才算不通）
//   node tool/generate-isochrones.js           批量计算并写入 isochrones.json
//
// API key（二选一）：
//   环境变量：  set ORS_API_KEY=你的key && node tool/generate-isochrones.js
//   本地文件：  把 key 粘进 tool/ors-api-key.txt（已加 .gitignore，不会推上 GitHub）
//
// 免费额度（动手前到 openrouteservice.org 核实；官网从国内直连经常超时）：
//   免费档约 40 次/分钟、2000 次/天。本脚本 40 个点位只发 8 次请求（每批 5 点位）。
//   国内直连不通就挂代理再跑：
//   NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7890 node tool/generate-isochrones.js
//
// 输出 isochrones.json（前端按点位名索引，键是秒：300/600/900 = 步行 5/10/15 分钟）：
//   { meta: {…}, spots: { "深圳湾公园": { "300": Polygon, "600": Polygon, "900": Polygon } } }

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPOTS = path.join(ROOT, 'spots.json');
const OUT = path.join(ROOT, 'isochrones.json');
const KEY_FILE = path.join(__dirname, 'ors-api-key.txt');

const API_URL = 'https://api.openrouteservice.org/v2/isochrones/foot-walking';
const RANGES = [300, 600, 900];        // 步行 5 / 10 / 15 分钟
const BATCH = 5;                       // 每次请求带 5 个点位
const BATCH_GAP_MS = 2500;             // 批间隔，礼貌性限速
const RDP_EPSILON = 0.0001;            // 抽稀容差（度，约 11 米）

function readKey() {
  if (process.env.ORS_API_KEY) return process.env.ORS_API_KEY.trim();
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE, 'utf8').trim();
  console.error('找不到 API key：设环境变量 ORS_API_KEY，或把 key 写进 tool/ors-api-key.txt');
  console.error('（免费 key 注册：openrouteservice.org → sign up；国内直连不通先挂代理）');
  process.exit(1);
}

// ---------- RDP 抽稀，控制 isochrones.json 体积 ----------
function perpDist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
function rdp(points, eps) {
  if (points.length < 3) return points;
  let maxD = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [points[0], points[points.length - 1]];
  return [...rdp(points.slice(0, idx + 1), eps).slice(0, -1), ...rdp(points.slice(idx), eps)];
}
function simplifyGeometry(geom) {
  const r = ring => rdp(ring.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]), RDP_EPSILON);
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map(r) };
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(p => p.map(r)) };
  return geom;
}

async function callORS(key, locations) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': key },
    body: JSON.stringify({ locations, range: RANGES, range_type: 'time' }),
    signal: AbortSignal.timeout(30000)
  });
  if (res.status === 401 || res.status === 403) throw new Error('key 被拒绝（HTTP ' + res.status + '）：检查 key 是否有效');
  if (res.status === 429) throw new Error('触发限流（429）：等一分钟再跑，或减小批次');
  if (!res.ok) throw new Error('API 返回 HTTP ' + res.status + '：' + (await res.text()).slice(0, 200));
  return res.json();
}

async function main() {
  if (process.argv.includes('--check')) {
    console.log('探活 ' + API_URL + ' …');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'check' },
        body: JSON.stringify({ locations: [[114.05, 22.55]], range: [300] }),
        signal: AbortSignal.timeout(15000)
      });
      console.log('API 可达（HTTP ' + res.status + (res.status === 401 ? '，无 key 时的正常回应' : '') + '）');
    } catch (e) {
      console.log('API 连不上（网络层失败）：挂代理再跑（见文件头注释）');
      process.exit(1);
    }
    return;
  }

  const key = readKey();
  const data = JSON.parse(fs.readFileSync(SPOTS, 'utf8'));
  const spots = data.spots;
  console.log('读取 spots.json：' + spots.length + ' 个点位，range = ' + RANGES.join('/') + ' 秒');

  const result = { meta: null, spots: {} };
  let done = 0, failed = [];

  for (let i = 0; i < spots.length; i += BATCH) {
    const batch = spots.slice(i, i + BATCH);
    const locations = batch.map(s => [s.lng, s.lat]);
    process.stdout.write('批次 ' + (i / BATCH + 1) + '/' + Math.ceil(spots.length / BATCH) + '（' + batch[0].name + ' …）… ');
    try {
      const json = await callORS(key, locations);
      if (!result.meta) {
        result.meta = {
          generated_at: new Date().toISOString(),
          provider: 'openrouteservice',
          profile: 'foot-walking',
          range_type: 'time',
          ranges: RANGES,
          attribution: '步行等时圈由 openrouteservice.org 基于 OpenStreetMap 路网估算，非实测'
        };
      }
      // ORS 返回的 group_index 对应本批 locations 的顺序
      json.features.forEach(f => {
        const spot = batch[f.properties.group_index];
        result.spots[spot.name] = result.spots[spot.name] || {};
        result.spots[spot.name][String(f.properties.value)] = simplifyGeometry(f.geometry);
      });
      done += batch.length;
      console.log('ok');
    } catch (err) {
      console.log('失败：' + err.message);
      failed.push(...batch.map(s => s.name));
    }
    if (i + BATCH < spots.length) await new Promise(r => setTimeout(r, BATCH_GAP_MS));
  }

  if (done === 0) { console.error('一个都没算成，isochrones.json 不写入'); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(result));
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log('写入 ' + OUT + '（' + kb + ' KB，成功 ' + done + '/' + spots.length + '）');
  if (failed.length) {
    console.log('失败点位（下次重跑即可，成功的会被覆盖但无损）：' + failed.join('、'));
    process.exit(2);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
