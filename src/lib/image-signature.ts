export function detectImageMime(content: Uint8Array): string | null {
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (content.length >= png.length && png.every((byte, index) => content[index] === byte)) {
    return "image/png";
  }
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}
