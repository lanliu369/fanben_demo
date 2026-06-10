/**
 * 从富文本 HTML 中解析「资源嵌入」占位（span[data-resource-embed="1"]）的展示名称。
 * 顺序与正文出现顺序一致；同名只保留首次出现。
 */
export function extractResourceEmbedLabelsFromHtml(html: string): string[] {
  if (!html || !html.includes('data-resource-embed')) return [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const seen = new Set<string>();
      const out: string[] = [];
      doc.querySelectorAll('span[data-resource-embed="1"]').forEach((el) => {
        const name = (
          el.getAttribute('data-fragment-name')
          || el.textContent
          || ''
        ).trim();
        if (!name || seen.has(name)) return;
        seen.add(name);
        out.push(name);
      });
      return out;
    } catch {
      // fall through
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  const re =
    /<span\b[^>]*\bdata-resource-embed\s*=\s*["']?1["']?[^>]*>([\s\S]*?)<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const full = m[0];
    const gt = full.indexOf('>');
    const openTag = gt >= 0 ? full.slice(0, gt + 1) : full;
    const nameAttr =
      /\bdata-fragment-name\s*=\s*["']([^"']*)["']/i.exec(openTag)
      || /\bdata-fragment-name\s*=\s*([^\s>]+)/i.exec(openTag);
    const inner = m[1].replace(/<[^>]+>/g, '').trim();
    const name = (nameAttr?.[1] ?? inner).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
