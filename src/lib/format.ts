export const dateFormatter = new Intl.DateTimeFormat("en-DZ", {
  dateStyle: "medium"
});

export const dateTimeFormatter = new Intl.DateTimeFormat("en-DZ", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function formatDate(value: string | Date) {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDzd(value?: number) {
  if (value == null) {
    return "Free";
  }

  return new Intl.NumberFormat("en-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDistance(value: number) {
  return `${value.toLocaleString("en-DZ")}K`;
}
