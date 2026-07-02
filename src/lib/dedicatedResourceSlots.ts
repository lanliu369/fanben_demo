import type { TextFragment } from '@/types';

export type DedicatedResourceModule = Exclude<NonNullable<TextFragment['module']>, 'text'>;

export type DedicatedResourceSlotItem = {
  slotName: string;
  module: DedicatedResourceModule;
};

export const DEDICATED_RESOURCE_MODULE_ORDER: DedicatedResourceModule[] = [
  'qualification',
  'technical-spec',
  'evaluation',
  'contract-clause',
];

export const DEDICATED_RESOURCE_MODULE_LABELS: Record<DedicatedResourceModule, string> = {
  qualification: '资格条件',
  'technical-spec': '技术规范',
  evaluation: '评标办法',
  'contract-clause': '合同条款',
};

function isDedicatedResourceModule(
  module: TextFragment['module'],
): module is DedicatedResourceModule {
  return Boolean(module && module !== 'text');
}

/**
 * 通用模版编辑器：汇总专有资源「变量名称」目录。
 *
 * 通用模版不绑定品类，此处**不按品类过滤或分组**；
 * 仅按资源模块（资格/技规/评标/合同）归纳，同模块下同名变量名称去重。
 * 范本打开时再由「品类 + 变量名称」解析为具体资源正文。
 */
export function collectDedicatedResourceSlotCatalog(
  fragments: readonly TextFragment[],
): DedicatedResourceSlotItem[] {
  const seen = new Set<string>();
  const items: DedicatedResourceSlotItem[] = [];

  for (const frag of fragments) {
    if (frag.deletedAt) continue;
    if (!isDedicatedResourceModule(frag.module)) continue;
    const slotName = (frag.slotName ?? '').trim();
    if (!slotName) continue;
    const dedupeKey = `${frag.module}::${slotName}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    items.push({ slotName, module: frag.module });
  }

  return items.sort((a, b) => {
    const moduleOrder =
      DEDICATED_RESOURCE_MODULE_ORDER.indexOf(a.module)
      - DEDICATED_RESOURCE_MODULE_ORDER.indexOf(b.module);
    if (moduleOrder !== 0) return moduleOrder;
    return a.slotName.localeCompare(b.slotName, 'zh-CN');
  });
}
