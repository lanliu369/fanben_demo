#!/usr/bin/env python3
"""Add 变更标注 column to requirements-traceability-skeleton.csv and emit highlighted HTML."""
from __future__ import annotations

import csv
import html
import io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "docs" / "requirements-traceability-skeleton.csv"
HTML_PATH = ROOT / "docs" / "requirements-traceability-skeleton-highlighted.html"

# 2026-05 PRD/实现对齐：本版修订过的需求 ID
UPDATED_IDS = {
    "DB-013",
    "DB-014",
    "RM-001",
    "RM-002",
    "RM-003",
    "RM-004",
    "RM-005",
    "RM-006",
    "RM-007",
    "RM-008",
    "RM-009",
    "RM-010",
    "RM-011",
    "RM-012",
    "RM-013",
    "RM-014",
    "RM-015",
    "RM-016",
    "RM-017",
    "RM-018",
    "RM-019",
    "RM-020",
    "RM-021",
    "RM-022",
    "RM-023",
    "TP-001",
    "TP-003",
    "TP-006",
    "TP-010",
    "TP-011",
    "TP-012",
    "WE-004",
    "WE-007",
    "WE-008",
    "GL-002",
    "GL-003",
    "GL-005",
    "GL-006",
    "GL-007",
    "GL-008",
    "GL-009",
    "GL-010",
    "GL-011",
    "GL-014",
    "INT-007",
    "NFR-004",
    "ACC-002",
    "ACC-006",
    "ACC-008",
    "OUT-BID-001",
    "OUT-BID-002",
}

NEW_IDS = {"RM-024"}

# 已不再作为本期验收口径（保留行仅作对照）；灰色「删除」标注
OBSOLETE_ROWS: list[list[str]] = [
    [
        "OBS-001",
        "（废止口径）",
        "资源-独立「保存草稿」「发布」与状态枚举",
        "删除",
        "—",
        "原骨架/半自动表中资源侧草稿·发布分态；现行 PRD 为单稿「保存」即生效，无资源级 draft/published 验收。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 RM-001、GL-002、RM-016～RM-018",
        "删除",
    ],
    [
        "OBS-002",
        "（废止口径）",
        "资源侧主流程-绑定章节/确认绑定/解绑",
        "删除",
        "—",
        "原 RM 细粒度绑定主路径；现行 PRD 以范本 WPS 侧栏插入建立关联，资源管理不提供绑定主流程。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 RM-004、GL-007",
        "删除",
    ],
    [
        "OBS-003",
        "（废止口径）",
        "范本状态「已归档」及同步跳过 archived",
        "删除",
        "—",
        "原 DB/TP/GL/ACC 中 archived 范本与「跳过已归档」联动；现行实现与 PRD 仅 draft/published。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 DB-013、TP-001、GL-003、GL-009",
        "删除",
    ],
    [
        "OBS-004",
        "（废止口径）",
        "规则2-归档快照不受资源变 / 仅联动非归档范本",
        "删除",
        "—",
        "原 GL-005～GL-007 类旧表述；现行规则2 以 resolveSectionRichHtml + 显式同步到范本为准，无范本归档分支。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 GL-005～GL-011",
        "删除",
    ],
    [
        "OBS-005",
        "（废止口径）",
        "WPS 插入失败-剪贴板兜底或手工粘贴",
        "删除",
        "—",
        "原 WE 兜底表述；现行 PRD/实现仅弹窗「重试」「取消」，无粘贴回退。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 WE-004、GL-014",
        "删除",
    ],
    [
        "OBS-006",
        "（废止口径）",
        "验收-「不验收范本到招标文件」字面条款",
        "删除",
        "—",
        "旧 ACC-002 占位；已改为「招标文件管理 Mock 演示」可选验收，见 ACC-002。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 ACC-002",
        "删除",
    ],
    [
        "OBS-007",
        "（废止口径）",
        "验收-归档不受资源影响（旧一致性条款）",
        "删除",
        "—",
        "旧 ACC-006；已改为资源同步与章节解析一致，无归档隔离验收。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 ACC-006",
        "删除",
    ],
    [
        "OBS-008",
        "（废止口径）",
        "全局规则3-泛化「失败回退方案」含隐式绕过",
        "删除",
        "—",
        "旧 GL-014 泛化回退；WPS 插入场景已收窄为 GL-014/NFR-004 现行表述。",
        "—",
        "不作为本期通过条件。",
        "—",
        "—",
        "",
        "对照 GL-014、NFR-004",
        "删除",
    ],
]


