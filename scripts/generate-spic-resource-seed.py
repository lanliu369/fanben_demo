#!/usr/bin/env python3
"""从 02-国家电投设备采购招标文件范本（2026年版）-202603.docx 按节合并拆分为资源 Mock 种子。

拆分规则：
  - 以 Word 标题（章 style 2 / 节 style 3 / 条 style 4）为边界，将下属正文段落与表格合并为一条资源
  - 跳过目录、封皮占位、签章栏等噪声段落
  - 合并后整节正文过短（且无表格）的节不入库
"""

from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCX = ROOT / "02-国家电投设备采购招标文件范本（2026年版）-202603.docx"
OUT_TS = ROOT / "src/lib/seed/spicDeviceProcurement202603Resources.ts"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

# 合并后整节最低字符数（去空白后）；含表格的节不受此限
MIN_SECTION_LEN = 30

HEADING_STYLES = {"2", "3", "4", "69"}
# 作为合并边界的标题级别（章 / 节 / 条）
SECTION_BOUNDARY_STYLES = {"2", "3", "4"}

SKIP_PATTERNS = [
    re.compile(r"^目\s*录$"),
    re.compile(r"^第[一二三四]卷$"),
    re.compile(r"^20\s*年\s*月$"),
    re.compile(r"^招标编号"),
    re.compile(r"^国家电力投资集团有限公司$"),
    re.compile(r"^设备采购招标文件范本$"),
    re.compile(r"^（基础类\d+年版）$"),
    re.compile(r"^【编注"),
    re.compile(r"^【说明"),
    re.compile(r"^【第一章说明"),
    re.compile(r"^重要提示[：:]?$"),
    re.compile(r"^粘贴处$"),
    re.compile(r"扫描件粘贴处$"),
]

STAMP_MODULE_PATTERNS = [
    re.compile(r"^投标人\s*[：:].*（盖单位章）"),
    re.compile(r"^法定代表人（单位负责人）或其委托代理人\s*[：:].*（签字或盖章）"),
    re.compile(r"^法定代表人（单位负责人）\s*[：:].*（签字或盖章）"),
    re.compile(r"^委托代理人\s*[：:].*（签字或盖章）"),
    re.compile(r"^联合体牵头人名称\s*[：:].*（盖单位章）"),
    re.compile(r"^联合体成员名称\s*[：:].*（盖单位章）"),
    re.compile(r"^单位（盖章）"),
    re.compile(r"^投标人名称\s*[：:].*（盖单位章）"),
    re.compile(r"^制造商名称\s*[：:].*（盖单位章）"),
    re.compile(r"^异议人（签字盖章）"),
    re.compile(r"^注：本身份证明需由投标人加盖单位章"),
    re.compile(r"^注：本授权委托书需由投标人加盖单位章"),
]

BID_FORMAT_COVER_PATTERNS = [
    re.compile(r"^公司$"),
    re.compile(r"^投标文件$"),
    re.compile(r"^年\s*月\s*日$"),
    re.compile(r"^二〇\s*年度第\s*批招标$"),
    re.compile(r"^（标段名称\s*[：:]\s*）$"),
    re.compile(r"^（(?:商务资信|技术|价格)部分包封[ABC]）$"),
    re.compile(r"^投标文件(?:商务资信|技术|价格)部分$"),
    re.compile(r"^招标人名称\s*[：:]\s*$"),
    re.compile(r"^日期\s*[：:]\s*年\s*月\s*日$"),
    re.compile(r"^或$"),
    re.compile(r"^……+$"),
]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def is_stamp_module_content(text: str, html: str) -> bool:
    t = normalize_text(text)
    if not t and "（盖单位章）" not in html and "签字盖章" not in html:
        return False
    if any(p.search(t) for p in STAMP_MODULE_PATTERNS):
        return True
    if len(t) <= 100 and re.search(r"（盖单位章）|（签字或盖章）|（签字盖章）", t):
        if re.search(r"投标人|法定代表人|委托代理人|联合体|单位（盖章）|异议人", t):
            return True
    if "异议人（签字盖章）" in html and "提出异议事项的基本事实" in html:
        return True
    return False


