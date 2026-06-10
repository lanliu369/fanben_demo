# 招标文件范本编制工具平台 — 功能文档

> 本文档基于项目实际代码生成，覆盖所有页面级功能、交互细节与技术实现要点。
> 生成日期：2026-05-13

---

## 目录

- [第一层：全局概述](#第一层全局概述)
- [第二层：模块功能文档](#第二层模块功能文档)
  - [2.1 数据看板](#21-数据看板)
  - [2.2 品类管理](#22-品类管理)
  - [2.3 资源管理（文本 / 资格条件 / 评标办法 / 合同条款）](#23-资源管理)
  - [2.4 范本变量管理](#24-范本变量管理)
  - [2.5 范本管理](#25-范本管理)
  - [2.6 招标文件管理](#26-招标文件管理)
- [第三层：跨模块关联](#第三层跨模块关联)
- [第四层：类型字典与接口清单](#第四层类型字典与接口清单)

---

## 第一层：全局概述

### 1.1 产品定位

**一句话定义**：政企采购领域的招标文件范本与招标文件编制系统前端应用。

**核心用户**：招标代理机构、政府采购部门、企业采购部。

**业务目标**：
1. 建立标准化的采购品类体系
2. 沉淀可复用的文本资源（资格要求、评标办法、合同条款）
3. 基于资源和框架快速生成招标文件范本
4. 基于范本填充变量，生成最终招标文件

### 1.2 技术架构

| 层级 | 技术选型 |
|------|---------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS v4 |
| 图标 | Lucide React |
| UI 风格 | 飞书 SaaS 风格（blue-600 主题色） |
| 数据层 | Mock 数据持久化到 `localStorage` |
| 富文本编辑 | Tiptap / Plate（SSR 禁用，客户端动态加载） |
| 文档编辑 | WPS WebOffice SDK + OnlyOffice Document Server |
| 审计日志 | 操作记录写入 `localStorage` |

### 1.3 全局导航结构

左侧导航栏共 **9 个 Tab**，分为三组：

```
顶部主功能
├── 数据看板
├── 品类管理
├── 范本管理

资源库（可折叠分组）
├── 文本管理
├── 资格条件管理
├── 评标办法管理
├── 合同条款管理
└── 范本变量管理

底部
└── 招标文件管理
```

**交互**：点击 Tab 切换页面内容，资源库分组可展开/折叠。当前选中 Tab 高亮显示（`bg-blue-50 text-blue-600`）。

### 1.4 通用交互模式

#### 弹窗表单通用模式

系统中绝大多数创建/编辑操作遵循统一的弹窗交互范式：

```
触发按钮 → 打开弹窗 → 表单填写 → 前端校验 → 提交 → 更新状态 → 关闭弹窗 → 列表刷新 → 写入审计日志
```

**校验规则统一处理**：
- 必填项未填时，提交按钮 `disabled` + `opacity-50`
- 级联选择：上级未选时，下级下拉框 `disabled`

#### 删除策略

所有删除操作均为 **逻辑删除**，通过设置 `deletedAt` 时间戳标记，数据保留在 `localStorage` 中，列表过滤时排除已删除项。

#### 数据持久化模式

```
useState 管理内存状态
    ↓
更新时同步调用 setMockXxx(next) → 写入 localStorage
    ↓
appendDataAudit({...}) → 写入审计日志 localStorage
```

#### 级联选择通用模式

涉及「产业领域 → 采购分类 → 品类」三级级联的页面：
- 选择产业领域 → 清空采购分类和品类
- 选择采购分类 → 清空品类
- 下级未选上级时，`disabled` + `opacity-50`

---

## 第二层：模块功能文档

---

### 2.1 数据看板

#### 2.1.1 功能概述

系统首页，提供核心业务数据的实时统计、待办事项提醒和快速操作入口。

#### 2.1.2 页面布局

```
┌─────────────────────────────────────────┐
│  统计卡片行（3列：品类 / 范本 / 招标文件）   │
├─────────────────────────────────────────┤
│  待办事项列表（2项固定类型）                │
├─────────────────────────────────────────┤
│  快速操作（3个入口按钮）                    │
└─────────────────────────────────────────┘
```

#### 2.1.3 核心数据模型

依赖类型：`Industry[]`、`Template[]`、`BidDocument[]`、`TextFragment[]`

#### 2.1.4 功能清单

##### 4.1 统计卡片

| 卡片 | 数据来源 | 附属信息 |
|------|---------|---------|
| 品类总数 | `industries` 下所有 `categories` 累加 | 覆盖 N 个产业领域 |
| 范本总数 | `templates.length` | 已发布 N / 草稿 N |
| 招标文件 | `bidDocuments.length` | 已定稿 N / 草稿 N |

**交互**：卡片hover时有轻微阴影提升（`hover:shadow-md`）。

**技术实现**：
- SSR 水合兼容：使用 `storageReady` 状态 + `startTransition`
- 首屏使用 `getMockIndustriesSsrSnapshot()` 避免水合不匹配
- 客户端就绪后切换为 `localStorage` 真实数据

##### 4.2 待办事项

固定展示 2 类待办：

**待办 1：待完成范本编制**
- 检测条件：`status === 'draft' && editProgress < 100`
- 展示：待完成数量，或「当前没有未完成编制的范本」
- 类型标记：`warning`（有未完成）/ `info`（无）

**待办 2：文本更新影响**
- 检测逻辑：遍历所有范本，检查其引用的 `textFragmentId` 的 `updatedAt` 是否晚于范本自身的 `updatedAt`
- 展示：受影响的范本数量
- 类型标记：`warning`（有影响）/ `info`（无）

##### 4.3 快速操作

三个按钮（纯展示，点击无实际跳转）：
1. 新建品类 → 图标 FolderTree
2. 维护资源 → 图标 FileText
3. 编制范本 → 图标 FileEdit

---

### 2.2 品类管理

#### 2.2.1 功能概述

管理采购品类的三级层级结构：产业领域 → 采购分类 → 品类。所有下游模块（框架、资源、范本）均依赖此处的品类数据。

#### 2.2.2 页面布局

```
┌─────────────────────────────────────────┐
│  页面标题 + 操作按钮（操作日志 / 同步信息）  │
├─────────────────────────────────────────┤
│  统计卡片（产业领域 / 采购分类 / 品类）      │
├─────────────────────────────────────────┤
│  搜索框                                  │
├─────────────────────────────────────────┤
│  树形列表（三级折叠展开）                   │
└─────────────────────────────────────────┘
```

#### 2.2.3 核心数据模型

```typescript
interface Industry {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  procurementCategories: ProcurementCategory[];
}

interface ProcurementCategory {
  id: string;
  name: string;
  description?: string;
  industryId: string;
  categories: Category[];
}

interface Category {
  id: string;
  name: string;
  description?: string;
  procurementCategoryId: string;
  hasFramework?: boolean;
}
```

#### 2.2.4 功能清单

##### 4.1 树形浏览

**交互**：
- 点击产业领域行的 ChevronRight 图标 → 展开/折叠该领域下的采购分类
- 点击采购分类行的 ChevronRight 图标 → 展开/折叠该分类下的品类
- 默认展开第一个产业领域（`ind-1`）和第一个采购分类（`pc-1`）
- 展开时图标旋转 90°（`rotate-90`）
- 产业领域：蓝色文件夹图标
- 采购分类：紫色文件夹图标
- 品类：绿色圆点

##### 4.2 搜索过滤

**入口**：顶部搜索框，placeholder「搜索品类名称...」

**交互**：
- 输入关键词实时过滤
- 搜索范围：产业领域名称、采购分类名称、品类名称
- 过滤后展示匹配的产业领域树

##### 4.3 同步信息

**入口**：右上角「同步信息」按钮（蓝色主按钮）

**交互流程**：
1. 点击按钮 → 按钮进入 loading 状态（图标旋转动画）
2. 调用 `POST /api/categories/sync`
3. 成功：更新 `industries` 状态，顶部显示同步结果消息
4. 失败：显示错误消息
5. 写入审计日志（`scope: 'category'`, `action: 'sync'`）

##### 4.4 操作日志

**入口**：右上角「操作日志」按钮

**交互**：点击打开 `OperationLogDialog` 弹窗，展示品类同步历史记录。

---

### 2.3 资源管理

> 四个模块共用同一套组件和交互模式：`TextPage` 组件通过 `moduleKey` 参数区分：
> - `text` → 文本管理
> - `qualification` → 资格条件管理
> - `evaluation` → 评标办法管理
> - `contract-clause` → 合同条款管理

#### 2.3.1 功能概述

管理可复用的文本片段资源。资源通过富文本编辑器维护内容，可绑定到范本章节，支持版本历史、品类适用范围控制，以及资源间的互相引用（仅文本管理模块）。

#### 2.3.2 页面布局

```
┌────────────────────┬─────────────────────────────────────┐
│  搜索框 + 新建按钮  │  资源名称 + 操作按钮（编辑/删除/日志） │
├────────────────────┤  ┌─────────────────────────────────┐  │
│  资源列表          │  │  富文本编辑器（Plate/Tiptap）    │  │
│  （名称+描述+时间） │  └─────────────────────────────────┘  │
│                    │  描述文本框                            │
│                    │  适用品类范围选择器                      │
│                    │  绑定关系 / 同步状态 / 使用统计          │
└────────────────────┴─────────────────────────────────────┘
```

#### 2.3.3 核心数据模型

```typescript
interface TextFragment {
  id: string;
  name: string;
  module?: 'text' | 'qualification' | 'evaluation' | 'contract-clause';
  content: string;              // HTML 富文本内容
  description?: string;
  createdAt: string;
  updatedAt: string;
  bindings?: TextBinding[];     // 绑定到范本章节
  versions: TextVersion[];      // 版本历史
  contentVersion?: number;      // 当前正文版本号，每次保存递增
  templateSyncedVersion?: Record<string, number>; // 各范本最近一次同步时的版本号
  applicableToAllCategories?: boolean; // true=全品类可用
  applicableCategoryIds?: string[];    // 非全品类时指定的品类ID列表
  deletedAt?: string;
}

interface TextBinding {
  id: string;
  textFragmentId: string;
  templateId?: string;
  templateSectionId?: string;
  templateName?: string;
  sectionTitle?: string;
  order: number;
}

interface TextVersion {
  content: string;
  updatedAt: string;
}
```

#### 2.3.4 功能清单

##### 4.1 资源列表浏览

**交互**：
- 左侧展示当前模块的资源列表
- 点击列表项 → 右侧展示详情
- 列表按创建时间倒序排列
- 搜索框实时过滤（匹配名称和描述）
- 选中项高亮显示

##### 4.2 新建资源

**入口**：左上角「新建[模块名]」按钮

**交互流程**：
1. 点击按钮 → 打开新建弹窗
2. 弹窗字段：
   - 名称（必填）
   - 富文本内容（Plate/Tiptap 编辑器，SSR 禁用）
   - 描述（多行文本）
   - 适用品类范围：「全品类」开关 + 品类多选树（`CategoryScopePicker`）
3. 前端校验：名称非空、品类范围非空（全品类或至少选一个品类）
4. 提交 → `contentVersion = 1` → 写入 localStorage → 关闭弹窗 → 列表刷新

**技术实现**：
- 富文本编辑器通过 `dynamic(() => import('@/components/RichTextEditor'), { ssr: false })` 动态加载
- 品类选择器通过 `categoryPickerEpoch` 强制重新挂载，避免 React 复用导致展开态残留

##### 4.3 编辑资源

**入口**：资源详情区「编辑」按钮

**交互流程**：
1. 点击编辑 → 弹窗回填当前数据
2. 修改内容 → 保存时 `contentVersion++`
3. 更新 `updatedAt`
4. 写入 localStorage

##### 4.4 版本历史

**展示位置**：资源详情区

**内容**：展示该资源的所有历史版本（`versions` 数组），每项显示更新时间和内容预览。

##### 4.5 适用品类范围

**控制逻辑**：
- `applicableToAllCategories = true`：所有品类下的范本均可引用、侧栏展示
- `applicableToAllCategories = false`：仅在 `applicableCategoryIds` 所选品类下的范本侧栏展示

**用途**：控制资源在范本编辑器侧边栏的可见性，避免不相关资源干扰。

##### 4.6 绑定到范本章节

**概念**：资源可绑定到一个或多个范本的特定章节。绑定后，该章节的内容以资源正文为准。

**展示**：资源详情区展示绑定列表，包括范本名称和章节标题。

##### 4.7 同步到所有范本

**入口**：资源详情区「同步到所有范本」按钮

**作用**：将当前资源的最新正文内容，推送到所有绑定了该资源的范本章节中。

**技术实现**：`syncTextFragmentToAllTemplates(fragmentId)`

##### 4.8 资源插入（仅文本管理模块）

**入口**：编辑器工具栏「插入资源」按钮

**交互**：
1. 打开弹窗，展示可插入的其他资源列表（排除自身和文本类型资源）
2. 支持按模块过滤（资格条件 / 评标办法 / 合同条款）
3. 支持搜索
4. 勾选资源 → 插入到当前编辑器内容中（以占位标签形式嵌入）

##### 4.9 删除资源

**交互**：点击删除按钮 → `SystemDialog` 确认弹窗 → 调用 `softDeleteTextFragment` → 逻辑删除标记

##### 4.10 操作日志

**入口**：每行资源列表的日志图标

**展示**：`OperationLogDialog` 弹窗，展示该资源的创建、更新、删除、同步历史。

---

### 2.4 范本变量管理

#### 2.4.1 功能概述

管理全范本通用的变量占位符，如 `{{招标人}}`、`{{项目名称}}`。这些变量在范本编辑和招标文件生成时被使用。

#### 2.4.2 页面布局

```
┌─────────────────────────────────────────┐
│  页面标题 + 新建变量按钮                   │
├─────────────────────────────────────────┤
│  变量列表表格（名称 / Key / 默认值 / 操作） │
├─────────────────────────────────────────┤
│  分页控件                                │
└─────────────────────────────────────────┘
```

#### 2.4.3 核心数据模型

```typescript
interface TemplateVariable {
  id: string;
  name: string;
  key: string;           // 如 "{{招标人}}"
  description?: string;
  defaultValue?: string;
  scope?: 'global' | 'template';  // global=系统预置，template=仅当前范本
}
```

#### 2.4.4 功能清单

##### 4.1 变量列表

- 按名称拼音排序（`zh-CN` locale）
- 分页展示，默认每页 10 条
- 展示字段：名称、Key（代码块样式）、默认值

##### 4.2 新建变量

**弹窗字段**：
- 变量名称（必填）
- 变量 Key（必填，自动规范化：若用户输入 `招标人`，自动转为 `{{招标人}}`）
- 默认值（可选）

**校验**：Key 去重（全局范围内不可重复）

##### 4.3 编辑变量

- 回填当前数据
- Key 编辑时去除 `{{` `}}` 外壳展示，保存时自动包裹

##### 4.4 删除变量

- `SystemDialog` 确认后删除
- 数据持久化到 `localStorage`

---

### 2.5 范本管理

#### 2.5.1 功能概述

系统的核心模块。管理招标文件范本的完整生命周期：创建 → 编辑正文 → 维护变量 → 发布 → 生成招标文件。

#### 2.5.2 页面布局

**列表页**：

```
┌─────────────────────────────────────────┐
│  页面标题 + 操作按钮（新建 / 导入 / AI搜索） │
├─────────────────────────────────────────┤
│  筛选栏：品类级联 + 状态 + 日期范围 + 搜索   │
├─────────────────────────────────────────┤
│  范本表格（名称 / 品类 / 版本 / 进度 / 状态 / 更新 / 操作）│
├─────────────────────────────────────────┤
│  分页控件                                │
└─────────────────────────────────────────┘
```

**编辑器页**（点击编辑后全屏进入）：

```
┌─────────────────────────────────────────────────────┐
│ ← 返回  范本名称  版本号输入框          [保存并返回] │
├─────────────────────────────────────┬───────────────┤
│                                     │  系统功能区    │
│   WPS WebOffice 编辑器               │  ───────────  │
│   （全屏嵌入）                       │  变量管理      │
│                                     │  资源插入      │
│                                     │  章节结构      │
│                                     │  ...          │
└─────────────────────────────────────┴───────────────┘
```

#### 2.5.3 核心数据模型

```typescript
interface Template {
  id: string;
  name: string;
  description?: string;
  frameworkId: string;
  categoryId: string;
  categoryName?: string;
  industryId?: string;
  industryName?: string;
  procurementCategoryId?: string;
  procurementCategoryName?: string;
  version?: string;
  editProgress?: number;       // 编辑完成度 0-100
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  sections: TemplateSection[]; // 章节结构 + 内容
  variables: TemplateVariable[];
  deletedAt?: string;
}

interface TemplateSection {
  id: string;
  templateId: string;
  chapterId: string;
  title: string;
  order: number;
  level: number;
  parentId?: string;
  content: string;
  textFragmentId?: string;  // 绑定的资源ID
  children?: TemplateSection[];
}
```

#### 2.5.4 功能清单

##### 4.1 范本列表筛选

**筛选条件**：

| 筛选器 | 类型 | 说明 |
|--------|------|------|
| 品类 | 三级级联下拉 | 产业领域 → 采购分类 → 品类 |
| 状态 | 单选 | 全部 / 草稿 / 已发布 |
| 日期范围 | 日期选择器 | 开始日期 ~ 结束日期，过滤 `updatedAt` |
| 搜索 | 文本输入 | 匹配范本名称、描述、品类名称 |

**交互**：
- 任何筛选条件变化 → 自动重置到第 1 页
- 筛选结果按创建时间倒序排列

##### 4.2 新建范本

**入口**：「新建范本」按钮

**交互流程**：
1. 点击按钮 → 打开弹窗
2. 填写表单：
   - 产业领域 / 采购分类 / 品类（三级级联，品类必填）
   - 范本名称（必填）
   - 版本号（可选，placeholder「如 V1.0」）
   - 范本描述（可选）
3. 提交校验：品类已选、名称非空
4. 生成范本：
   - 调用 `makeTpl()` 创建初始对象
   - `frameworkId` 固定为 `FW_MANUAL`
   - `status = 'draft'`
   - `editProgress = 0`
   - `sections` 为空数组（进入编辑器后手动搭建）
5. 写入 `templates` → `localStorage` → 审计日志
6. 自动进入编辑器

##### 4.3 复制范本

**入口**：列表行「一键复制」按钮

**交互流程**：
1. 点击按钮 → 打开复制弹窗
2. 弹窗预填：产业领域/采购分类/品类继承自原范本，名称自动追加「（副本）」
3. 用户可修改目标品类、名称、描述、版本号
4. 提交 → 调用 `duplicateMockTemplate(sourceId, options)`
   - 深拷贝原范本的所有章节结构和内容
   - 深拷贝自定义变量（过滤掉 `scope: 'global'` 的变量）
   - 生成新的 ID 映射
   - `status = 'draft'`
5. 新副本出现在列表中

##### 4.4 导入范本

**入口**：「导入文档」按钮

**交互流程（三步向导）**：

**Step 1 — 上传文件**
- 支持格式：`.doc`、`.docx`、`.pdf`
- 支持拖拽上传和点击选择
- 显示文件大小和格式
- 点击「预览文档」→ 后端解析并展示 HTML 预览

**Step 2 — 填写元信息**
- 产业领域 / 采购分类 / 品类（级联）
- 范本名称、描述、版本号

**Step 3 — 确认导入**
- 解析文档内容为 HTML
- 从 HTML 中提取章节结构（`parseSectionsFromHTML`）
- 创建新范本，`id` 前缀为 `import-`
- 保存后自动进入编辑器

**技术实现**：
- DOCX 解析：`mammoth` 库
- 增强解析：`parseDocxEnhanced` 处理复杂格式
- PDF 解析：`pdfjs-dist`

##### 4.5 编辑范本信息

**入口**：列表行「编辑范本信息」齿轮图标

**交互流程**：
1. 点击按钮 → 打开弹窗，回填当前范本的所有元信息
2. 可修改字段：产业领域、采购分类、品类、名称、版本号、描述
3. 品类切换时自动更新 `categoryName`、`industryName`、`procurementCategoryName`
4. 保存 → 更新 `templates` 数组 → `localStorage` → 审计日志

##### 4.6 编辑范本正文（WPS 编辑器）

**入口**：列表行「编辑」按钮

**页面切换**：列表页 → 全屏编辑器（`WpsTemplateEditor`）

**顶部栏**：
- 返回按钮 → 返回列表页（不保存）
- 范本名称（只读展示）
- 版本号输入框（可编辑）
- 「保存并返回」按钮

**编辑器区域**：
- 嵌入 WPS WebOffice 在线编辑器
- 加载状态：`booting` 时显示「正在加载金山 WebOffice…」
- 错误提示：若未配置 `WPS_WEBOFFICE_APP_ID`，展示配置指引

**保存逻辑**：
1. 从编辑器中提取内容 → 解析章节结构（`parseSectionsFromHTML`）
2. 合并章节内容（引用资源的章节以资源正文为准）
3. 计算编辑完成度（`calcTemplateEditProgress`）
4. 更新 `templates` → `localStorage`
5. 返回列表页

**编辑完成度算法**：
- 遍历所有叶子章节
- 有内容的章节计为完成
- 进度 = 完成章节数 / 总叶子章节数 × 100%

##### 4.7 范本变量管理（编辑器内）

**位置**：编辑器右侧「系统功能区」→ 变量管理

**功能**：
- 展示系统预置全局变量 + 当前范本的自定义变量
- 新建范本级变量（`scope: 'template'`）
- 编辑/删除变量
- 变量在正文中以 `{{key}}` 形式占位

##### 4.8 资源插入（编辑器内）

**位置**：编辑器右侧「系统功能区」→ 资源插入

**功能**：
- 展示当前范本品类下适用的所有资源（文本、资格、评标、合同）
- 搜索过滤
- 点击资源 → 插入到当前光标位置（以占位标签形式）

##### 4.9 发布范本

**入口**：列表行「发布」按钮（仅草稿状态显示）

**交互**：点击 → `SystemDialog` 确认 → `status` 变为 `'published'` → 审计日志

**规则**：已发布的范本才能在「招标文件管理」中被选择。

##### 4.10 删除范本

**交互**：点击删除图标 → `SystemDialog` 确认 → `softDeleteTemplate(id)` → 逻辑删除

##### 4.11 下载范本

**交互**：点击下载图标

**技术实现**：
1. 优先尝试从服务端获取 DOCX（`/api/documents/${id}`）
2. 若服务端文件存在且 > 3000 bytes，直接下载
3. 否则回退：将范本 HTML 内容通过 `html-docx-js-typescript` 转换为 DOCX Blob → 触发下载

##### 4.12 预览范本

**交互**：点击预览图标 → 新窗口/弹窗展示渲染后的 HTML 内容

##### 4.13 操作日志

**入口**：列表行「操作日志」按钮

**展示**：`OperationLogDialog` 弹窗，展示该范本的所有操作历史。

---

### 2.6 招标文件管理

#### 2.6.1 功能概述

基于已发布的范本生成实际招标文件，填写变量信息，完成定稿。

#### 2.6.2 页面布局

```
┌────────────────────┬─────────────────────────────────────┐
│  搜索框            │  招标文件详情卡片                      │
├────────────────────┤  ┌─────────────────────────────────┐  │
│  招标文件列表       │  │  文件头部（名称 / 状态 / 操作）  │  │
│  （名称+进度+状态） │  ├─────────────────────────────────┤  │
│                    │  │  变量信息列表                      │  │
│                    │  │  （变量名 / Key / 值 / 完成状态）  │  │
│                    │  ├─────────────────────────────────┤  │
│                    │  │  [确认定稿] 按钮（仅草稿+100%）   │  │
│                    │  └─────────────────────────────────┘  │
└────────────────────┴─────────────────────────────────────┘
```

#### 2.6.3 核心数据模型

```typescript
interface BidDocument {
  id: string;
  name: string;
  templateId: string;
  templateName?: string;
  projectName: string;
  status: 'draft' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  variableValues: VariableValue[];
  sections: BidDocumentSection[];
  deletedAt?: string;
}

interface VariableValue {
  variableId: string;
  key: string;
  name: string;
  value: string;
}
```

#### 2.6.4 功能清单

##### 4.1 招标文件列表

- 左侧列表，点击选中后在右侧展示详情
- 选中项高亮：`bg-blue-50 border-l-4 border-l-blue-600`
- 未选中时右侧展示空状态引导
- 搜索：按名称和项目名称过滤

##### 4.2 新建招标文件

**入口**：「新建招标文件」按钮

**弹窗字段**：
- 选择范本（下拉，仅展示 `status === 'published'` 的范本，必填）
- 招标文件名称（必填）
- 项目名称（必填）

**创建后状态**：`status = 'draft'`，`variableValues = []`

##### 4.3 填写变量信息

**入口**：详情页「编辑变量」按钮 / 「立即填写」按钮

**弹窗**：
- 动态渲染所选范本的所有有效变量（`getEffectiveTemplateVariables`）
- 每个变量展示：名称 + Key（代码块样式）+ 输入框
- 输入框 placeholder：优先显示 `defaultValue`，否则显示「请输入XX」

**保存**：将所有变量值收集为 `VariableValue[]` → 更新招标文件 → 计算完成度

##### 4.4 变量完成度

**计算**：`filledCount / totalVariables × 100%`

**展示**：
- 列表项中展示进度条（草稿状态）
- 详情页变量列表中，已填写的变量右侧显示绿色 Check 图标

##### 4.5 确认定稿

**触发条件**：`status === 'draft' && completionRate === 100%`

**入口**：详情页底部「确认定稿」按钮（绿色主按钮）

**效果**：`status` 变为 `'completed'` → 审计日志

##### 4.6 删除招标文件

**交互**：详情页删除图标 → `SystemDialog` 确认 → `softDeleteBidDocument` → 逻辑删除

##### 4.7 下载招标文件

**入口**：详情页下载图标

**当前状态**：UI 占位，点击无实际下载逻辑（预留功能）。

---

## 第三层：跨模块关联

### 3.1 数据血缘关系

```
品类管理（Industry / Category）
    ↓ 为以下模块提供品类数据
    ├── 资源管理：applicableCategoryIds 控制资源可见范围
    ├── 范本管理：categoryId 绑定范本所属品类
    └── 框架管理：framework.categoryId 绑定品类（当前代码中框架数据内嵌在 mockData）

资源管理（TextFragment）
    ↓ 绑定到范本章节
    ├── TextBinding.templateId → Template
    ├── TextBinding.templateSectionId → TemplateSection
    └── contentVersion + templateSyncedVersion 控制同步状态

范本管理（Template）
    ↓ 生成招标文件
    ├── 已发布范本 → BidDocument.templateId
    ├── Template.variables → BidDocument.variableValues（填充）
    └── Template.sections → BidDocument.sections（深拷贝）

范本变量（TemplateVariable，scope='global'）
    ↓ 全系统共享
    ├── 范本编辑器中可用
    └── 招标文件变量表单中动态渲染
```

### 3.2 核心业务流程

#### 流程 1：从资源到范本

```
1. 在「品类管理」中确认品类体系
2. 在「资源管理」中创建文本/资格/评标/合同资源
   └── 设置适用品类范围
3. 在「范本管理」中新建范本
4. 进入编辑器，通过「资源插入」将资源插入正文
   └── 或手动编辑章节结构
5. 保存范本，章节结构解析并持久化
```

#### 流程 2：从范本到招标文件

```
1. 在「范本管理」中将范本「发布」（status='published'）
2. 在「招标文件管理」中「新建招标文件」
3. 选择已发布范本 → 填写项目名称
4. 进入变量填写弹窗，填写所有变量值
5. 完成度达到 100% →「确认定稿」
6. 生成正式招标文件（可下载 DOCX）
```

#### 流程 3：资源更新同步

```
1. 在「资源管理」中编辑某资源正文
   └── contentVersion 自动递增
2. 资源详情页显示「同步到所有范本」按钮
3. 点击同步 → 遍历所有绑定该资源的范本章节
4. 将最新正文写入章节 content
5. 更新 templateSyncedVersion[templateId] = 当前 contentVersion
```

### 3.3 全局状态流转

#### 范本状态机

```
        ┌─────────┐
        │  新建   │
        └────┬────┘
             ↓
        ┌─────────┐     发布      ┌─────────┐
        │  草稿   │ ───────────→ │ 已发布  │
        │ draft   │              │published│
        └────┬────┘              └────┬────┘
             │                        │
             │ 删除（逻辑）             │ 删除（逻辑）
             ↓                        ↓
        ┌─────────┐              ┌─────────┐
        │ 已删除  │              │ 已删除  │
        │(deleted)│              │(deleted)│
        └─────────┘              └─────────┘
```

#### 招标文件状态机

```
        ┌─────────┐
        │  新建   │
        └────┬────┘
             ↓
        ┌─────────┐    定稿(100%)   ┌─────────┐
        │  草稿   │ ─────────────→ │ 已定稿  │
        │ draft   │                │completed│
        └────┬────┘                └────┬────┘
             │                          │
             │ 删除                      │ 归档
             ↓                          ↓
        ┌─────────┐                ┌─────────┐
        │ 已删除  │                │ 已归档  │
        └─────────┘                │archived │
                                   └─────────┘
```

### 3.4 编辑器集成架构

#### WPS WebOffice 集成

```
WpsTemplateEditor
    ├── 初始化
    │   └── 检查环境变量：NEXT_PUBLIC_WPS_WEBOFFICE_SDK_URL
    │   └── 检查 WPS_WEBOFFICE_APP_ID
    │   └── 动态加载 JSSDK UMD 脚本
    │   └── 调用 WebOfficeSDK.config() 初始化编辑器实例
    ├── 回调接口（app/v3/3rd/*）
    │   ├── /users          → 用户信息查询
    │   ├── /files/[id]     → 文件元信息
    │   ├── /files/[id]/permission → 权限配置
    │   ├── /files/[id]/download   → 下载地址
    │   ├── /files/[id]/upload/address → 上传地址
    │   └── /files/[id]/upload/complete → 保存完成回调
    └── 资源插入
        └── 通过 insert-queue 轮询 + executeMethod 插入内容
```

#### OnlyOffice 集成

- Docker 部署：`onlyoffice/documentserver:7.5.1`
- 本地端口映射：`8088:80`
- 配置文件系统缓存：`.onlyoffice/fontconfig`

---

## 第四层：类型字典与接口清单

### 4.1 核心类型速查

#### 品类体系

| 类型 | 关键字段 | 说明 |
|------|---------|------|
| `Industry` | `id`, `name`, `procurementCategories[]` | 产业领域 |
| `ProcurementCategory` | `id`, `name`, `industryId`, `categories[]` | 采购分类 |
| `Category` | `id`, `name`, `procurementCategoryId`, `hasFramework?` | 品类 |

#### 资源体系

| 类型 | 关键字段 | 说明 |
|------|---------|------|
| `TextFragment` | `id`, `name`, `module`, `content`, `bindings[]`, `versions[]`, `contentVersion`, `applicableToAllCategories`, `applicableCategoryIds` | 文本资源 |
| `TextBinding` | `textFragmentId`, `templateId`, `templateSectionId` | 资源-范本绑定 |
| `TextVersion` | `content`, `updatedAt` | 版本历史记录 |

#### 范本体系

| 类型 | 关键字段 | 说明 |
|------|---------|------|
| `Template` | `id`, `name`, `categoryId`, `frameworkId`, `version`, `status`, `sections[]`, `variables[]`, `editProgress` | 范本 |
| `TemplateSection` | `id`, `title`, `order`, `level`, `content`, `textFragmentId?`, `children[]` | 范本章节 |
| `TemplateVariable` | `id`, `name`, `key`, `defaultValue`, `scope` | 变量占位符 |
| `Framework` | `id`, `name`, `categoryId`, `status`, `chapters[]` | 框架大纲 |
| `Chapter` | `id`, `title`, `order`, `level`, `children[]`, `boundTexts?` | 框架章节 |

#### 招标文件体系

| 类型 | 关键字段 | 说明 |
|------|---------|------|
| `BidDocument` | `id`, `name`, `templateId`, `projectName`, `status`, `variableValues[]`, `sections[]` | 招标文件 |
| `VariableValue` | `variableId`, `key`, `name`, `value` | 变量填充值 |
| `BidDocumentSection` | `id`, `title`, `order`, `level`, `content`, `children[]` | 招标文件章节 |

### 4.2 Mock 数据操作函数

| 函数 | 路径 | 用途 |
|------|------|------|
| `getMockIndustries()` | `src/lib/mockData.ts` | 读取品类数据 |
| `setMockIndustries(data)` | `src/lib/mockData.ts` | 写入品类数据 |
| `getMockTemplates()` | `src/lib/mockData.ts` | 读取范本数据 |
| `setMockTemplates(data)` | `src/lib/mockData.ts` | 写入范本数据 |
| `getMockTextFragments()` | `src/lib/mockData.ts` | 读取资源数据 |
| `setMockTextFragments(data)` | `src/lib/mockData.ts` | 写入资源数据 |
| `getMockBidDocuments()` | `src/lib/mockData.ts` | 读取招标文件数据 |
| `setMockBidDocuments(data)` | `src/lib/mockData.ts` | 写入招标文件数据 |
| `getGlobalTemplateVariables()` | `src/lib/mockData.ts` | 读取全局变量 |
| `setGlobalTemplateVariables(data)` | `src/lib/mockData.ts` | 写入全局变量 |
| `softDeleteTemplate(id, actor)` | `src/lib/mockData.ts` | 逻辑删除范本 |
| `softDeleteTextFragment(id, actor)` | `src/lib/mockData.ts` | 逻辑删除资源 |
| `softDeleteBidDocument(id, actor)` | `src/lib/mockData.ts` | 逻辑删除招标文件 |
| `duplicateMockTemplate(sourceId, options)` | `src/lib/mockData.ts` | 复制范本 |
| `syncTextFragmentToAllTemplates(id)` | `src/lib/mockData.ts` | 同步资源到范本 |
| `getCategoryLabel(categoryId)` | `src/lib/mockData.ts` | 获取品类标签信息 |
| `resolveCategoryIds(categoryId)` | `src/lib/mockData.ts` | 解析品类对应的产业/采购分类ID |
| `getEffectiveTemplateVariables(tpl)` | `src/lib/mockData.ts` | 获取范本有效变量（全局+范本） |

### 4.3 API 路由清单

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/categories/sync` | `POST` | 从后端同步品类数据 |
| `/api/documents/[id]` | `GET` | 获取文档 DOCX Blob |
| `/api/documents/[id]` | `POST` | 保存文档 DOCX 内容（base64） |
| `/api/documents/[id]/export-html` | `POST` | 导出文档为 HTML |
| `/api/documents/[id]/heading` | `GET` | 获取文档大纲标题 |
| `/api/documents/[id]/insert-queue` | `GET` | 获取待插入内容队列 |
| `/api/documents/[id]/weboffice-init` | `POST` | WPS WebOffice 初始化配置 |
| `/api/wps-upload/[file_id]` | `POST` | WPS 文件上传处理 |
| `/api/wps-plugin/resource-insert` | `GET` | WPS 插件资源配置 |
| `/app/v3/3rd/users` | `GET/POST` | WPS 回调：用户信息 |
| `/app/v3/3rd/files/[id]` | `GET` | WPS 回调：文件信息 |
| `/app/v3/3rd/files/[id]/permission` | `GET` | WPS 回调：权限信息 |
| `/app/v3/3rd/files/[id]/download` | `GET` | WPS 回调：下载地址 |
| `/app/v3/3rd/files/[id]/upload/address` | `POST` | WPS 回调：上传地址 |
| `/app/v3/3rd/files/[id]/upload/complete` | `POST` | WPS 回调：上传完成 |
| `/app/v3/3rd/files/[id]/upload/prepare` | `GET` | WPS 回调：上传准备 |

### 4.4 审计日志类型

| 字段 | 类型 | 说明 |
|------|------|------|
| `scope` | `'template' \| 'text' \| 'bid' \| 'category'` | 操作对象类型 |
| `action` | `'create' \| 'update' \| 'delete' \| 'sync'` | 操作类型 |
| `entityId` | `string` | 对象 ID |
| `label` | `string` | 对象名称 |
| `detail` | `string` | 操作详情 |
| `actor` | `string` | 操作人 |
| `at` | `string` | 操作时间（ISO） |

---

## 附录：需求调整记录

> 本附录用于追踪产品功能的需求变更历史，便于版本回溯和团队沟通。

### 记录模板

| 字段 | 说明 | 示例 |
|------|------|------|
| 调整时间 | 需求变更提出的日期 | `2026-05-13` |
| 变动人 | 提出或执行变更的人员 | `产品经理-张三` |
| 需求来源 | 变更的触发原因 | `用户反馈 / 内部评审 / 法规更新` |
| 涉及模块 | 影响的功能页面 | `范本管理` |
| 需求描述 | 变更内容的详细说明 | `范本编辑时，版本号输入框不再显示自动建议的版本号提示` |
| 截图 / 附件 | 变更前后的界面截图或参考图 | `screenshots/v1.0.png` |
| 实现状态 | 当前进度 | `已完成 / 开发中 / 待排期` |
| 关联 PRD | 对应的需求文档章节 | `PRD_v2.0.md §3.2` |

### 变更记录

#### 记录 1：范本编辑去掉版本号建议提示

| 字段 | 内容 |
|------|------|
| 调整时间 | 2026-05-13 |
| 变动人 | 产品经理 |
| 需求来源 | 用户反馈 |
| 涉及模块 | 范本管理（TemplatePage） |
| 需求描述 | 新建/复制/导入范本弹窗中的版本号输入框，去除「当前建议：Vx.x」的提示文字。placeholder 统一改为简单的「如 V1.0」。留空时的自动填充逻辑保留。 |
| 截图 / 附件 | 无 |
| 实现状态 | **已完成** |
| 关联 PRD | PRD_v2.0.md — 范本管理模块 |

#### 记录 2：增加「编辑范本信息」功能

| 字段 | 内容 |
|------|------|
| 调整时间 | 2026-05-13 |
| 变动人 | 产品经理 |
| 需求来源 | 内部评审 |
| 涉及模块 | 范本管理（TemplatePage） |
| 需求描述 | 在范本列表每行增加「编辑范本信息」按钮（齿轮图标），点击弹出弹窗可修改：产业领域、采购分类、品类、范本名称、版本号、范本描述。支持级联选择和品类切换后自动更新派生字段。 |
| 截图 / 附件 | 无 |
| 实现状态 | **已完成** |
| 关联 PRD | PRD_v2.0.md — 范本管理模块 |

---

*文档结束*
