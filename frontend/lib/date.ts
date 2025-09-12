// lib/date.ts
const fmtJP = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** ISO文字列 → "YYYY/M/D HH:mm:ss"（Asia/Tokyo, ja-JP） */
export function formatJP(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return "-";
  return fmtJP.format(d);
}

/** SSR/CSRで同一文字列にするため、ISO固定 → フォーマット */
export function isoNowJP() {
  const iso = new Date().toISOString();
  return { iso, label: formatJP(iso) };
}
