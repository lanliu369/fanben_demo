/**
 * 导出「招采分类」页图标：按模块命名 + 设计稿像素尺寸（SVG + @2x PNG）
 * 运行: node scripts/export-category-page-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'design-assets', '招采分类-页面图标');

/** Tailwind 色值（与页面 class 一致） */
const C = {
  blue600: '#2563eb',
  emerald600: '#059669',
  amber600: '#d97706',
  violet600: '#7c3aed',
  pink600: '#db2777',
  sky600: '#0284c7',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate700: '#334155',
  rose600: '#e11d48',
  emerald600Icon: '#059669',
};

/** [模块, 文件名前缀, lucide 文件名, 尺寸 px, 颜色, strokeWidth] */
const ICONS = [
  // —— 顶部统计卡片 category-page ——
  ['category-page', 'stat-l1-business-sector', 'building-2', 16, C.blue600, 2],
  ['category-page', 'stat-l2-energy-type', 'zap', 16, C.emerald600, 2],
  ['category-page', 'stat-l3-business-stage', 'layers', 16, C.amber600, 2],
  ['category-page', 'stat-l4-business-nature', 'folder-tree', 16, C.violet600, 2],
  ['category-page', 'stat-l5-domain-level', 'boxes', 16, C.pink600, 2],
  ['category-page', 'stat-l6-lot-level', 'folder-tree', 16, C.sky600, 2],
  // —— 工具栏 ——
  ['category-page', 'toolbar-batch-upload', 'upload', 14, C.blue600, 2],
  ['category-page', 'toolbar-export-lots', 'download', 14, C.violet600, 2],
  ['category-page', 'toolbar-operation-log', 'clipboard-list', 14, C.slate500, 2],
  // —— 筛选栏 category-filter-bar ——
  ['category-filter-bar', 'search', 'search', 14, C.slate400, 2],
  ['category-filter-bar', 'advanced-filter', 'sliders-horizontal', 14, C.slate700, 2],
  ['category-filter-bar', 'advanced-toggle', 'chevron-down', 14, C.slate500, 2],
  ['category-filter-bar', 'reset-filters', 'rotate-ccw', 14, C.slate500, 2],
  // —— 目录树 classification-nav-panel ——
  ['classification-nav-panel', 'header-add-root', 'plus', 14, C.blue600, 2],
  ['classification-nav-panel', 'search', 'search', 14, C.slate400, 2],
  ['classification-nav-panel', 'node-expand', 'chevron-right', 14, C.slate400, 2],
  ['classification-nav-panel', 'node-add-child', 'plus', 14, C.slate500, 2],
  ['classification-nav-panel', 'node-edit', 'pencil', 14, C.slate500, 2],
  ['classification-nav-panel', 'node-delete', 'trash-2', 14, C.slate500, 2],
  ['classification-nav-panel', 'node-delete-hover', 'trash-2', 14, C.rose600, 2],
  ['classification-nav-panel', 'level-1-sector', 'building-2', 14, C.blue600, 2],
  ['classification-nav-panel', 'level-2-energy', 'folder', 14, C.emerald600, 2],
  ['classification-nav-panel', 'level-3-stage', 'file-text', 14, C.amber600, 2],
  ['classification-nav-panel', 'level-4-nature', 'layers', 14, C.violet600, 2],
  ['classification-nav-panel', 'level-5-domain', 'star', 14, C.pink600, 2],
  ['classification-nav-panel', 'level-6-lot', 'circle-dot', 14, C.slate500, 2],
  // —— 右侧详情 category-directory-workspace ——
  ['category-directory-workspace', 'breadcrumb-chevron', 'chevron-right', 12, C.slate300, 2],
  ['category-directory-workspace', 'section-basic-info', 'info', 16, C.blue600, 2],
  ['category-directory-workspace', 'section-tree-description', 'file-text', 16, C.blue600, 2],
  ['category-directory-workspace', 'empty-state', 'folder-tree', 20, C.blue600, 2],
  // —— 目录表单弹窗 directory-node-form-dialog ——
  ['directory-node-form-dialog', 'close', 'x', 16, C.slate400, 2],
  // —— 批量上传 batch-import-dialog ——
  ['batch-import-dialog', 'close', 'x', 20, C.slate500, 2],
  ['batch-import-dialog', 'download-template', 'file-spreadsheet', 16, C.emerald600Icon, 2],
  ['batch-import-dialog', 'upload-zone', 'upload', 32, C.slate400, 2],
  ['batch-import-dialog', 'alert', 'alert-circle', 16, C.amber600, 2],
  ['batch-import-dialog', 'success', 'check-circle-2', 20, C.emerald600, 2],
  // —— 导出品类 export-lots-dialog ——
  ['export-lots-dialog', 'close', 'x', 20, C.slate500, 2],
  ['export-lots-dialog', 'format-excel', 'file-spreadsheet', 16, C.emerald600Icon, 2],
  ['export-lots-dialog', 'download', 'download', 16, C.blue600, 2],
];

