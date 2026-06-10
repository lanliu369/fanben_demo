/**
 * 详情/预览展示用：小节编号（如 1.4.1）或中文序号（如 (1)）与紧随的首个汉字之间若无空格，则插入空格，
 * 避免「1.4.1投标人」视觉紧贴。不修改存储中的原始 HTML。
 */
export function outlineSpacingHtml(html: string): string {
  if (!html) return '';
  let s = html;
  // 1 / 1.2 / 1.4.1 … 与紧随 CJK（典型条款编号）
  s = s.replace(
    /(^|[^0-9])(\d(?:\.\d{1,2}){1,4})(?=[\u4e00-\u9fff])/g,
    (_, pre: string, num: string) => `${pre}${num} `,
  );
  // (1)投标人、（1）投标人
  s = s.replace(/(\([\d一二三四五六七八九十]+\))(?=[\u4e00-\u9fff])/g, '$1 ');
  s = s.replace(/(（[\d一二三四五六七八九十]+）)(?=[\u4e00-\u9fff])/g, '$1 ');
  return s;
}