def main() -> None:
    text = CSV_PATH.read_text(encoding="utf-8")
    reader = csv.reader(text.splitlines())
    rows = list(reader)
    if not rows:
        raise SystemExit("empty csv")

    header = rows[0]
    if "变更标注" in header:
        # strip existing 变更标注 and OBS rows for idempotent re-run
        idx = header.index("变更标注")
        header = [h for h in header if h != "变更标注"]
        new_body: list[list[str]] = []
        for r in rows[1:]:
            if not r or r[0].startswith("OBS-"):
                continue
            r = [c for j, c in enumerate(r) if j != idx]
            new_body.append(r)
        rows = [header] + new_body

    header = rows[0]
    header.append("变更标注")
    out_rows: list[list[str]] = [header]

    for r in rows[1:]:
        if not r:
            continue
        rid = r[0].strip()
        tag = ""
        if rid in NEW_IDS:
            tag = "新增"
        elif rid in UPDATED_IDS:
            tag = "更新"
        r = list(r)
        while len(r) < len(header) - 1:
            r.append("")
        r.append(tag)
        out_rows.append(r)

    out_rows.extend(OBSOLETE_ROWS)

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerows(out_rows)
    CSV_PATH.write_text(buf.getvalue(), encoding="utf-8")

    # HTML
    thead = "".join(f"<th>{html.escape(c)}</th>" for c in out_rows[0])
    tbody_parts: list[str] = []
    for r in out_rows[1:]:
        tag = r[-1] if r else ""
        row_class = ""
        if tag == "更新":
            row_class = ' class="row-upd"'
        elif tag == "新增":
            row_class = ' class="row-new"'
        elif tag == "删除":
            row_class = ' class="row-del"'
        cells = "".join(f"<td>{html.escape(c)}</td>" for c in r)
        tbody_parts.append(f"<tr{row_class}>{cells}</tr>")
    tbody = "\n".join(tbody_parts)

    doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>需求追踪骨架表 · 变更标注（红/灰）</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 1rem; background: #f8fafc; }}
    h1 {{ font-size: 1.1rem; color: #0f172a; }}
    .legend {{ margin: 0.75rem 0 1rem; font-size: 0.9rem; color: #334155; }}
    .legend span.upd {{ color: #b91c1c; font-weight: 600; }}
    .legend span.new {{ color: #b91c1c; font-weight: 600; }}
    .legend span.del {{ color: #64748b; text-decoration: line-through; }}
    table {{ border-collapse: collapse; width: 100%; background: #fff; font-size: 12px; box-shadow: 0 1px 3px rgb(0 0 0 / 0.08); }}
    th, td {{ border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }}
    th {{ background: #f1f5f9; position: sticky; top: 0; z-index: 1; }}
    tr.row-upd td {{ color: #b91c1c; }}
    tr.row-new td {{ color: #b91c1c; font-weight: 600; }}
    tr.row-del td {{ color: #64748b; text-decoration: line-through; background: #f8fafc; }}
    tr.row-del td:last-child {{ text-decoration: none; color: #64748b; font-weight: 600; }}
    .note {{ font-size: 0.85rem; color: #64748b; margin-top: 1rem; }}
  </style>
</head>
<body>
  <h1>requirements-traceability-skeleton · 变更可视化</h1>
  <p class="legend">
    <span class="upd">红色行</span>：本版已修订（对齐 PRD 2026-05）；
    <span class="new">红色行</span>：本版新增需求行；
    <span class="del">灰色删除线</span>：已废止口径（仅对照，不作为本期验收）。
  </p>
  <div style="overflow:auto; max-height:85vh;">
  <table>
    <thead><tr>{thead}</tr></thead>
    <tbody>
{tbody}
    </tbody>
  </table>
  </div>
  <p class="note">源数据：<code>docs/requirements-traceability-skeleton.csv</code>（末列「变更标注」+ OBS 行）。生成脚本：<code>scripts/annotate_traceability_skeleton.py</code></p>
</body>
</html>
"""
    HTML_PATH.write_text(doc, encoding="utf-8")
    print(f"Wrote {CSV_PATH} ({len(out_rows)} rows)")
    print(f"Wrote {HTML_PATH}")


if __name__ == "__main__":
    main()
