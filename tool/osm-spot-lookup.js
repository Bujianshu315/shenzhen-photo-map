// 用 Overpass API 一次性查询所有点位相关 OSM 要素（WGS-84，与底图同源）
const fs = require('fs');

const NAME_RE = '岗厦北|卓悦中心|信息枢纽|天空之城|石鼓花园|金地威新|万象天地|南山公园|文华大厦|塘朗山|深湾汇云|铁仔山|深圳湾公园|西湾红树林|盐田港|东涌|天文台|太子湾|后海|钟书阁|光明文化艺术中心|深业上城|玛丝菲尔|中洲湾|皇岗|生态广场|湾区之光|红山6979|岗厦';

const QUERY = `[out:json][timeout:90];
(
  nwr["name"~"${NAME_RE}"](22.38,113.75,22.86,114.66);
);
out center tags 400;`;

(async () => {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'sz-photo-map-calibration/1.0' },
    body: 'data=' + encodeURIComponent(QUERY)
  });
  const data = await res.json();
  console.log('Overpass 返回要素数:', data.elements.length);
  const out = data.elements.map(e => ({
    type: e.type, id: e.id,
    name: e.tags && e.tags['name'],
    nameEn: e.tags && e.tags['name:en'],
    category: e.tags && (e.tags.tourism || e.tags.amenity || e.tags.leisure || e.tags.railway || e.tags.shop || e.tags.building || e.tags.natural || e.tags.highway || ''),
    lng: e.lon !== undefined ? e.lon : (e.center && e.center.lon),
    lat: e.lat !== undefined ? e.lat : (e.center && e.center.lat)
  })).filter(e => e.name && e.lng);
  out.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  fs.writeFileSync('osm-candidates.json', JSON.stringify(out, null, 2));
  out.forEach(e => console.log(`${e.name} | ${e.category} | ${e.lng.toFixed(5)},${e.lat.toFixed(5)} | ${e.type}/${e.id}`));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