def is_bid_format_cover_placeholder(text: str, chapter: str | None, section_stack: list[str]) -> bool:
    t = normalize_text(text)
    if not t:
        return False
    ch = chapter or ""
    ctx = " ".join(section_stack)
    in_bid_format = ch.startswith("第六章") or bool(
        re.search(r"投标文件(?:商务资信|技术|价格)部分", ctx)
    )
    if not in_bid_format:
        return False
    return any(p.match(t) for p in BID_FORMAT_COVER_PATTERNS)


def is_toc_entry(text: str) -> bool:
    return bool(re.match(r"^(第一卷|第二卷|第三卷|第[一二三四五六]章|投标人须知前附表|\d+\.)", text)) and bool(
        re.search(r"\d+$", text.replace(" ", ""))
    )


def should_skip_paragraph(text: str, style: str, chapter: str | None, section_stack: list[str]) -> bool:
    """单段是否应跳过（不入合并缓冲）。"""
    t = normalize_text(text)
    if not t:
        return True
    if style in HEADING_STYLES:
        return True
    if any(p.search(t) for p in SKIP_PATTERNS):
        return True
    if is_toc_entry(t):
        return True
    if is_stamp_module_content(t, f"<p>{escape(t)}</p>"):
        return True
    if is_bid_format_cover_placeholder(t, chapter, section_stack):
        return True
    if len(t) < 80 and re.match(r"^[^。！？；]{0,40}[：:]\s*$", t):
        return True
    return False


def should_include_table(html: str, chapter: str | None, section_stack: list[str]) -> bool:
    if is_stamp_module_content("（表格）", html):
        return False
    if html.count("<tr>") == 0:
        return False
    return True


def para_text(p: ET.Element) -> str:
    parts: list[str] = []
    for t in p.iter(W + "t"):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return "".join(parts).strip()


def style_id(p: ET.Element) -> str:
    p_pr = p.find("w:pPr", NS)
    if p_pr is None:
        return ""
    ps = p_pr.find("w:pStyle", NS)
    return ps.get(W + "val", "") if ps is not None else ""


def table_to_html(tbl: ET.Element) -> str:
    rows = tbl.findall("w:tr", NS)
    if not rows:
        return "<p>（表格）</p>"

    matrix: list[list[dict]] = []
    for tr in rows:
        row: list[dict] = []
        for tc in tr.findall("w:tc", NS):
            tc_pr = tc.find("w:tcPr", NS)
            colspan = 1
            vmerge: str | None = None
            if tc_pr is not None:
                gs = tc_pr.find("w:gridSpan", NS)
                if gs is not None:
                    colspan = max(1, int(gs.get(W + "val", "1")))
                vm = tc_pr.find("w:vMerge", NS)
                if vm is not None:
                    vmerge = vm.get(W + "val", "continue") or "continue"
            cell_parts: list[str] = []
            for p in tc.findall(".//w:p", NS):
                t = para_text(p)
                if t:
                    cell_parts.append(escape(t))
            row.append(
                {
                    "text": "<br/>".join(cell_parts) if cell_parts else "&nbsp;",
                    "colspan": colspan,
                    "vmerge": vmerge,
                }
            )
        if row:
            matrix.append(row)

    if not matrix:
        return "<p>（表格）</p>"

    for ri, row in enumerate(matrix):
        for ci, cell in enumerate(row):
            if cell["vmerge"] != "restart":
                continue
            rowspan = 1
            for rj in range(ri + 1, len(matrix)):
                if ci >= len(matrix[rj]):
                    break
                below = matrix[rj][ci]
                if below.get("vmerge") == "continue":
                    rowspan += 1
                else:
                    break
            cell["rowspan"] = rowspan

    rows_html: list[str] = []
    for row in matrix:
        cells_html: list[str] = []
        for cell in row:
            if cell.get("vmerge") == "continue":
                continue
            attrs: list[str] = []
            if cell["colspan"] > 1:
                attrs.append(f'colspan="{cell["colspan"]}"')
            if cell.get("rowspan", 1) > 1:
                attrs.append(f'rowspan="{cell["rowspan"]}"')
            attr_str = f' {" ".join(attrs)}' if attrs else ""
            cells_html.append(f"<td{attr_str}>{cell['text']}</td>")
        if cells_html:
            rows_html.append(f"<tr>{''.join(cells_html)}</tr>")

    if not rows_html:
        return "<p>（表格）</p>"
    return (
        '<table border="1" cellpadding="4" cellspacing="0" '
        'style="border-collapse:collapse;width:100%;">'
        f"<tbody>{''.join(rows_html)}</tbody></table>"
    )


