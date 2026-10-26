import { createSeedDb, type MockDb } from "./data";

const STORAGE_KEY = "ib_mock_db_v1";
let memoryDb: MockDb | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getDb(): MockDb {
  if (!isBrowser()) {
    if (!memoryDb) memoryDb = createSeedDb();
    return memoryDb;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === 5) return parsed;
    }
  } catch {
    // Ignore malformed local data and reseed.
  }

  const seeded = createSeedDb();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveDb(db: MockDb) {
  if (!isBrowser()) {
    memoryDb = db;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    throw new Error(
      "Demo storage is full. Remove a few uploaded photos or reset the demo data, then try again.",
    );
  }
}

export function mutateDb<T>(mutator: (db: MockDb) => T): T {
  const db = getDb();
  const result = mutator(db);
  saveDb(db);
  return result;
}

export function resetDb(): MockDb {
  const seeded = createSeedDb();
  saveDb(seeded);
  return seeded;
}

export function clearDb() {
  if (!isBrowser()) {
    memoryDb = null;
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
