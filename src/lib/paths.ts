export function normalisePath(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

export function pathsEqual(a: string, b: string): boolean {
  return normalisePath(a) === normalisePath(b);
}
