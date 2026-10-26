"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  SwitchCamera,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IMAGE_ACCEPT,
  UploadError,
  captureVideoFrame,
  uploadImage,
  type UploadProgress,
} from "@/lib/upload-image";
import { cn } from "@/lib/utils";

type UploadVariant = "photo" | "banner" | "avatar";

function useUploadError() {
  const t = useTranslations();
  return (caught: unknown) => {
    const code = caught instanceof UploadError ? caught.code : "network";
    if (code === "type") return t("uploads.errorType");
    if (code === "size") return t("uploads.errorSize");
    if (code === "decode") return t("uploads.errorDecode");
    return t("uploads.errorNetwork");
  };
}

export function UploadProgressBar({
  progress,
  className,
}: {
  progress: UploadProgress;
  className?: string;
}) {
  const t = useTranslations();
  const label = {
    reading: t("uploads.stageReading"),
    optimizing: t("uploads.stageOptimizing"),
    uploading: t("uploads.stageUploading"),
    finalizing: t("uploads.stageFinalizing"),
    done: t("uploads.stageDone"),
  }[progress.stage];

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted">
          {progress.stage === "done" ? (
            <Check className="h-3 w-3 text-accent" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
          )}
          {label}
        </span>
        <span className="tabular-nums text-faint">{Math.round(progress.percent)}%</span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-surface3 ring-1 ring-inset ring-line/70"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.percent)}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent/45 via-accent to-accent/70 shadow-[0_0_14px_-2px_var(--accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(progress.percent, 3)}%` }}
        />
        {progress.stage !== "done" ? <span className="progress-sheen" aria-hidden /> : null}
      </div>
    </div>
  );
}

