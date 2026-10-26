import { randomUUID } from "node:crypto";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function randomCode(prefix: string, length = 5) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${out}`;
}

export function uid(prefix = "id") {
  return `${prefix}-${randomUUID()}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
