#!/usr/bin/env python3
"""Audit production SVG structure and assemble a local logo comparison page."""
import argparse
import html
import json
import math
from pathlib import Path
import re
import shutil
import sys
import xml.etree.ElementTree as ET


def audit(filename):
    findings = []
    try:
        content = filename.read_text(encoding="utf-8")
        root = ET.fromstring(content)
    except (OSError, UnicodeError, ET.ParseError) as error:
        return [f"Cannot read SVG: {type(error).__name__}"], []
    tag = lambda element: element.tag.rsplit("}", 1)[-1]
    if tag(root) != "svg":
        findings.append("The root element is not SVG.")
    try:
        bounds = [float(value) for value in re.split(r"[\s,]+", root.get("viewBox", "").strip())]
        if len(bounds) != 4 or not all(math.isfinite(value) for value in bounds) or min(bounds[2:]) <= 0:
            raise ValueError()
    except ValueError:
        findings.append("A finite viewBox with positive width and height is required.")
    tags = [tag(element) for element in root.iter()]
    if "text" in tags:
        findings.append("Live text remains: outline the production export and keep live type in its master.")
    if "image" in tags or "feImage" in tags:
        findings.append("Raster/image content remains in this vector production export.")
    if "script" in tags or "foreignObject" in tags:
        findings.append("Executable or embedded HTML content is not a production logo asset.")
    ids = [element.get("id") for element in root.iter() if element.get("id")]
    if len(ids) != len(set(ids)):
        findings.append("Duplicate SVG IDs may change the rendered appearance.")
    for element in root.iter():
        for key, value in element.attrib.items():
            name = key.rsplit("}", 1)[-1]
            if name.lower().startswith("on"):
                findings.append("SVG event handlers must not be present.")
            if name in {"href", "src"} and value and not value.startswith("#"):
                findings.append("The SVG references an external resource.")
    for reference in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", content):
        if not reference.startswith("#"):
            findings.append("The SVG depends on an external paint, font or resource.")
    if "@import" in content.lower():
        findings.append("The SVG imports an external stylesheet.")
    if not set(tags).intersection({"path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "use"}):
        findings.append("No visible vector geometry was found.")
    notes = ["Filters/effects need a visual flat-mark comparison."] if "filter" in tags else []
    return sorted(set(findings)), notes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mark", type=Path)
    parser.add_argument("--reverse-mark", type=Path)
    parser.add_argument("--wordmark", type=Path)
    parser.add_argument("--reverse-wordmark", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not args.mark and not args.wordmark:
        parser.error("Supply a --mark or --wordmark production SVG.")
    output = args.out.resolve()
    assets = output / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    reports, panels = {}, []
    for key, label, dark, sizes in [
        ("mark", "Mark on light", False, [16, 24, 32, 64, 128]),
        ("reverse_mark", "Reversed mark", True, [16, 24, 32, 64, 128]),
        ("wordmark", "Wordmark / signature on light", False, [120, 180, 240, 360]),
        ("reverse_wordmark", "Reversed wordmark / signature", True, [120, 180, 240, 360]),
    ]:
        source = getattr(args, key)
        if not source:
            continue
        if source.suffix.lower() != ".svg":
            reports[key] = {"findings": ["Use a production SVG export, not a raster preview."], "notes": []}
            continue
        findings, notes = audit(source)
        reports[key] = {"findings": findings, "notes": notes}
        if findings:
            continue
        name = f"{key}.svg"
        if source.resolve() != (assets / name).resolve():
            shutil.copyfile(source, assets / name)
        rows = []
        for size in sizes:
            mark = key.endswith("mark") and "wordmark" not in key
            dimensions = f"width:{size}px;height:{size}px;object-fit:contain" if mark else f"width:{size}px;height:auto"
            rows.append(f'<figure><img src="assets/{name}" style="{dimensions}" alt="{html.escape(label)} at {size} pixels"><figcaption>{size}px wide</figcaption></figure>')
        panels.append(f'<section class="{"dark" if dark else "light"}"><h2>{label}</h2><div class="samples">{"".join(rows)}</div></section>')
    count = sum(len(report["findings"]) for report in reports.values())
    report = {"ok": count == 0, "findingCount": count, "assets": reports, "manualReviewRequired": ["Business relevance and distinctiveness", "Silhouette and counter readability at actual size", "Optical size, kerning and baseline", "Transparency on both backgrounds", "Reopened VectorCraft master compared with export"], "missingVariants": [key for key in ["reverse_mark", "reverse_wordmark"] if getattr(args, key.replace("reverse_", "")) and not getattr(args, key)]}
    style = """body{margin:0;background:#e8e9ec;color:#161a20;font:15px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:32px}h1{line-height:1.1}section{margin:24px 0;border-radius:12px;padding:24px;border:1px solid #afb3bb}.light{background:#fff;color:#161a20}.dark{background:#151923;color:#f6f7fa}h2{font-size:16px}.samples{display:flex;align-items:center;flex-wrap:wrap;gap:28px}figure{margin:0;padding:12px;max-width:100%;overflow:auto}img{display:block;flex-shrink:0}figcaption{font-size:12px;margin-top:12px}aside{padding:16px;border:1px solid #8b8f99;border-radius:8px}a{color:inherit}li{margin:6px 0}"""
    problems = "".join(f"<li>{html.escape(key)}: {html.escape(item)}</li>" for key, data in reports.items() for item in data["findings"])
    page = f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logo production proofs</title><style>{style}</style><main><h1>Logo production proofs</h1><p>Compare actual export sizes. Inspect the mark, spacing and cutouts before judging applications.</p><aside><strong>Structure findings: {count}.</strong> This does not certify visual quality or originality. Missing reversed variants: {html.escape(", ".join(report["missingVariants"]) or "none for the supplied primary forms")}.</aside><ul>{problems}</ul>{"".join(panels)}<p><a href="findings.json">Structural findings and manual review checklist</a></p></main></html>'
    (output / "index.html").write_text(page, encoding="utf-8")
    (output / "findings.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": report["ok"], "findingCount": count, "proof": str(output / "index.html")}))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
