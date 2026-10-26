import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serves files written by POST /api/uploads.
 *
 * `next start` builds its static public-file manifest at build time, so files
 * added to `public/` afterwards are not served by the static handler. Reading
 * them through a route handler keeps uploads working in Docker and in any
 * long-running Node deployment.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const safeName = path.basename(name);
  const extension = safeName.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[extension];

  if (!contentType || safeName !== name) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), "public", "uploads", safeName));
    return new Response(new Uint8Array(file), {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}