def classify(chapter: str | None, section: str, text: str, html: str) -> str:
    ch = chapter or ""
    if ch.startswith("第三章") or "第三章 评标办法" in ch:
        return "evaluation"
    if ch.startswith("第四章") or "第四章 合同条款" in ch:
        return "contract-clause"
    # 资格条件：仅第二章「1.4 投标人资格要求」整节（不按正文关键词误判）
    sec = normalize_text(section)
    if re.match(r"^1\.4(\s|$)", sec) or sec.startswith("1.4 投标人资格要求"):
        return "qualification"
    return "text"


def short_name(text: str, max_len: int = 48) -> str:
    t = normalize_text(text)
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def table_display_name(html: str) -> str:
    m = re.search(r"<td>([^<]{2,40})</td>", html)
    if m:
        label = normalize_text(m.group(1))
        if label and label not in ("序号", "条款号", "序号 "):
            return f"（表格）{label}"
    return "（表格）"


def load_blocks() -> list[dict]:
    with zipfile.ZipFile(DOCX) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find("w:body", NS)
    blocks: list[dict] = []
    for child in body or []:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            text = para_text(child)
            blocks.append(
                {
                    "kind": "p",
                    "style": style_id(child),
                    "text": text,
                    "html": f"<p>{escape(text)}</p>" if text else "",
                }
            )
        elif tag == "tbl":
            html = table_to_html(child)
            blocks.append({"kind": "tbl", "style": "", "text": "（表格）", "html": html})
    return blocks


def update_section_stack(section_stack: list[str], style: str, text: str) -> list[str]:
    if style not in HEADING_STYLES or not text:
        return section_stack
    if style == "2" and text in ("第一卷", "第二卷", "第三卷"):
        return section_stack
    if style == "2":
        return [text]
    if style == "3":
        base = section_stack[:1] if section_stack else []
        return base + [text]
    base = section_stack[:2] if len(section_stack) >= 2 else section_stack[:1]
    return base + [text]


def is_section_boundary(style: str, text: str) -> bool:
    if style not in SECTION_BOUNDARY_STYLES or not text:
        return False
    if style == "2" and text in ("第一卷", "第二卷", "第三卷"):
        return False
    if style == "2" and not re.match(r"^第[一二三四五六]章", text):
        return False
    return True


