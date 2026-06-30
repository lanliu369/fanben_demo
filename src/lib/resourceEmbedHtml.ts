import type { TextFragment } from '@/types';
import { textFragmentAppliesToTemplateLot } from '@/lib/textFragmentLotScope';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function candidatesByName(name: string, lotLevelId: string | undefined, fragments: TextFragment[]): TextFragment[] {
  const n = name.trim();
  if (!n) return [];
  return fragments.filter(
    (f) => !f.deletedAt && f.name.trim() === n && textFragmentAppliesToTemplateLot(f, lotLevelId),
  );
}

/**
 * 将 HTML 中的资源嵌入占位展开为对应资源正文（按范本品类过滤）。
 * 无 DOM 环境时跳过展开，避免 SSR 报错。
 */
export function expandNestedResourceEmbeds(
  html: string,
  lotLevelId: string | undefined,
  fragments: TextFragment[],
  depth = 0,
): string {
  if (depth > 12 || !html.includes('data-resource-embed')) {
    return html;
  }

  if (typeof document === 'undefined') {
    return html;
  }

  try {
    const div = document.createElement('div');
    div.innerHTML = html;

    let guard = 0;
    while (guard++ < 40) {
      const span = div.querySelector('span[data-resource-embed="1"]') as HTMLSpanElement | null;
      if (!span) break;

      const id = span.getAttribute('data-fragment-id')?.trim();
      const nameHint = (span.getAttribute('data-fragment-name') || span.textContent || '').trim();

      let frag: TextFragment | undefined = id ? fragments.find((f) => f.id === id && !f.deletedAt) : undefined;

      if (!frag && nameHint) {
        const cands = candidatesByName(nameHint, lotLevelId, fragments);
        if (cands.length === 1) {
          frag = cands[0];
        } else if (cands.length > 1) {
          const names = cands.map((c) => `${c.name}（${c.id}）`).join('；');
          const tip = `请在资源管理中区分同名资源或指定唯一名称`;
          span.outerHTML =
            `<span class="resource-embed-ambiguous" style="display:inline-block;padding:2px 8px;margin:0 2px;` +
            `background:#fef3c7;color:#92400e;border-radius:6px;font-size:0.88em;border:1px solid #fcd34d;" ` +
            `title="${escapeHtml(tip)}">【待确认：${escapeHtml(nameHint)} · ${escapeHtml(names)}】</span>`;
          continue;
        }
      }

      if (!frag) {
        span.setAttribute('title', '未找到嵌入的资源');
        span.classList.add('resource-embed-missing');
        continue;
      }

      if (!textFragmentAppliesToTemplateLot(frag, lotLevelId)) {
        span.setAttribute(
          'title',
          '当前范本品类不适用该嵌入资源；请在资源管理中调整适用范围或在对应品类内引用',
        );
        span.classList.add('resource-embed-blocked');
        continue;
      }

      const inner = frag.content ?? '';
      const expanded = expandNestedResourceEmbeds(inner, lotLevelId, fragments, depth + 1);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = expanded;
      const parent = span.parentNode;
      if (!parent) break;
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, span);
      }
      span.remove();
    }

    return div.innerHTML;
  } catch {
    return html;
  }
}
