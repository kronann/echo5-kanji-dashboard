#!/usr/bin/env python3
"""Inline style.css, kanji_data.js and app.js into a single standalone HTML file.

Standalone output is required because the kiosk browser used on the Echo Show 5
(kiFOSSk) loads pages over file:// and does not allow a file:// page to fetch
sibling file:// resources (CSS/JS), so everything must ship in one HTML file.
"""
import pathlib

HERE = pathlib.Path(__file__).parent

html = (HERE / "index.html").read_text(encoding="utf-8")
css = (HERE / "style.css").read_text(encoding="utf-8")
kanji = (HERE / "kanji_data.js").read_text(encoding="utf-8")
app = (HERE / "app.js").read_text(encoding="utf-8")

html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    f"<style>\n{css}\n</style>",
)
html = html.replace(
    '<script src="kanji_data.js"></script>\n<script src="app.js"></script>',
    f"<script>\n{kanji}\n{app}\n</script>",
)

out = HERE / "index_standalone.html"
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size} bytes)")
