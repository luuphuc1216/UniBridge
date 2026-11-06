function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function isSignificantProblemTextChange(previous: string, next: string) {
  const left = normalizeText(previous);
  const right = normalizeText(next);
  if (left === right) return false;
  return editDistance(left, right) > Math.max(3, Math.floor(Math.max(left.length, right.length) * 0.1));
}
