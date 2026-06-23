const KEY_PREFIX = 'oo-template-docx:';

/** 浏览器端缓存导入的 docx（base64），避免服务端无持久化卷时编辑器打开空白 */
export function saveTemplateDocxCache(templateId: string, base64: string): void {
  if (typeof window === 'undefined' || !templateId.trim() || !base64.trim()) return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${templateId}`, base64);
  } catch {
    // 超出 quota 时静默失败，仍依赖服务端 docx
  }
}

export function loadTemplateDocxCache(templateId: string): string | null {
  if (typeof window === 'undefined' || !templateId.trim()) return null;
  try {
    return localStorage.getItem(`${KEY_PREFIX}${templateId}`);
  } catch {
    return null;
  }
}

export function removeTemplateDocxCache(templateId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${KEY_PREFIX}${templateId}`);
  } catch {
    /* ignore */
  }
}
