# -*- coding: utf-8 -*-
"""把 spots.json 里本地 spot-XX.jpg 映射为 Wikimedia Commons 缩略图 URL（只构造 URL，不下载）。"""
import json, hashlib, urllib.parse, re, sys

PATH = r'C:\Users\森\Desktop\新建文件夹 (3)\出片地图-源码\spots.json'

def commons_thumb_url(file_page_url, width=800):
    m = re.search(r'/wiki/File:(.+)$', file_page_url)
    if not m:
        return None
    name = urllib.parse.unquote(m.group(1)).replace(' ', '_')
    h = hashlib.md5(name.encode('utf-8')).hexdigest()
    ext = name.rsplit('.', 1)[-1].lower()
    if ext in ('jpg', 'jpeg'):
        thumb = f"{width}px-{name}"
    elif ext == 'png':
        thumb = f"{width}px-{name}"
    elif ext == 'svg':
        thumb = f"{width}px-{name}.png"
    else:
        return None
    q = urllib.parse.quote(name)
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{urllib.parse.quote(thumb)}"

with open(PATH, encoding='utf-8') as f:
    data = json.load(f)

ok, keep_local = [], []
for s in data['spots']:
    img = s.get('image', '')
    if not img.startswith('assets/photos/spot-'):
        continue
    ref = next((r for r in s.get('refs', []) if 'commons.wikimedia.org/wiki/File:' in r.get('url', '')), None)
    if not ref:
        keep_local.append(s['name'])
        continue
    t = commons_thumb_url(ref['url'])
    if t:
        ok.append((s['name'], img, t))
        s['image'] = t
    else:
        keep_local.append(s['name'])

if '--write' in sys.argv and ok:
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

print(f"mapped: {len(ok)}")
for name, old, new in ok:
    print(f"  [OK] {name}\n       {old}\n       -> {new}")
print(f"keep local: {len(keep_local)} -> {keep_local}")
