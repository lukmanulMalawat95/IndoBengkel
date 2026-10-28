import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { cookies } from "next/headers";
import path from "node:path";

/** Matches the SPEC upload limit for workshop/product photos. */
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Ask the API who owns the incoming session. The upload route lives in the
 * Next.js server, so it cannot rely on the client-side session store and must
 * validate the httpOnly cookie against the source of truth.
 */
async function authenticatedSession() {
  const jar = await cookies();
  if (!jar.has("ib_session")) return null;
  const cookie = jar.toString();

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { cookie, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: { id?: string } };
    if (!payload.data?.id) return null;
    return { user: payload.data, cookie, csrf: jar.get("ib_csrf")?.value };
  } catch {
    return null;
  }
}

/**
 * Record the file owner in the API database. The bytes stay in this tier; the
 * session cookie proves who uploaded them. Without this record another
 * signed-in user could reference the URL on their own profile.
 */
async function registerUpload(
  session: { cookie: string; csrf?: string },
  metadata: { name: string; mimeType: string; size: number },
) {
  try {
    const response = await fetch(`${API_URL}/api/v1/uploads`, {
      method: "POST",
      headers: {
        cookie: session.cookie,
        accept: "application/json",
        "content-type": "application/json",
        ...(session.csrf ? { "x-csrf-token": session.csrf } : {}),
      },
      body: JSON.stringify(metadata),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Trust the bytes, not the browser-provided content type. */
function matchesSignature(bytes: Buffer, extension: string) {
  switch (extension) {
    case "jpg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "png":
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "webp":
      return (
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
}

/**
 * Local upload endpoint.
 *
 * Only an authenticated user may write a file. Files are written to
 * `public/uploads` and served back through the matching GET handler on this
 * route. When a real object store is wired up, swap the write below for an
 * S3/MinIO call and keep the same `{ url }` response shape.
 */
export async function POST(request: Request) {
  const session = await authenticatedSession();
  if (!session) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "MISSING_FILE" }, 400);
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return json({ error: "UNSUPPORTED_TYPE" }, 415);
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return json({ error: "FILE_TOO_LARGE" }, 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(bytes, extension)) {
    return json({ error: "INVALID_IMAGE" }, 415);
  }

  const name = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${extension}`;
  const directory = path.join(process.cwd(), "public", "uploads");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, name), bytes, { flag: "wx" });
  } catch {
    // Read-only filesystem (e.g. serverless deploy): the client falls back to
    // storing the optimised image inline.
    return json({ error: "STORAGE_UNAVAILABLE" }, 503);
  }

  const registered = await registerUpload(session, {
    name,
    mimeType: file.type,
    size: file.size,
  });
  if (!registered) {
    await unlink(path.join(directory, name)).catch(() => undefined);
    return json({ error: "STORAGE_UNAVAILABLE" }, 503);
  }

  return json({ url: `/api/uploads/${name}` }, 201);
}
