/** GitHub exposes bytes, not line counts. These are approximate bytes per line. */
export const bytesPerLine: Record<string, number> = {
  TypeScript: 45, JavaScript: 45, HTML: 60, CSS: 35, Python: 40,
  Shell: 40, Go: 35, Rust: 45, Java: 50, Ruby: 35, PHP: 45,
};
export function estimateLines(languages: Record<string, unknown>): number | null {
  const entries = Object.entries(languages);
  if (!entries.length || entries.some(([, bytes]) => typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0)) return null;
  return Math.round(entries.reduce((total, [language, bytes]) => total + (bytes as number) / (bytesPerLine[language] ?? 45), 0));
}
