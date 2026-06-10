# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

招标文件范本编制工具平台 - 政企采购领域的招标文件范本和招标文件编制系统前端应用。

技术栈：Next.js 16 (App Router) + TypeScript + Tailwind CSS + Lucide React

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

## 核心架构

### 1. 业务流程（6步闭环）

系统实现了完整的招标文件编制业务流程：

1. **品类管理** → 建立三级层级体系（产业领域 → 采购分类 → 品类）
2. **框架管理** → 为品类设计章节结构（大纲）
3. **文本管理** → 创建可复用文本片段并绑定到框架章节
4. **范本管理** → 基于框架和绑定文本自动生成初始范本
5. **范本编辑** → 使用**金山 WPS WebOffice**在线编辑，预留变量占位符（如 `{{招标人}}`）；回调见 `/v3/3rd` 与 `weboffice-init`
6. **招标文件** → 基于范本生成文件，填充变量值

### 2. 数据模型层级关系

```
Industry (产业领域)
  └─ ProcurementCategory (采购分类)
      └─ Category (品类)
          └─ Framework (框架)
              ├─ Chapter (章节，支持多级嵌套)
              │   └─ TextBinding (文本绑定)
              │       └─ TextFragment (文本片段)
              └─ Template (范本)
                  ├─ TemplateSection (范本章节)
                  ├─ TemplateVariable (变量定义)
                  └─ BidDocument (招标文件)
                      └─ VariableValue (变量值)
```

### 3. 组件架构

**单页应用结构**：
- `src/app/page.tsx` - 应用入口，渲染 MainLayout
- `src/components/MainLayout.tsx` - 主布局，包含左侧导航和内容区切换逻辑
- `src/components/pages/` - 6个功能页面组件，通过 MainLayout 的 Tab 切换显示

**导航设计**：
- 左侧固定导航栏（256px 宽）
- 右侧内容区（顶部标题栏 + 可滚动内容）
- 使用 `useState` 管理当前激活的 Tab

**数据管理**：
- 当前所有数据为 Mock 数据，存储在各页面组件的 `useState` 中
- 每个页面组件独立管理自己的数据状态
- 无全局状态管理（未来可考虑 Zustand）

### 4. 类型系统

所有核心数据类型定义在 `src/types/index.ts`，按业务模块分组：
- 品类管理类型：Industry, ProcurementCategory, Category
- 框架管理类型：Framework, Chapter
- 文本管理类型：TextFragment, TextBinding
- 范本管理类型：Template, TemplateSection, TemplateVariable
- 招标文件类型：BidDocument, VariableValue, BidDocumentSection

## UI 设计规范（飞书 SaaS 风格）

### 色彩体系
- 背景色：`bg-gray-50` / `bg-gray-100`
- 内容区：`bg-white`
- 主题色：`blue-600` (#3370ff - 飞书蓝)
- 文字：`text-slate-900` (主标题) / `text-slate-700` (正文) / `text-slate-500` (辅助)
- 风险提示：`rose-500/bg-rose-50` (高风险) / `amber-500/bg-amber-50` (低风险)

### 交互细节
- 阴影：`shadow-sm` (轻量)
- 边框：`border-slate-200` (细腻)
- 圆角：`rounded-lg`
- 过渡：`transition-colors`

### 设计原则
- 克制的色彩，避免高饱和度
- 清晰的信息层级
- 紧凑但有呼吸感的布局
- 卡片式设计

## 关键业务规则

1. **品类层级规则**：必须先创建产业领域，再创建采购分类，最后创建品类（不可跨层级）
2. **框架绑定规则**：每个框架必须绑定唯一品类，一个品类可对应多个框架
3. **文本绑定规则**：一个文本可绑定到多个框架章节，文本修改后自动同步到所有绑定位置
4. **范本生成规则**：只有已完成框架设计的品类才能生成范本
5. **变量规则**：范本中的变量使用 `{{变量名}}` 格式，生成招标文件时必须填充所有必填变量
6. **资源与范本正文联动（与当前 Mock 实现一致）**：
   - **资源（TextFragment）**：无「草稿 / 已发布」状态；编辑弹窗 **保存** 即更新正文并维护 `contentVersion` / `versions`（旧数据中的 `draftContent`、`status` 会在 `normalizeTextFragment` 中合并并剥离）。
   - **同步到范本**：「同步到所有范本」调用 `syncTextFragmentToAllTemplates` → `updateMockTemplateTextFragment`，把当前资源 HTML 写入引用该资源的范本章节；仅排除 **已逻辑删除**的范本（`deletedAt`），**不**存在「已归档范本跳过」（实现中无范本 `archived` 状态）。
   - **范本（Template）**：状态仅为 **`draft` | `published`**，**无归档 / 解除归档**；若本地存量的 `status === 'archived'` 会在 `getMockTemplates` 读档时 **迁移为 `published`**。
   - **正文解析**：预览/导出用 `resolveSectionRichHtml`（`src/lib/resolveTemplateSectionHtml.ts`）按 `textFragmentId`、绑定关系解析资源当前稿与章节 `content`。
7. **WPS 侧栏插入失败**：资源与变量**仅**向编辑器**当前光标**写入；失败时 **`SystemDialog`** 提供 **重试 / 取消**，**不**提供复制到剪贴板或手动粘贴兜底（`src/components/editor/WpsTemplateEditor.tsx`）。

## 添加新功能页面

如需添加新的功能页面：

1. 在 `src/types/index.ts` 中添加相关类型定义
2. 在 `src/components/pages/` 创建新页面组件
3. 在 `src/types/index.ts` 的 `TabKey` 类型中添加新 key
4. 在 `MainLayout.tsx` 的 `tabs` 数组中添加新 Tab 配置
5. 在 `MainLayout.tsx` 的 `renderContent()` 中添加路由逻辑

## 后端集成准备

当前为纯前端应用，后端集成时需要：

1. 创建 `src/app/api/` 目录，添加 API 路由
2. 将 Mock 数据迁移到后端或提取到 `src/lib/mockData.ts`
3. 使用 `fetch` 或 `axios` 替换组件中的本地状态管理
4. 考虑添加状态管理库（Zustand/Redux）处理全局状态
5. 实现文件导出功能（Word/PDF）

## 注意事项

- 所有页面组件使用 `'use client'` 指令（客户端组件）
- 图标统一使用 Lucide React
- 日期格式统一使用 ISO 格式字符串（YYYY-MM-DD）
- ID 生成使用时间戳或 UUID（当前为简单字符串）
- 模态框和表单状态管理在各页面组件内部处理
