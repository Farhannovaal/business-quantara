export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}
export function formatNumber(value: number | string) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}
export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}
