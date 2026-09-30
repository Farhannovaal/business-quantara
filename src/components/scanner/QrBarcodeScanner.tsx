"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";

import {
  BarcodeFormat,
} from "@zxing/library";

type ScannerSource = "QR" | "BARCODE";

type QrBarcodeScannerProps = {
  disabled?: boolean;
  onDetected: (
    value: string,
    source: ScannerSource,
  ) => void;
};

type VideoDevice = MediaDeviceInfo;

export default function QrBarcodeScanner({
  disabled = false,
  onDetected,
}: QrBarcodeScannerProps) {
  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const readerRef =
    useRef<BrowserMultiFormatReader | null>(null);

  const controlsRef =
    useRef<IScannerControls | null>(null);

  const detectedRef =
    useRef(false);

  const [devices, setDevices] =
    useState<VideoDevice[]>([]);

  const [selectedDeviceId, setSelectedDeviceId] =
    useState<string>("");

  const [cameraError, setCameraError] =
    useState<string>("");

  const [starting, setStarting] =
    useState(false);

  const stopScanner = useCallback(() => {
    detectedRef.current = false;

    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }

    const video = videoRef.current;

    if (video) {
      video.pause();

      if (video.srcObject) {
        const stream =
          video.srcObject as MediaStream;

        stream.getTracks().forEach((track) => {
          track.stop();
        });

        video.srcObject = null;
      }
    }
  }, []);

  const startScanner = useCallback(
    async (deviceId?: string) => {
      if (disabled) {
        return;
      }

      if (!videoRef.current) {
        return;
      }

      setStarting(true);
      setCameraError("");
      detectedRef.current = false;

      stopScanner();

      try {
        const reader =
          new BrowserMultiFormatReader();

        readerRef.current = reader;

        const availableDevices =
          await BrowserMultiFormatReader.listVideoInputDevices();

        setDevices(availableDevices);

        if (availableDevices.length === 0) {
          throw new Error(
            "Kamera tidak ditemukan pada perangkat ini.",
          );
        }

        const selectedId =
          deviceId ||
          selectedDeviceId ||
          availableDevices[0].deviceId;

        setSelectedDeviceId(selectedId);

        const controls =
          await reader.decodeFromVideoDevice(
            selectedId,
            videoRef.current,
            (result) => {
              if (!result) {
                return;
              }

              if (detectedRef.current) {
                return;
              }

              detectedRef.current = true;

              const text =
                result.getText().trim();

              if (!text) {
                detectedRef.current = false;
                return;
              }

              const format =
                result.getBarcodeFormat();

              const source: ScannerSource =
                format === BarcodeFormat.QR_CODE
                  ? "QR"
                  : "BARCODE";

              onDetected(text, source);
            },
          );

        controlsRef.current = controls;
      } catch (error) {
        console.error(
          "QR/Barcode scanner error:",
          error,
        );

        const message =
          error instanceof Error
            ? error.message
            : "Tidak dapat mengakses kamera.";

        setCameraError(message);
      } finally {
        setStarting(false);
      }
    },
    [
      disabled,
      onDetected,
      selectedDeviceId,
      stopScanner,
    ],
  );

  useEffect(() => {
    if (disabled) {
      stopScanner();
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      if (!videoRef.current) {
        return;
      }

      try {
        setCameraError("");

        const availableDevices =
          await BrowserMultiFormatReader.listVideoInputDevices();

        if (cancelled) {
          return;
        }

        setDevices(availableDevices);

        if (availableDevices.length > 0) {
          setSelectedDeviceId(
            (current) =>
              current ||
              availableDevices[0].deviceId,
          );
        }
      } catch (error) {
        console.error(
          "Failed to list camera devices:",
          error,
        );

        if (!cancelled) {
          setCameraError(
            "Tidak dapat membaca daftar kamera.",
          );
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [disabled, stopScanner]);

  useEffect(() => {
    if (disabled) {
      stopScanner();
    }
  }, [disabled, stopScanner]);

  const handleCameraChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const deviceId = event.target.value;

    setSelectedDeviceId(deviceId);

    startScanner(deviceId);
  };

  return (
    <div className="space-y-4">
      {/* Camera Preview */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        <div className="relative aspect-video w-full">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />

          {/* Camera not active */}
          {!starting &&
            !controlsRef.current &&
            !disabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-xl bg-black/60 px-4 py-3 text-center text-sm text-white backdrop-blur">
                  Kamera belum aktif
                </div>
              </div>
            )}

          {/* Disabled */}
          {disabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="rounded-xl bg-white/10 px-4 py-3 text-center text-sm text-white backdrop-blur">
                Scanner dinonaktifkan
              </div>
            </div>
          )}

          {/* Scanner frame */}
          {!disabled && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-52 w-72">
                {/* Top left */}
                <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-white" />

                {/* Top right */}
                <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-white" />

                {/* Bottom left */}
                <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-white" />

                {/* Bottom right */}
                <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-white" />

                {/* Scan line */}
                <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-indigo-500" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Error */}
      {cameraError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {cameraError}
        </div>
      )}

      {!disabled && (
        <div className="space-y-3">
          {/* Camera Selection */}
          {devices.length > 1 && (
            <div>
              <label
                htmlFor="scanner-camera"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Kamera
              </label>

              <select
                id="scanner-camera"
                value={selectedDeviceId}
                onChange={handleCameraChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {devices.map(
                  (
                    device: VideoDevice,
                    index,
                  ) => (
                    <option
                      key={
                        device.deviceId ||
                        `camera-${index}`
                      }
                      value={device.deviceId}
                    >
                      {device.label ||
                        `Camera ${index + 1}`}
                    </option>
                  ),
                )}
              </select>
            </div>
          )}

          {/* Scanner Controls */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                startScanner(selectedDeviceId)
              }
              disabled={starting}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting
                ? "Menyalakan kamera..."
                : "Mulai Scanner"}
            </button>

            <button
              type="button"
              onClick={stopScanner}
              disabled={
                starting ||
                !controlsRef.current
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}