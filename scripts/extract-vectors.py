#!/usr/bin/env python3
"""Rebuild only the clean A-14..A-17 SVG wall+finished-surface layers from owner-supplied PDF.

Requirements (dev only): pip install PyMuPDF lxml
Usage: python scripts/extract-vectors.py /private/path/to/design.pdf

This script intentionally does not publish the PDF or reproduce title blocks.
The manually verified room/door register lives in src/data/architectural-plans.json.
"""
import argparse
import base64
import gzip
import json
from pathlib import Path
from lxml import etree
import fitz

SHEETS = {"garage": 14, "level-1": 15, "level-2": 16, "level-3": 17}
SVG = "http://www.w3.org/2000/svg"


def extract(page, label):
    drawings = [d for d in page.get_drawings()
                if d["fill"] and all(abs(v - 0.392157) < 0.005 for v in d["fill"])]
    if not drawings:
        raise ValueError(f"No structural fills on {label}")
    rect = fitz.Rect(10000, 10000, 0, 0)
    for d in drawings:
        rect.include_rect(d["rect"])
    page.set_cropbox(fitz.Rect(max(0, rect.x0 - 34), max(0, rect.y0 - 25),
                               min(page.rect.width, rect.x1 + 34),
                               min(page.rect.height, rect.y1 + 40)))
    root = etree.fromstring(page.get_svg_image(text_as_path=False).encode())
    for el in list(root.iter()):
        parent = el.getparent()
        if parent is None:
            continue
        if etree.QName(el.tag).localname == "defs" or any(
                etree.QName(a.tag).localname == "defs" for a in el.iterancestors()):
            continue
        kind = etree.QName(el.tag).localname
        if kind == "path":
            color = el.get("fill", "")
            stroke = el.get("stroke", "")
            if color == "#646464":
                el.set("class", "source-wall")
            elif stroke in ("#00aa00", "#00c800") or color in ("#00aa00", "#00c800"):
                el.set("class", "source-finish")
            else:
                parent.remove(el)
        elif kind in ("text", "tspan", "image", "rect", "line", "polyline",
                      "polygon", "circle", "ellipse", "use"):
            parent.remove(el)
    for el in reversed(list(root.iter())):
        kind = etree.QName(el.tag).localname
        if kind in ("mask", "image", "text", "tspan") and el.getparent() is not None:
            el.getparent().remove(el)
        elif kind == "g" and len(el) == 0 and el.getparent() is not None:
            el.getparent().remove(el)
    root.set("data-source", label)
    return etree.tostring(root, encoding="utf-8", xml_declaration=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", help="Private owner-supplied source, never committed")
    parser.add_argument("--output", default="src/data/source-traces.json")
    args = parser.parse_args()
    doc = fitz.open(args.pdf)
    if doc.page_count != 94:
        raise ValueError(f"Expected 94 source pages, got {doc.page_count}")
    result = {}
    for floor, page in SHEETS.items():
        svg = extract(doc[page - 1], f"A-{page}")
        result[floor] = base64.b64encode(gzip.compress(svg, compresslevel=9, mtime=0)).decode("ascii")
        print(f"{floor}: {len(svg)} bytes source SVG")
    Path(args.output).write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print("Done. No source PDF included in output.")


if __name__ == "__main__":
    main()
