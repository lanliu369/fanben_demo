const tickets = new Map<string, { fileId: string; expires: number }>();

export function issueUploadTicket(fileId: string, ttlMs = 900000): string {
  const secret = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  tickets.set(secret, { fileId, expires: Date.now() + ttlMs });
  return secret;
}

export function validateUploadTicket(secret: string | null, fileId: string): boolean {
  if (!secret) return false;
  const rec = tickets.get(secret);
  return !!(rec && rec.fileId === fileId && Date.now() <= rec.expires);
}

export function revokeUploadTicket(secret: string): void {
  tickets.delete(secret);
}