def main() -> None:
    blocks = load_blocks()
    chapter: str | None = None
    section_stack: list[str] = []
    current_section = "正文"
    in_usage = False
    skip_toc = False
    initial_toc_passed = False
    skip_inner_toc = False
    resources: list[dict] = []
    seq = 0

    buffer_html: list[str] = []
    buffer_plain: list[str] = []

    def flush_section() -> None:
        nonlocal seq
        if not buffer_html:
            return
        merged_html = "".join(buffer_html)
        plain = normalize_text(" ".join(buffer_plain))
        has_table = "<table" in merged_html
        if not has_table and len(plain) < MIN_SECTION_LEN:
            buffer_html.clear()
            buffer_plain.clear()
            return

        ctx = current_section or (section_stack[-1] if section_stack else chapter or "正文")
        if has_table and not plain:
            preview = table_display_name(merged_html)
        else:
            preview = short_name(buffer_plain[0] if buffer_plain else plain)

        name = f"{ctx}｜{preview}"
        mod = classify(chapter, ctx, plain or "（表格）", merged_html)
        seq += 1
        resources.append(
            {
                "id": f"spic-202603-{seq:04d}",
                "name": name,
                "module": mod,
                "content": merged_html,
                "description": f"国家电投设备采购招标文件范本（2026年版）— {chapter or '通用'}",
                "sourceDoc": "02-国家电投设备采购招标文件范本（2026年版）-202603.docx",
            }
        )
        buffer_html.clear()
        buffer_plain.clear()

    for b in blocks:
        text = b.get("text") or ""
        html = b.get("html") or ""

        if b["kind"] == "p" and text == "使用说明":
            in_usage = True
            skip_toc = False
        if b["kind"] == "p" and text in ("目  录", "目 录"):
            if not initial_toc_passed:
                skip_toc = True
            else:
                skip_inner_toc = True
            continue
        if skip_inner_toc:
            if b["kind"] == "p" and b["style"] == "3" and text:
                skip_inner_toc = False
            else:
                continue
        if skip_toc:
            if b["kind"] == "p" and (
                b["style"] == "2" and re.match(r"^第[一二三四五六]章", text) or text == "第一卷"
            ):
                skip_toc = False
                initial_toc_passed = True
            else:
                continue
        if not in_usage and not skip_toc:
            if b["kind"] == "p" and text == "使用说明":
                in_usage = True
            else:
                continue

        # 章 / 节 / 条标题：刷新上一节合并缓冲
        if b["kind"] == "p" and is_section_boundary(b["style"], text):
            flush_section()
            skip_inner_toc = False
            if b["style"] == "2" and re.match(r"^第[一二三四五六]章", text):
                chapter = text
                section_stack = [chapter]
                current_section = text
            else:
                section_stack = update_section_stack(section_stack, b["style"], text)
                current_section = text
            continue

        # 其它标题（style 69 等）：仅更新上下文，不切开合并节
        if b["kind"] == "p" and b["style"] in HEADING_STYLES and text:
            section_stack = update_section_stack(section_stack, b["style"], text)
            continue

        if b["kind"] == "tbl":
            if should_include_table(html, chapter, section_stack):
                buffer_html.append(html)
            continue

        if b["kind"] == "p" and not should_skip_paragraph(text, b["style"], chapter, section_stack):
            buffer_html.append(html)
            buffer_plain.append(text)

    flush_section()

    from collections import Counter

    counts = Counter(r["module"] for r in resources)
    para_n = sum(1 for r in resources if not r["content"].startswith("<table"))
    tbl_n = sum(1 for r in resources if "<table" in r["content"] and not r["content"].startswith("<table"))
    merged_n = sum(1 for r in resources if "<table" in r["content"] and r["content"].startswith("<p"))
    print(
        f"Generated resources: {len(resources)} "
        f"(text-only={para_n}, table-only={tbl_n}, merged={merged_n})",
        dict(counts),
    )

    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    json_payload = json.dumps(resources, ensure_ascii=False, indent=2)
    ts = f'''import type {{ TextFragment }} from '@/types';

/** 国家电投设备采购招标文件范本（2026年版）按节合并拆分的资源 Mock（自动生成，勿手改） */
const SPIC_202603_RAW = {json_payload} as const;

export const SPIC_DEVICE_PROCUREMENT_202603_RESOURCES: TextFragment[] = SPIC_202603_RAW.map((row) => ({{
  id: row.id,
  name: row.name,
  module: row.module,
  content: row.content,
  description: row.description,
  createdAt: '2026-03-01',
  updatedAt: '2026-03-01',
  contentVersion: 1,
  templateSyncedVersion: {{}},
  bindings: [],
  versions: [],
  applicableToAllLotLevels: true,
}}));
'''
    OUT_TS.write_text(ts, encoding="utf-8")
    print("Wrote", OUT_TS)


if __name__ == "__main__":
    main()
