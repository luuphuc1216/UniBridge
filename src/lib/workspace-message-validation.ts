export function validateWorkspaceMessageContent(content: string): string | null {
  const normalized = content.trim();
  if (!normalized || normalized.length > 4000) {
    return "Tin nhắn phải có nội dung và không vượt quá 4.000 ký tự.";
  }
  return null;
}
