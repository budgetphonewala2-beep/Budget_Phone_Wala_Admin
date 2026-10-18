export const rupees = (paise: number | null | undefined): string => {
  if (paise == null) return "-";
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s = whole.toString();
  const grouped = s.length > 3 ? s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3) : s;
  return `${neg ? "-" : ""}₹${grouped}${frac ? "." + frac.toString().padStart(2, "0") : ""}`;
};

export const toPaise = (rupeeText: string): number | null => {
  const t = rupeeText.replace(/[,₹\s]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
};

export const dateTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-";

export const label = (s: string | null | undefined): string => (s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "-");

export const maskImei = (v: string | null | undefined): string => (v ? `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : "-");
