const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const errors = [];
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (e) { errors.push(`${file}: ${e.message}`); return null; }
}
const spots = readJson('spots.json');
const metro = readJson('metro.json');
if (spots && !Array.isArray(spots.spots)) errors.push('spots.json: spots must be an array');
if (metro && !Array.isArray(metro.stations)) errors.push('metro.json: stations must be an array');
if (spots && Array.isArray(spots.spots)) {
  const names = new Set();
  spots.spots.forEach((spot, index) => {
    if (!spot.name || typeof spot.lng !== 'number' || typeof spot.lat !== 'number') errors.push(`spots[${index}]: missing name/lng/lat`);
    if (names.has(spot.name)) errors.push(`spots: duplicate name ${spot.name}`);
    names.add(spot.name);
    if (typeof spot.image === 'string' && spot.image.startsWith('assets/')) {
      if (!fs.existsSync(path.join(root, spot.image))) errors.push(`${spot.name}: missing ${spot.image}`);
    }
  });
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
try { new vm.Script(scripts[scripts.length - 1], { filename: 'index.html:inline-script' }); }
catch (e) { errors.push(`index.html inline script: ${e.message}`); }
if (errors.length) { console.error(errors.map(e => `FAIL: ${e}`).join('\n')); process.exit(1); }
console.log(`PASS: ${spots.spots.length} spots, ${metro.stations.length} metro stations, inline script syntax OK`);