function CameraSheet({
  open,
  onOpenChange,
  onCapture,
  onFallback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  onFallback: () => void;
}) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      stopStream();
      setStatus("loading");
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: facing, width: { ideal: 1600 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, open, stopStream]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const file = await captureVideoFrame(video);
      stopStream();
      onCapture(file);
    } catch {
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <DialogHeader className="mb-0 px-4 pt-4">
          <DialogTitle className="text-sm">{t("uploads.cameraTitle")}</DialogTitle>
          <DialogDescription className="text-[11px]">{t("uploads.cameraBody")}</DialogDescription>
        </DialogHeader>

        <div className="relative mx-4 mt-3 aspect-[4/3] overflow-hidden rounded-xl border border-line bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {status === "loading" ? (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : null}
          {status === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="text-[11px] text-white/80">{t("uploads.cameraUnavailable")}</p>
              <Button type="button" size="sm" variant="secondary" onClick={onFallback}>
                <ImagePlus className="h-3.5 w-3.5" />
                {t("uploads.cameraFallback")}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}
            disabled={status === "error"}
          >
            <SwitchCamera className="h-3.5 w-3.5" />
            {t("uploads.cameraSwitch")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={capture} disabled={status !== "ready"}>
              <Camera className="h-4 w-4" />
              {t("uploads.cameraCapture")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ImageUpload({
  value,
  onChange,
  variant = "photo",
  disabled,
  className,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  variant?: UploadVariant;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const errorMessage = useUploadError();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  const handleFile = useCallback(
    async (file?: File | null) => {
      if (!file || disabled) return;
      setError("");
      releasePreview();
      const preview = URL.createObjectURL(file);
      objectUrlRef.current = preview;
      setLocalPreview(preview);
      setProgress({ stage: "reading", percent: 2 });
      try {
        const url = await uploadImage(file, setProgress);
        onChange(url);
        await new Promise((resolve) => setTimeout(resolve, 600));
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setProgress(null);
        setLocalPreview(null);
        releasePreview();
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [disabled, errorMessage, onChange, releasePreview],
  );

  const running = progress !== null;
  const preview = running && localPreview ? localPreview : value;

  const pickFile = () => fileInputRef.current?.click();

  if (variant === "avatar") {
    return (
      <div className={cn("rounded-xl border border-dashed border-line bg-surface2/30 p-3", className)}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-bg">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-5 w-5 text-faint" aria-hidden />
            )}
            {running ? (
              <span className="absolute inset-0 bg-black/35" aria-hidden />
            ) : null}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-fg">
              {value ? t("uploads.changeTitle") : t("uploads.avatarTitle")}
            </p>
            <p className="mt-0.5 text-[10px] text-faint">{t("uploads.hint")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={pickFile}
                disabled={disabled || running}
                className="h-8 px-2.5 text-[11px]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {value ? t("uploads.replace") : t("uploads.choose")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCameraOpen(true)}
                disabled={disabled || running}
                className="h-8 px-2.5 text-[11px]"
              >
                <Camera className="h-3.5 w-3.5" />
                {t("uploads.camera")}
              </Button>
              {value && !running ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onChange(undefined)}
                  aria-label={t("uploads.remove")}
                  className="text-faint hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {progress ? <UploadProgressBar progress={progress} className="mt-3" /> : null}
        {error ? <p className="mt-2 text-[11px] text-danger">{error}</p> : null}

        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <CameraSheet
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(file) => {
            setCameraOpen(false);
            void handleFile(file);
          }}
          onFallback={() => {
            setCameraOpen(false);
            pickFile();
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {!preview ? (
        <div
          onDragOver={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-center transition-colors",
            dragging
              ? "border-accent/60 bg-accent/[0.06]"
              : "border-line bg-surface2/30 hover:border-lineStrong hover:bg-surface2/50",
            disabled ? "opacity-60" : "",
          )}
        >
          <span className="chip-accent flex h-9 w-9 items-center justify-center rounded-xl">
            <UploadCloud className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium text-fg">{t("uploads.dropTitle")}</p>
            <p className="mt-0.5 text-[10px] text-faint">{t("uploads.dropBody")}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={pickFile}
              disabled={disabled}
              className="h-8 px-2.5 text-[11px]"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {t("uploads.choose")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCameraOpen(true)}
              disabled={disabled}
              className="h-8 px-2.5 text-[11px]"
            >
              <Camera className="h-3.5 w-3.5" />
              {t("uploads.camera")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-line bg-bg",
            variant === "banner" ? "h-40" : "h-36",
          )}
          onDragOver={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-full w-full object-cover" />

          {progress ? (
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/25 to-transparent p-3">
              <UploadProgressBar progress={progress} />
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2">
              <span className="inline-flex items-center gap-1 truncate text-[10px] font-medium text-white/75">
                <Check className="h-3 w-3 text-lime" />
                {t("uploads.ready")}
              </span>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={disabled}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  {t("uploads.replace")}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(undefined)}
                  disabled={disabled}
                  aria-label={t("uploads.remove")}
                  className="rounded-full bg-white/15 p-1 text-white backdrop-blur transition-colors hover:bg-danger hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <CameraSheet
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          setCameraOpen(false);
          void handleFile(file);
        }}
        onFallback={() => {
          setCameraOpen(false);
          pickFile();
        }}
      />
    </div>
  );
}

export function MultiImageUpload({
  values,
  onChange,
  max = 6,
  disabled,
  className,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const errorMessage = useUploadError();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [queue, setQueue] = useState<{ index: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, max - values.length);

  const handleFiles = useCallback(
    async (files?: FileList | File[] | null) => {
      if (!files || disabled) return;
      const list = Array.from(files).slice(0, remaining);
      if (list.length === 0) return;
      setError("");
      let next = [...values];
      for (let index = 0; index < list.length; index += 1) {
        setQueue({ index, total: list.length });
        try {
          const url = await uploadImage(list[index], setProgress);
          next = [...next, url];
          onChange(next);
        } catch (caught) {
          setError(errorMessage(caught));
          break;
        }
      }
      setQueue(null);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [disabled, errorMessage, onChange, remaining, values],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={(event) => {
          if (disabled || remaining === 0) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "grid grid-cols-3 gap-2 rounded-xl transition-colors sm:grid-cols-4",
          dragging ? "bg-accent/[0.05] ring-1 ring-inset ring-accent/40" : "",
        )}
      >
        {values.map((url, index) => (
          <div
            key={`${url.slice(-24)}-${index}`}
            className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {!disabled ? (
              <button
                type="button"
                onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={t("uploads.remove")}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white backdrop-blur transition-colors hover:bg-danger"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ))}

        {values.length < max ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || progress !== null}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-surface2/30 text-faint transition-colors hover:border-accent/40 hover:bg-accent/[0.04] hover:text-accent disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            <span className="text-[10px] font-medium">{t("uploads.addPhoto")}</span>
          </button>
        ) : null}
      </div>

      {queue && progress ? (
        <div className="rounded-lg border border-line bg-surface2/40 p-2.5">
          <p className="mb-1.5 text-[10px] font-medium text-faint">
            {t("uploads.galleryProgress", { current: queue.index + 1, total: queue.total })}
          </p>
          <UploadProgressBar progress={progress} />
        </div>
      ) : (
        <p className="text-[10px] text-faint">
          {t("uploads.galleryCounter", { current: values.length, max })}
        </p>
      )}

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || remaining === 0 || progress !== null}
          className="h-8 px-2.5 text-[11px]"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {t("uploads.choose")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setCameraOpen(true)}
          disabled={disabled || remaining === 0 || progress !== null}
          className="h-8 px-2.5 text-[11px]"
        >
          <Camera className="h-3.5 w-3.5" />
          {t("uploads.camera")}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <CameraSheet
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          setCameraOpen(false);
          void handleFiles([file]);
        }}
        onFallback={() => {
          setCameraOpen(false);
          fileInputRef.current?.click();
        }}
      />
    </div>
  );
}
