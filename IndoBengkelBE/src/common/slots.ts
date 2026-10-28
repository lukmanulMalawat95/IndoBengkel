import { asClosures, asHours } from "./geo";

/**
 * Booking slots are 60-minute windows derived from the workshop's opening
 * hours (FSD F-09). Every slot calculation in the API goes through this module
 * so availability, booking creation and confirmation cannot drift apart.
 *
 * The workshop timezone is an IANA name (`Asia/Jakarta` by default). The
 * conversion uses Intl instead of a fixed +07:00 offset so a workshop in another
 * zone (or one added later) gets the same behaviour.
 */

const DEFAULT_TIMEZONE = "Asia/Jakarta";
const SLOT_MS = 60 * 60 * 1000;

export type SlotError = "ALIGNMENT" | "CLOSED";

export interface SlotWindow {
  dateKey: string;
  hour: number;
  start: Date;
  end: Date;
}

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function workshopTimeZone(workshop: { timezone?: string | null }) {
  const zone = typeof workshop.timezone === "string" ? workshop.timezone.trim() : "";
  return zone || DEFAULT_TIMEZONE;
}

function zoneParts(date: Date, timeZone: string): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function dateKeyInZone(date: Date, timeZone: string) {
  const parts = zoneParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Weekday of a calendar date in a timezone. Noon UTC stays on the same
 * calendar date for every offset between UTC-11 and UTC+12.
 */
export function dayOfWeekInZone(dateKey: string, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00Z`));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

/** UTC instant of a wall-clock hour in a timezone. */
export function slotStartInZone(dateKey: string, hour: number, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zoneParts(guess, timeZone);
    const actual = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const diff = target - actual;
    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }
  return guess;
}

/**
 * Resolve a requested instant into an existing slot. `ALIGNMENT` means the
 * timestamp is not an exact hour boundary; `CLOSED` means the workshop has no
 * slot at that hour (closed day, closure, or outside opening hours).
 */
export function resolveSlot(
  workshop: { hours: unknown; closures: unknown; timezone?: string | null },
  scheduledAt: Date,
): { slot: SlotWindow } | { error: SlotError } {
  const timeZone = workshopTimeZone(workshop);
  const dateKey = dateKeyInZone(scheduledAt, timeZone);
  const parts = zoneParts(scheduledAt, timeZone);
  if (parts.minute !== 0 || parts.second !== 0 || scheduledAt.getMilliseconds() !== 0) {
    return { error: "ALIGNMENT" };
  }

  const day = dayOfWeekInZone(dateKey, timeZone);
  const dayHours = asHours(workshop.hours).find((entry) => entry.dayOfWeek === day);
  if (!dayHours || dayHours.isClosed) return { error: "CLOSED" };
  if (asClosures(workshop.closures).some((closure) => closure.date === dateKey)) {
    return { error: "CLOSED" };
  }

  const [openH] = dayHours.openTime.split(":").map(Number);
  const [closeH] = dayHours.closeTime.split(":").map(Number);
  if (!(parts.hour >= openH && parts.hour < closeH)) return { error: "CLOSED" };

  const start = slotStartInZone(dateKey, parts.hour, timeZone);
  // A DST jump can make the wall clock ambiguous; refuse instead of guessing.
  if (start.getTime() !== scheduledAt.getTime()) return { error: "ALIGNMENT" };

  return { slot: { dateKey, hour: parts.hour, start, end: new Date(start.getTime() + SLOT_MS) } };
}

/**
 * Slot that contains `at`, floored to the hour in the workshop timezone.
 * Used to count capacity for bookings created before slot validation existed.
 */
export function slotWindowFor(
  workshop: { timezone?: string | null },
  at: Date,
): SlotWindow {
  const timeZone = workshopTimeZone(workshop);
  const dateKey = dateKeyInZone(at, timeZone);
  const { hour } = zoneParts(at, timeZone);
  const start = slotStartInZone(dateKey, hour, timeZone);
  return { dateKey, hour, start, end: new Date(start.getTime() + SLOT_MS) };
}
