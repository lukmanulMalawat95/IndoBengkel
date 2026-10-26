/**
 * Client-side image pipeline: read → downscale → compress → upload.
 *
 * The upload step talks to `/api/uploads`. When that endpoint is not writable
 * (for example a read-only deploy) the optimised image is returned as a data
 * URL so the demo keeps working offline.
 */

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_IMAGE_EDGE = 1280;
const MAX_OUTPUT_BYTES = 340 * 1024;
const MIN_PROGRESS_MS = 720;

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type UploadStage = "reading" | "optimizing" | "uploading" | "finalizing" | "done";
export type UploadProgress = { stage: UploadStage; percent: number };
export type UploadErrorCode = "type" | "size" | "decode" | "network";

export class UploadError extends Error {
  code: UploadErrorCode;

  constructor(code: UploadErrorCode) {
    super(code);
    this.name = "UploadError";
    this.code = code;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function readFileAsDataUrl(file: Blob, onProgress?: (ratio: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new UploadError("decode"));
    reader.readAsDataURL(file);
  });
}

function decodeImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new UploadError("decode"));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new UploadError("decode"))),
      "image/jpeg",
      quality,
    );
  });
}

function postFile(file: File, onProgress: (ratio: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.responseType = "text";
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new UploadError("network"));
    xhr.onabort = () => reject(new UploadError("network"));
    xhr.ontimeout = () => reject(new UploadError("network"));
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}") as { url?: string };
        if (xhr.status >= 200 && xhr.status < 300 && payload.url) {
          resolve(payload.url);
          return;
        }
      } catch {
        // fall through to the rejection below
      }
      reject(new UploadError("network"));
    };

    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

/**
 * Validates, optimises and uploads a single image.
 * Resolves with a public URL (or an inline data URL when storage is offline).
 */
export async function uploadImage(
  file: File,
  report: (progress: UploadProgress) => void,
): Promise<string> {
  if (!SUPPORTED_TYPES.includes(file.type)) throw new UploadError("type");
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new UploadError("size");

  const startedAt = Date.now();

  report({ stage: "reading", percent: 4 });
  const raw = await readFileAsDataUrl(file, (ratio) =>
    report({ stage: "reading", percent: 4 + Math.round(ratio * 14) }),
  );
  await wait(60);

  report({ stage: "optimizing", percent: 22 });
  const image = await decodeImage(raw);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new UploadError("decode");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  report({ stage: "optimizing", percent: 36 });
  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_OUTPUT_BYTES && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  report({ stage: "uploading", percent: 42 });
  const upload = new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, {
    type: "image/jpeg",
  });

  let url: string;
  try {
    url = await postFile(upload, (ratio) =>
      report({ stage: "uploading", percent: 42 + Math.round(ratio * 50) }),
    );
  } catch {
    report({ stage: "finalizing", percent: 94 });
    url = await readFileAsDataUrl(blob);
  }

  report({ stage: "done", percent: 100 });

  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_PROGRESS_MS) await wait(MIN_PROGRESS_MS - elapsed);

  return url;
}

/** Grabs the current video frame as a JPEG file for the upload pipeline. */
export function captureVideoFrame(video: HTMLVideoElement) {
  return new Promise<File>((resolve, reject) => {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      reject(new UploadError("decode"));
      return;
    }

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new UploadError("decode"));
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new UploadError("decode"));
          return;
        }
        resolve(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}
