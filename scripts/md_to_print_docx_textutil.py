from __future__ import annotations

import html
import re
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


_ROOT = Path(__file__).resolve().parent.parent
SOURCE_MD = _ROOT / "PRD_v1.0.md"
TMP_HTML = Path(__file__).resolve().parent / "_print_temp.html"
TARGET_DOCX = _ROOT / "PRD_v1.0_印刷版.docx"
TARGET_DOCX_GW = _ROOT / "PRD_v1.0_印刷版_公文规范.docx"
TARGET_DOCX_FINAL = _ROOT / "PRD_v1.0_印刷版_公文规范_终稿.docx"
TARGET_DOCX_APPROVAL = _ROOT / "PRD_v1.0_印刷版_审批封面版.docx"

NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
ET.register_namespace("w", NS_W)
ET.register_namespace("r", NS_R)


def strip_md_inline(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    return text.strip()


def parse_lines(md_text: str):
    lines = md_text.splitlines()
    headings = []
    counters = [0] * 6
    rendered = []

    for raw in lines:
        line = raw.rstrip()
        if line.strip() == "---":
            rendered.append('<div class="spacer"></div>')
            continue

        hm = re.match(r"^(#{1,6})\s+(.*)$", line.strip())
        if hm:
            md_level = len(hm.group(1))
            title = strip_md_inline(hm.group(2))
            # 与 md_to_print_docx.py 一致：跳过正文单独 `#`，其余标题整体抬一级
            if md_level == 1:
                continue
            word_level = md_level - 1
            counters[word_level - 1] += 1
            for i in range(word_level, 6):
                counters[i] = 0
            number = ".".join(str(x) for x in counters[:word_level] if x > 0)
            hid = f"h-{len(headings)+1}"
            headings.append((word_level, number, title, hid))
            rendered.append(
                f'<h{word_level} id="{hid}"><span class="num">{html.escape(number)}</span> {html.escape(title)}</h{word_level}>'
            )
            continue

        bm = re.match(r"^\s*[-*]\s+(.*)$", line)
        if bm:
            rendered.append(f'<p class="bullet">• {html.escape(strip_md_inline(bm.group(1)))}</p>')
            continue

        nm = re.match(r"^\s*\d+[.)]\s+(.*)$", line)
        if nm:
            rendered.append(f'<p class="number">{html.escape(strip_md_inline(nm.group(1)))}</p>')
            continue

        if not line.strip():
            rendered.append("<p></p>")
        else:
            rendered.append(f"<p>{html.escape(strip_md_inline(line))}</p>")

    return headings, rendered


def build_html(md_text: str) -> str:
    headings, rendered = parse_lines(md_text)

    toc_rows = []
    for level, number, title, hid in headings:
        if level > 3:
            continue
        indent = (level - 1) * 24
        dots = "................................................"
        toc_rows.append(
            f'<div class="toc-row" style="margin-left:{indent}px;"><a href="#{hid}">{html.escape(number)} {html.escape(title)} <span class="dot">{dots}</span></a></div>'
        )

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>产品需求规格说明书（印刷版）</title>
  <style>
    body {{
      font-family: "FangSong", "STFangsong", "仿宋_GB2312", serif;
      font-size: 12pt;
      line-height: 1.7;
      margin: 0;
      color: #111;
    }}
    .page {{
      width: 100%;
      box-sizing: border-box;
      padding: 24pt 40pt;
    }}
    .cover {{
      text-align: center;
      padding-top: 140pt;
    }}
    .cover .title1 {{ font-size: 28pt; font-weight: bold; margin: 0; }}
    .cover .title2 {{ font-size: 24pt; font-weight: bold; margin: 12pt 0 0; }}
    .cover .title3 {{ font-size: 18pt; margin: 12pt 0 0; }}
    .cover .meta {{ font-size: 14pt; margin-top: 28pt; }}
    .page-break {{ page-break-after: always; }}
    h1, h2, h3, h4, h5, h6 {{
      font-family: "Heiti SC", "SimHei", "黑体", sans-serif;
      font-weight: bold;
      margin: 16pt 0 8pt;
      page-break-after: avoid;
    }}
    h1 {{ font-size: 18pt; page-break-before: always; }}
    h2 {{ font-size: 16pt; }}
    h3 {{ font-size: 14pt; }}
    h4, h5, h6 {{ font-size: 12pt; }}
    p {{ margin: 6pt 0; text-indent: 2em; }}
    .bullet, .number {{ text-indent: 0; margin-left: 1em; }}
    .toc-title {{ text-align: center; font-size: 20pt; font-weight: bold; margin: 18pt 0; }}
    .toc-row {{ margin: 4pt 0; text-indent: 0; }}
    .toc-row a {{ color: #111; text-decoration: none; }}
    .dot {{ color: #777; letter-spacing: 0.8px; }}
    .spacer {{ height: 6pt; }}
    .num {{ letter-spacing: 0.3px; }}
  </style>
</head>
<body>
  <div class="page cover">
    <p class="title1">招标文件范本编制工具平台</p>
    <p class="title2">产品需求规格说明书</p>
    <p class="title3">（印刷版）</p>
    <div style="margin-top:40pt; text-align:left; width:78%; margin-left:auto; margin-right:auto; font-size:14pt; line-height:2.1;">
      <div>项目名称：招标文件范本编制工具平台</div>
      <div>文档名称：产品需求规格说明书</div>
      <div>文档版本：v1.0</div>
      <div>编制部门：项目组</div>
      <div>编 制 人：________________</div>
      <div>审 核 人：________________</div>
      <div>批 准 人：________________</div>
      <div>编制日期：2026年4月27日</div>
    </div>
  </div>
  <div class="page-break"></div>

  <div class="page">
    <p class="toc-title">目录</p>
    {"".join(toc_rows)}
    <p style="text-indent:0;color:#666;margin-top:12pt;">注：如需自动页码目录，请在 Word 中全选并更新域。</p>
  </div>
  <div class="page-break"></div>

  <div class="page">
    {"".join(rendered)}
  </div>
</body>
</html>
"""


def next_rid(root: ET.Element) -> str:
    max_id = 0
    for rel in root.findall(f"{{{NS_REL}}}Relationship"):
        rid = rel.attrib.get("Id", "")
        m = re.match(r"rId(\d+)$", rid)
        if m:
            max_id = max(max_id, int(m.group(1)))
    return f"rId{max_id + 1}"


def inject_header_footer(docx_path: Path):
    with zipfile.ZipFile(docx_path, "r") as zin:
        file_map = {name: zin.read(name) for name in zin.namelist()}

    doc_xml = ET.fromstring(file_map["word/document.xml"])
    rels_xml = ET.fromstring(file_map["word/_rels/document.xml.rels"])
    content_types = ET.fromstring(file_map["[Content_Types].xml"])

    header_rid = next_rid(rels_xml)
    footer_rid = f"rId{int(header_rid[3:]) + 1}"

    ET.SubElement(
        rels_xml,
        f"{{{NS_REL}}}Relationship",
        {
            "Id": header_rid,
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header",
            "Target": "header1.xml",
        },
    )
    ET.SubElement(
        rels_xml,
        f"{{{NS_REL}}}Relationship",
        {
            "Id": footer_rid,
            "Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer",
            "Target": "footer1.xml",
        },
    )

    body = doc_xml.find(f".//{{{NS_W}}}body")
    if body is None:
        raise RuntimeError("document.xml 缺少 body 节点")
    sect_pr = body.find(f"{{{NS_W}}}sectPr")
    if sect_pr is None:
        sect_pr = ET.SubElement(body, f"{{{NS_W}}}sectPr")

    ET.SubElement(
        sect_pr,
        f"{{{NS_W}}}headerReference",
        {f"{{{NS_W}}}type": "default", f"{{{NS_R}}}id": header_rid},
    )
    ET.SubElement(
        sect_pr,
        f"{{{NS_W}}}footerReference",
        {f"{{{NS_W}}}type": "default", f"{{{NS_R}}}id": footer_rid},
    )
    ET.SubElement(sect_pr, f"{{{NS_W}}}titlePg")

    # A4 纸张 + 常用公文页边距（单位 twip）
    # A4: 11906 x 16838
    ET.SubElement(
        sect_pr,
        f"{{{NS_W}}}pgSz",
        {f"{{{NS_W}}}w": "11906", f"{{{NS_W}}}h": "16838"},
    )
    # 上下左右：2.54cm/3.17cm/2.54cm/2.54cm 近似
    ET.SubElement(
        sect_pr,
        f"{{{NS_W}}}pgMar",
        {
            f"{{{NS_W}}}top": "1440",
            f"{{{NS_W}}}right": "1440",
            f"{{{NS_W}}}bottom": "1800",
            f"{{{NS_W}}}left": "1440",
            f"{{{NS_W}}}header": "720",
            f"{{{NS_W}}}footer": "720",
            f"{{{NS_W}}}gutter": "0",
        },
    )

    # content types 注册
    ET.SubElement(
        content_types,
        "Override",
        {
            "PartName": "/word/header1.xml",
            "ContentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml",
        },
    )
    ET.SubElement(
        content_types,
        "Override",
        {
            "PartName": "/word/footer1.xml",
            "ContentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml",
        },
    )

    header_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="{NS_W}" xmlns:r="{NS_R}">
  <w:p>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="20"/></w:rPr>
      <w:t>招标文件范本编制工具平台 产品需求规格说明书（印刷版）</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="888888"/></w:pBdr></w:pPr>
  </w:p>
</w:hdr>
"""

    footer_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="{NS_W}" xmlns:r="{NS_R}">
  <w:p>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:t>第 </w:t></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:r><w:t> 页</w:t></w:r>
  </w:p>
</w:ftr>
"""

    file_map["word/document.xml"] = ET.tostring(doc_xml, encoding="utf-8", xml_declaration=True)
    file_map["word/_rels/document.xml.rels"] = ET.tostring(
        rels_xml, encoding="utf-8", xml_declaration=True
    )
    file_map["[Content_Types].xml"] = ET.tostring(
        content_types, encoding="utf-8", xml_declaration=True
    )
    file_map["word/header1.xml"] = header_xml.encode("utf-8")
    file_map["word/footer1.xml"] = footer_xml.encode("utf-8")

    with zipfile.ZipFile(docx_path, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for name, data in file_map.items():
            zout.writestr(name, data)


def main():
    if not SOURCE_MD.exists():
        raise FileNotFoundError(f"未找到文件：{SOURCE_MD}")

    md_text = SOURCE_MD.read_text(encoding="utf-8")
    html_text = build_html(md_text)
    TMP_HTML.write_text(html_text, encoding="utf-8")

    subprocess.run(
        [
            "textutil",
            "-convert",
            "docx",
            str(TMP_HTML),
            "-output",
            str(TARGET_DOCX),
        ],
        check=True,
    )

    inject_header_footer(TARGET_DOCX)
    # 额外输出一份“公文规范版”（同版式，单独文件名便于区分）
    TARGET_DOCX_GW.write_bytes(TARGET_DOCX.read_bytes())
    # 终稿文件（便于直接交付）
    TARGET_DOCX_FINAL.write_bytes(TARGET_DOCX.read_bytes())
    # 审批封面版（用于盖章与流程签批）
    TARGET_DOCX_APPROVAL.write_bytes(TARGET_DOCX.read_bytes())

    try:
        TMP_HTML.unlink(missing_ok=True)
    except OSError:
        pass

    print(f"生成完成：{TARGET_DOCX}")
    print(f"生成完成：{TARGET_DOCX_GW}")
    print(f"生成完成：{TARGET_DOCX_FINAL}")
    print(f"生成完成：{TARGET_DOCX_APPROVAL}")


if __name__ == "__main__":
    main()
