// add-districts.js —— 给 spots.json 的每个点位标注行政区（district 字段）
//
// 数据源：阿里云 DataV 行政区边界（440300 = 深圳市），首次运行联网下载，
// 之后缓存在 tool/shenzhen-districts.json，可离线重跑。
// 用法：node tool/add-districts.js
//
// 为什么不用手工填：行政区可以从坐标客观推导（点在多边形内），
// 不像朝向/站位需要人的现场知识——能算的就不要手填。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPOTS = path.join(ROOT, 'spots.json');
const DISTRICTS_CACHE = path.join(__dirname, 'shenzhen-districts.json');
const DISTRICTS_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/440300_full.json';

// ---------- 点在多边形内（射线法，支持 Polygon / MultiPolygon） ----------
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    // 射线从 (x,y) 向右射出，统计与多边形边的交点次数，奇数 = 在内
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPolygon(pt, geometry) {
  if (geometry.type === 'Polygon') {
    // 外环在内、且不在任何一个洞里（行政区没有洞，但按规范写全）
    if (!pointInRing(pt, geometry.coordinates[0])) return false;
    return geometry.coordinates.slice(1).every(hole => !pointInRing(pt, hole));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(poly => pointInPolygon(pt, { type: 'Polygon', coordinates: poly }));
  }
  return false;
}

async function main() {
  // 1. 边界数据：优先本地缓存
  let districtsGeo;
  if (fs.existsSync(DISTRICTS_CACHE)) {
    districtsGeo = JSON.parse(fs.readFileSync(DISTRICTS_CACHE, 'utf8'));
    console.log('边界数据：本地缓存');
  } else {
    console.log('边界数据：联网下载', DISTRICTS_URL);
    const res = await fetch(DISTRICTS_URL);
    if (!res.ok) throw new Error(`下载行政区边界失败：HTTP ${res.status}`);
    districtsGeo = await res.json();
    fs.writeFileSync(DISTRICTS_CACHE, JSON.stringify(districtsGeo));
    console.log('已缓存到', DISTRICTS_CACHE);
  }
  const districts = districtsGeo.features
    .filter(f => f.geometry) // 边界数据里偶有无 geometry 的中心点记录，跳过
    .map(f => ({ name: f.properties.name, geometry: f.geometry }));

  // 2. 读 spots.json
  const data = JSON.parse(fs.readFileSync(SPOTS, 'utf8'));

  let hit = 0, miss = [];
  for (const spot of data.spots) {
    const pt = [spot.lng, spot.lat];
    const found = districts.find(d => pointInPolygon(pt, d.geometry));
    if (found) { spot.district = found.name; hit++; }
    else { delete spot.district; miss.push(`${spot.name} (${spot.lng},${spot.lat})`); }
  }

  // 3. 写回（保持 2 空格缩进，与现有文件一致）
  fs.writeFileSync(SPOTS, JSON.stringify(data, null, 2) + '\n');
  console.log(`完成：${hit}/${data.spots.length} 个点位归属到行政区`);
  if (miss.length) {
    console.log('⚠️ 以下点位落在深圳市界外（跨界机位属正常，无 district 字段）：');
    miss.forEach(m => console.log('  -', m));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
