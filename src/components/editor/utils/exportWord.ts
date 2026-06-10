import { asBlob } from 'html-docx-js-typescript';

export async function exportWord(html: string, filename: string) {
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = await asBlob(fullHtml);
  const url = URL.createObjectURL(blob as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