const ALIASES = {
  'alert-circle': 'circle-alert',
  'check-circle-2': 'circle-check',
};

function loadIconNode(kebab) {
  const resolved = ALIASES[kebab] ?? kebab;
  const modPath = path.join(ROOT, 'node_modules/lucide-react/dist/esm/icons', `${resolved}.js`);
  let code = fs.readFileSync(modPath, 'utf8');
  let m = code.match(/const __iconNode = (\[[\s\S]*?\]);/);
  if (!m) {
    const reExport = code.match(/from '\.\/(.+?)\.js'/);
    if (reExport) {
      const altPath = path.join(
        ROOT,
        'node_modules/lucide-react/dist/esm/icons',
        `${reExport[1]}.js`,
      );
      code = fs.readFileSync(altPath, 'utf8');
      m = code.match(/const __iconNode = (\[[\s\S]*?\]);/);
    }
  }
  if (!m) throw new Error(`icon node not found: ${kebab}`);
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

function nodeToMarkup([tag, attrs]) {
  const parts = Object.entries(attrs)
    .filter(([k]) => k !== 'key')
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
    .join(' ');
  if (tag === 'circle') return `<circle ${parts}/>`;
  if (tag === 'line') return `<line ${parts}/>`;
  if (tag === 'polyline') return `<polyline ${parts}/>`;
  if (tag === 'rect') return `<rect ${parts}/>`;
  return `<path ${parts}/>`;
}

function buildSvg(iconNode, { size, color, strokeWidth }) {
  const inner = iconNode.map(nodeToMarkup).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
${inner}
</svg>`;
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const manifest = [];

  for (const [module, prefix, kebab, size, color, strokeWidth] of ICONS) {
    const dir = path.join(OUT, module);
    fs.mkdirSync(dir, { recursive: true });
    const iconNode = loadIconNode(kebab);
    const svg = buildSvg(iconNode, { size, color, strokeWidth });
    const base = `${prefix}-${size}px`;
    const svgPath = path.join(dir, `${base}.svg`);
    const pngPath = path.join(dir, `${base}@2x.png`);
    fs.writeFileSync(svgPath, svg);
    await sharp(Buffer.from(svg))
      .resize(size * 2, size * 2)
      .png()
      .toFile(pngPath);
    manifest.push({
      module,
      file: `${module}/${base}.svg`,
      png2x: `${module}/${base}@2x.png`,
      lucide: kebab,
      sizePx: size,
      color,
      strokeWidth,
    });
    console.log('ok', `${module}/${base}`);
  }

  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ page: '招采分类', generatedAt: new Date().toISOString(), icons: manifest }, null, 2),
  );

  const readme = `# 招采分类页 — 图标资源包

按**模块目录** + **用途命名** + **设计稿逻辑尺寸（px）** 导出，供前端直接引用。

## 目录结构

| 模块文件夹 | 对应组件 |
|-----------|---------|
| \`category-page/\` | 顶部 6 级统计卡、工具栏（批量上传/导出/操作日志） |
| \`category-filter-bar/\` | 筛选栏搜索、高级筛选、重置 |
| \`classification-nav-panel/\` | 左侧目录树（层级图标、展开、增删改） |
| \`category-directory-workspace/\` | 右侧详情（面包屑、基本信息、树形说明、空状态） |
| \`directory-node-form-dialog/\` | 新增/编辑目录弹窗 |
| \`batch-import-dialog/\` | 批量上传弹窗 |
| \`export-lots-dialog/\` | 导出品类弹窗 |

## 文件命名

\`{用途}-{逻辑尺寸}px.svg\` / \`{用途}-{逻辑尺寸}px@2x.png\`

示例：\`classification-nav-panel/level-1-sector-14px.svg\`

## 尺寸对照（与代码 Tailwind 一致）

| 逻辑尺寸 | Tailwind | 典型场景 |
|---------|----------|---------|
| 12px | w-3 h-3 | 面包屑分隔 |
| 14px | w-3.5 h-3.5 | 目录树、筛选、工具栏按钮内图标 |
| 16px | w-4 h-4 | 统计卡、详情区块标题、弹窗关闭（小） |
| 20px | w-5 h-5 | 弹窗关闭、空状态、导入成功 |
| 32px | w-8 h-8 | 批量上传拖拽区 |

## 使用说明

- **SVG**：矢量，\`width/height\` 已设为逻辑尺寸，可直接 \`<img>\` 或内联。
- **@2x PNG**：视网膜屏备用（实际像素 = 逻辑尺寸 × 2）。
- 颜色与 \`stroke-width\` 已按当前页面实现烘焙进 SVG；若需主题切换请改 stroke 或改用 SVG Symbol + CSS。
- 图标来源：Lucide（与 \`lucide-react\` 一致）。

## 清单

详见 \`manifest.json\`（${manifest.length} 个图标）。
`;
  fs.writeFileSync(path.join(OUT, 'README.md'), readme);
  console.log(`\nDone → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
