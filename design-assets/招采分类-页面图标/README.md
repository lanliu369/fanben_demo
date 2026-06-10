# 招采分类页 — 图标资源包

按**模块目录** + **用途命名** + **设计稿逻辑尺寸（px）** 导出，供前端直接引用。

## 目录结构

| 模块文件夹 | 对应组件 |
|-----------|---------|
| `category-page/` | 顶部 6 级统计卡、工具栏（批量上传/导出/操作日志） |
| `category-filter-bar/` | 筛选栏搜索、高级筛选、重置 |
| `classification-nav-panel/` | 左侧目录树（层级图标、展开、增删改） |
| `category-directory-workspace/` | 右侧详情（面包屑、基本信息、树形说明、空状态） |
| `directory-node-form-dialog/` | 新增/编辑目录弹窗 |
| `batch-import-dialog/` | 批量上传弹窗 |
| `export-lots-dialog/` | 导出品类弹窗 |

## 文件命名

`{用途}-{逻辑尺寸}px.svg` / `{用途}-{逻辑尺寸}px@2x.png`

示例：`classification-nav-panel/level-1-sector-14px.svg`

## 尺寸对照（与代码 Tailwind 一致）

| 逻辑尺寸 | Tailwind | 典型场景 |
|---------|----------|---------|
| 12px | w-3 h-3 | 面包屑分隔 |
| 14px | w-3.5 h-3.5 | 目录树、筛选、工具栏按钮内图标 |
| 16px | w-4 h-4 | 统计卡、详情区块标题、弹窗关闭（小） |
| 20px | w-5 h-5 | 弹窗关闭、空状态、导入成功 |
| 32px | w-8 h-8 | 批量上传拖拽区 |

## 使用说明

- **SVG**：矢量，`width/height` 已设为逻辑尺寸，可直接 `<img>` 或内联。
- **@2x PNG**：视网膜屏备用（实际像素 = 逻辑尺寸 × 2）。
- 颜色与 `stroke-width` 已按当前页面实现烘焙进 SVG；若需主题切换请改 stroke 或改用 SVG Symbol + CSS。
- 图标来源：Lucide（与 `lucide-react` 一致）。

## 清单

详见 `manifest.json`（39 个图标）。
