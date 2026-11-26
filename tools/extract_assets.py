#!/usr/bin/env python3
"""Move large inline assets out of index.html into assets/ — lossless (bytes are copied as-is).

* data: URIs (images, fonts) of at least MIN_B64 base64 chars inside <style> blocks and asset <script> blocks
  become relative URLs  assets/<sha256-12>.<ext>  (identical files are stored once).
* The core app script (the one defining pImg/DB) is left alone: its pictures (bestiary, preset personas)
  can be copied into characters / the GM board in Firebase and must stay self-contained for the sheet.
* The gzip book data (<script type="text/plain" id="vbookgz|yomigz">base64</script>) becomes assets/<id>.gz,
  the element keeps a data-src the loader fetches.
Safe to run again: already-extracted files are skipped.  Usage:  python3 tools/extract_assets.py [index.html]
"""
import base64, hashlib, os, re, sys

MIN_B64 = 6000
EXT = {'image/webp': 'webp', 'image/avif': 'avif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
       'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'image/svg+xml': 'svg'}
CORE_MARKERS = ('function pImg(', 'const DB={')

def main(path='index.html'):
    root = os.path.dirname(os.path.abspath(path))
    out_dir = os.path.join(root, 'assets'); os.makedirs(out_dir, exist_ok=True)
    s = open(path, encoding='utf-8').read()
    before = len(s.encode())

    blocks = []
    for m in re.finditer(r'<(style|script)\b([^>]*)>', s):
        end = s.find('</' + m.group(1), m.end())
        body = s[m.end():end]
        core = m.group(1) == 'script' and any(k in body for k in CORE_MARKERS)
        plain = 'text/plain' in m.group(2)
        blocks.append((m.end(), end, core or plain))
    def allowed(pos):
        for a, b, skip in blocks:
            if a <= pos < b: return not skip
        return False

    written = moved = 0
    def repl(m):
        nonlocal written, moved
        mime, b64 = m.group(1), m.group(3)
        if mime not in EXT or not allowed(m.start()): return m.group(0)
        try: data = base64.b64decode(b64, validate=True)
        except Exception: return m.group(0)
        name = hashlib.sha256(data).hexdigest()[:12] + '.' + EXT[mime]
        f = os.path.join(out_dir, name)
        if not os.path.exists(f):
            open(f, 'wb').write(data); written += 1
        moved += 1
        return 'assets/' + name
    s = re.sub(r'data:([a-z]+/[a-z0-9.+-]+)(;[a-z0-9=-]*)?;base64,([A-Za-z0-9+/=]{%d,})' % MIN_B64, repl, s)

    def gz(m):
        nonlocal written
        ident, b64 = m.group(1), m.group(2).strip()
        data = base64.b64decode(b64)
        name = ident + '.gz'
        open(os.path.join(out_dir, name), 'wb').write(data); written += 1
        return '<script type="text/plain" id="%s" data-src="assets/%s"></script>' % (ident, name)
    s = re.sub(r'<script type="text/plain" id="(vbookgz|yomigz)">([A-Za-z0-9+/=\s]+)</script>', gz, s)

    open(path, 'w', encoding='utf-8').write(s)
    print(f'{moved} inline assets -> assets/ ({written} files written); index.html {before/1e6:.1f} MB -> {len(s.encode())/1e6:.1f} MB')

if __name__ == '__main__':
    main(*sys.argv[1:])
