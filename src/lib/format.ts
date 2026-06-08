import { format } from "date-fns";

export function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function shortDate(value: string) {
  return format(parseDate(value), "dd MMM");
}

export function fullDateTime(value: string) {
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}

export function displayDate(value: string) {
  return format(parseDate(value), "dd MMM yyyy");
}

export function todayInputDate() {
  return format(new Date(), "yyyy-MM-dd");
}

function parseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}
