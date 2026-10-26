export interface WorkshopHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface WorkshopClosure {
  id: string;
  date: string;
  reason?: string;
}

const WIB_OFFSET = "+07:00";

export function asHours(value: unknown): WorkshopHours[] {
  return Array.isArray(value) ? (value as WorkshopHours[]) : [];
}

export function asClosures(value: unknown): WorkshopClosure[] {
  return Array.isArray(value) ? (value as WorkshopClosure[]) : [];
}

export function jakartaNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    day: dayMap[get("weekday")] ?? new Date().getDay(),
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function dateKeyInJakarta(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isOpenNow(hours: WorkshopHours[], closures: WorkshopClosure[]) {
  const now = jakartaNow();
  if (closures.some((closure) => closure.date === now.dateKey)) return false;
  const today = hours.find((hour) => hour.dayOfWeek === now.day);
  if (!today || today.isClosed) return false;
  const [openH, openM] = today.openTime.split(":").map(Number);
  const [closeH, closeM] = today.closeTime.split(":").map(Number);
  const open = openH * 60 + openM;
  const close = closeH * 60 + closeM;
  return now.minutes >= open && now.minutes < close;
}

export function nextSlotFor(hours: WorkshopHours[], closures: WorkshopClosure[]) {
  const now = jakartaNow();
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000);
    const key = dateKeyInJakarta(date);
    if (closures.some((closure) => closure.date === key)) continue;
    const day = new Date(`${key}T12:00:00${WIB_OFFSET}`).getUTCDay();
    const dayHours = hours.find((hour) => hour.dayOfWeek === day);
    if (!dayHours || dayHours.isClosed) continue;
    const [openH] = dayHours.openTime.split(":").map(Number);
    const [closeH] = dayHours.closeTime.split(":").map(Number);
    for (let hour = openH; hour < closeH; hour += 1) {
      if (offset === 0 && hour * 60 <= now.minutes + 60) continue;
      return new Date(`${key}T${String(hour).padStart(2, "0")}:00:00${WIB_OFFSET}`).toISOString();
    }
  }
  return undefined;
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function paginate<T>(items: T[], page = 1, perPage = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.min(100, Math.max(1, Number(perPage) || 20));
  const start = (safePage - 1) * safePerPage;
  return {
    data: items.slice(start, start + safePerPage),
    meta: { page: safePage, perPage: safePerPage, total: items.length },
  };
}

export function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function booleanOrUndefined(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return value === true || value === "true" || value === "1";
}
