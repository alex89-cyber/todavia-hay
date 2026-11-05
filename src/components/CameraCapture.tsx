
"use client";

import { useEffect, useRef, useState } from "react";

type CameraCaptureProps = {
  lang: "es" | "en";
  onCapture: (file: File) => Promise<void>;
  onClose: () => void;
};

type CameraStatus =
  | "loading"
  | "live"
  | "preview"
  | "error";

export function CameraCapture({
  lang,
  onCapture,
  onClose,
}: CameraCaptureProps) {
  const es = lang === "es";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [status, setStatus] =
    useState<CameraStatus>("loading");

  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function stopCamera() {
    const stream = streamRef.current;

    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreviewUrl("");
    setPhoto(null);
  }

  // Este componente únicamente se monta cuando
  // el usuario pulsa "Tomar foto".
  // Nunca se inicia la cámara al abrir Configuración.
  useEffect(() => {
    let cancelled = false;
    let openedStream: MediaStream | null = null;

    async function startCamera() {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setError(
          es
            ? "Este navegador no permite abrir la cámara. Prueba con Chrome o Edge en localhost o HTTPS."
            : "This browser cannot open the camera. Try Chrome or Edge on localhost or HTTPS.",
        );

        setStatus("error");
        return;
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: {
                ideal: "environment",
              },
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            },
          });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        openedStream = stream;
        streamRef.current = stream;
        setStatus("live");
        setError("");
      } catch (err) {
        if (cancelled) return;

        const name =
          err instanceof DOMException ? err.name : "";

        let message = es
          ? "No fue posible abrir la cámara."
          : "Could not open the camera.";

        if (
          name === "NotAllowedError" ||
          name === "PermissionDeniedError"
        ) {
          message = es
            ? "No autorizaste el acceso a la cámara. Puedes permitirlo en los ajustes del navegador o subir una imagen."
            : "Camera access was denied. You can allow it in browser settings or upload an image.";
        }

        if (
          name === "NotFoundError" ||
          name === "DevicesNotFoundError"
        ) {
          message = es
            ? "No encontramos una cámara disponible en este dispositivo."
            : "No camera was found on this device.";
        }

        if (
          name === "NotReadableError" ||
          name === "TrackStartError"
        ) {
          message = es
            ? "La cámara parece estar ocupada por otra aplicación. Ciérrala e inténtalo nuevamente."
            : "The camera may be in use by another application. Close it and try again.";
        }

        setError(message);
        setStatus("error");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;

      if (openedStream) {
        openedStream
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (streamRef.current === openedStream) {
        streamRef.current = null;
      }
    };
  }, [attempt, es]);

  // Conectar el video a la cámara cuando esté lista.
  useEffect(() => {
    if (status !== "live") return;

    const video = videoRef.current;
    const stream = streamRef.current;

    if (video && stream) {
      video.srcObject = stream;

      void video.play().catch(() => {
        setError(
          es
            ? "No se pudo reproducir la imagen de la cámara."
            : "Could not display the camera feed.",
        );
        setStatus("error");
      });
    }
  }, [status, es]);

  // Limpiar los recursos al desmontar el componente.
  useEffect(() => {
    return () => {
      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  async function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      !video ||
      !canvas ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setError(
        es
          ? "La cámara todavía no está lista para tomar la foto."
          : "The camera is not ready to capture a photo.",
      );
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      setError(
        es
          ? "No se pudo procesar la fotografía."
          : "Could not process the photograph.",
      );
      return;
    }

    // Mantener la proporción de la cámara y
    // limitar la fotografía a un tamaño razonable.
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / video.videoWidth);

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (result) => resolve(result),
        "image/jpeg",
        0.88,
      );
    });

    if (!blob) {
      setError(
        es
          ? "No se pudo capturar la fotografía."
          : "Could not capture the photograph.",
      );
      return;
    }

    const file = new File(
      [blob],
      `foto-negocio-${Date.now()}.jpg`,
      {
        type: "image/jpeg",
      },
    );

    const url = URL.createObjectURL(blob);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    previewUrlRef.current = url;
    setPhoto(file);
    setPreviewUrl(url);

    // Una vez capturada la imagen,
    // dejamos de utilizar la cámara.
    stopCamera();
    setStatus("preview");
  }

  function retakePhoto() {
    clearPreview();
    setError("");
    setStatus("loading");
    setAttempt((current) => current + 1);
  }

  async function uploadCapturedPhoto() {
    if (!photo || saving) return;

    setSaving(true);
    setError("");

    try {
      await onCapture(photo);
      // El componente padre cerrará esta ventana
      // después de confirmar que la carga terminó.
      onClose();
    } catch {
      setError(
        es
          ? "No se pudo subir la fotografía. Inténtalo nuevamente."
          : "Could not upload the photograph. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function closeCamera() {
    stopCamera();
    clearPreview();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 sm:p-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-title"
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-[#fffaf4] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#eaded3] px-5 py-4 sm:px-6">
          <div>
            <h2
              id="camera-title"
              className="text-xl font-black text-[#302018]"
            >
              {es ? "Tomar fotografía" : "Take a photo"}
            </h2>

            <p className="mt-1 text-sm text-[#80695d]">
              {es
                ? "Revisa tu foto antes de subirla."
                : "Review your photo before uploading."}
            </p>
          </div>

          <button
            type="button"
            onClick={closeCamera}
            disabled={saving}
            aria-label={es ? "Cerrar cámara" : "Close camera"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-xl font-bold text-[#302018] transition hover:bg-[#f5e6d8] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="relative flex min-h-[250px] items-center justify-center bg-[#1c1917] sm:min-h-[400px]">
          {status === "loading" && (
            <div
              role="status"
              className="px-6 py-16 text-center text-white"
            >
              <div className="mb-4 text-4xl">📷</div>

              <p className="font-semibold">
                {es
                  ? "Solicitando acceso a la cámara..."
                  : "Requesting camera access..."}
              </p>

              <p className="mt-2 text-sm text-white/70">
                {es
                  ? "Autoriza el acceso cuando el navegador te lo pida."
                  : "Allow access when your browser asks."}
              </p>
            </div>
          )}

          {status === "live" && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[65vh] min-h-[250px] w-full object-contain sm:min-h-[400px]"
              aria-label={
                es
                  ? "Vista en vivo de la cámara"
                  : "Live camera preview"
              }
            />
          )}

          {status === "preview" && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={
                es
                  ? "Fotografía capturada"
                  : "Captured photograph"
              }
              className="max-h-[65vh] w-full object-contain"
            />
          )}

          {status === "error" && (
            <div className="px-6 py-16 text-center text-white">
              <div className="mb-4 text-4xl">⚠️</div>

              <p className="font-semibold">
                {error}
              </p>
            </div>
          )}
        </div>

        <canvas
          ref={canvasRef}
          className="hidden"
          aria-hidden="true"
        />

        {error && status !== "error" && (
          <p
            role="alert"
            className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={closeCamera}
            disabled={saving}
            className="rounded-xl border border-[#eaded3] bg-white px-5 py-3 text-sm font-bold text-[#4b3024] disabled:opacity-50"
          >
            {es ? "Cancelar" : "Cancel"}
          </button>

          {status === "live" && (
            <button
              type="button"
              onClick={() => void takePhoto()}
              className="rounded-xl bg-[#a3341f] px-6 py-3 text-sm font-bold text-white hover:bg-[#862a1a]"
            >
              📸 {es ? "Capturar foto" : "Capture photo"}
            </button>
          )}

          {status === "preview" && (
            <>
              <button
                type="button"
                onClick={retakePhoto}
                disabled={saving}
                className="rounded-xl border border-[#eaded3] bg-white px-5 py-3 text-sm font-bold text-[#4b3024] disabled:opacity-50"
              >
                {es ? "Repetir foto" : "Retake"}
              </button>

              <button
                type="button"
                onClick={() => void uploadCapturedPhoto()}
                disabled={saving}
                className="rounded-xl bg-[#a3341f] px-6 py-3 text-sm font-bold text-white hover:bg-[#862a1a] disabled:opacity-50"
              >
                {saving
                  ? es
                    ? "Subiendo..."
                    : "Uploading..."
                  : es
                    ? "Usar fotografía"
                    : "Use photo"}
              </button>
            </>
          )}

          {status === "error" && (
            <button
              type="button"
              onClick={retakePhoto}
              className="rounded-xl bg-[#a3341f] px-6 py-3 text-sm font-bold text-white"
            >
              {es ? "Intentar de nuevo" : "Try again"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
