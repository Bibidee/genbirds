// Lightweight deterministic FNV-1a 32-bit hash, hex output.
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}
export function hashJSON(obj: unknown): string {
  return hashString(JSON.stringify(obj));
}
