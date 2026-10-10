"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createWorker,
  PSM,
  type Worker,
} from "tesseract.js";

type GeminiOcrData = {
  documentNumber: string | null;
  date: string | null;
  spkNumber: string | null;
  transactionType: string | null;
  productCode: string | null;
  productName: string | null;
  tailorName: string | null;
  employeeName: string | null;
  quantity: number | null;
  unit: string | null;
};

type OcrScannerProps = {
  disabled?: boolean;
  onResult: (result: {
    text: string;
    documentNumber: string | null;
    aiData?: GeminiOcrData | null;
  }) => void;
};

type CameraDevice = {
  deviceId: string;
  label: string;
};

type OcrResult = {
  text: string;
  documentNumber: string | null;
};

function normalizeOcrText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐-‒–—]/g, "-")
    .replace(/[|]/g, "I")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Mencari nomor dokumen secara langsung.
 *
 * Contoh:
 * NT-20260930-00129
 * NT 20260930 00129
 * NT:20260930:00129
 * N T 20260930 00129
 */
function extractDirectDocumentNumber(
  text: string,
): string | null {
  const normalized = normalizeOcrText(text);

  const patterns = [
    /\bNT[\s:._-]*(\d{8})[\s:._-]*(\d{5,6})\b/i,

    /\bN[\s:._-]+T[\s:._-]*(\d{8})[\s:._-]*(\d{5,6})\b/i,

    /\bN[7T][\s:._-]*(\d{8})[\s:._-]*(\d{5,6})\b/i,

    /\bNT[\s:._-]*(\d{4})[\s:/.-]*(\d{2})[\s:/.-]*(\d{2})[\s:._-]*(\d{5,6})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (!match) {
      continue;
    }

    if (match.length === 3) {
      return `NT-${match[1]}-${match[2]}`;
    }

    if (match.length === 5) {
      return `NT-${match[1]}${match[2]}${match[3]}-${match[4]}`;
    }
  }

  return null;
}

/**
 * Fallback kalau prefix NT tidak terbaca.
 *
 * HANYA digunakan apabila pola tanggal + sequence
 * memang terbaca dengan cukup jelas.
 */
function extractDateSequence(
  text: string,
): string | null {
  const normalized = normalizeOcrText(text);

  const patterns = [
    /\b(20\d{2})(\d{2})(\d{2})[\s:._/-]+(\d{5,6})\b/,

    /\b(20\d{2})[\s:._/-]+(\d{2})[\s:._/-]+(\d{2})[\s:._/-]+(\d{5,6})\b/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (!match) {
      continue;
    }

    return `NT-${match[1]}${match[2]}${match[3]}-${match[4]}`;
  }

  return null;
}

/**
 * OCR khusus untuk nomor nota.
 *
 * Mencoba berbagai bentuk hasil OCR:
 *
 * NT-20260930-00129
 * NT 20260930 00129
 * N T 20260930 00129
 * N7 20260930 00129
 */
function extractDocumentNumber(
  text: string,
): string | null {
  const direct =
    extractDirectDocumentNumber(text);

  if (direct) {
    return direct;
  }

  return extractDateSequence(text);
}

/**
 * Membuat canvas dari frame kamera.
 */
function captureVideoFrame(
  video: HTMLVideoElement,
) {
  if (
    video.videoWidth <= 0 ||
    video.videoHeight <= 0
  ) {
    throw new Error(
      "Resolusi kamera belum tersedia.",
    );
  }

  const canvas =
    document.createElement("canvas");

  const maxWidth = 1800;

  let width = video.videoWidth;
  let height = video.videoHeight;

  if (width > maxWidth) {
    const ratio =
      video.videoHeight /
      video.videoWidth;

    width = maxWidth;
    height = Math.round(
      width * ratio,
    );
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error(
      "Canvas tidak tersedia.",
    );
  }

  ctx.drawImage(
    video,
    0,
    0,
    width,
    height,
  );

  return canvas;
}

/**
 * Preprocessing:
 *
 * original
 *    ↓
 * grayscale
 *    ↓
 * contrast
 *    ↓
 * threshold (optional)
 */
function preprocessCanvas(
  source: HTMLCanvasElement,
  mode: "enhanced" | "binary",
) {
  const output =
    document.createElement("canvas");

  const scale = 2.5;

  output.width = Math.min(
    Math.round(
      source.width * scale,
    ),
    3000,
  );

  output.height = Math.min(
    Math.round(
      source.height * scale,
    ),
    3000,
  );

  const ctx = output.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    return output;
  }

  ctx.drawImage(
    source,
    0,
    0,
    output.width,
    output.height,
  );

  const imageData =
    ctx.getImageData(
      0,
      0,
      output.width,
      output.height,
    );

  const data = imageData.data;

  const contrast = 1.8;

  const factor =
    (259 * (contrast * 255 + 255)) /
    (255 * (259 - contrast * 255));

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    gray =
      factor * (gray - 128) + 128;

    gray = Math.max(
      0,
      Math.min(255, gray),
    );

    if (mode === "binary") {
      gray =
        gray > 165
          ? 255
          : 0;
    }

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(
    imageData,
    0,
    0,
  );

  return output;
}

/**
 * Crop area nomor nota.
 *
 * Karena layout nota kita:
 *
 * ┌─────────────────────────────┐
 * │ TBD Overpassion OperationS     │
 * │                             │
 * │ NO. NOTA : NT-...           │
 * │ TANGGAL  : ...               │
 * │ NO. SPK  : ...               │
 * └─────────────────────────────┘
 *
 * Kita ambil area bagian atas,
 * bukan seluruh nota.
 */
function cropDocumentNumberRegion(
  source: HTMLCanvasElement,
) {
  const width = source.width;
  const height = source.height;

  /**
   * Ambil sekitar 42% bagian atas.
   *
   * Ini sengaja cukup besar supaya
   * tetap bekerja kalau posisi kamera
   * sedikit bergeser.
   */
  const cropHeight =
    Math.round(height * 0.42);

  const crop =
    document.createElement("canvas");

  crop.width = width;
  crop.height = cropHeight;

  const ctx = crop.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    return crop;
  }

  ctx.drawImage(
    source,
    0,
    0,
    width,
    cropHeight,
    0,
    0,
    width,
    cropHeight,
  );

  return crop;
}

/**
 * Crop area yang lebih kecil lagi.
 *
 * Berguna kalau OCR region pertama
 * masih terlalu banyak membaca elemen
 * lain.
 */
function cropTopCenterRegion(
  source: HTMLCanvasElement,
) {
  const width = source.width;
  const height = source.height;

  const cropWidth =
    Math.round(width * 0.92);

  const cropHeight =
    Math.round(height * 0.28);

  const x =
    Math.round(
      (width - cropWidth) / 2,
    );

  const y =
    Math.round(height * 0.08);

  const crop =
    document.createElement("canvas");

  crop.width = cropWidth;
  crop.height = cropHeight;

  const ctx = crop.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    return crop;
  }

  ctx.drawImage(
    source,
    x,
    y,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return crop;
}

function formatGeminiResult(data: GeminiOcrData) {
  return [
    `No. Nota: ${data.documentNumber ?? "-"}`,
    `Tanggal: ${data.date ?? "-"}`,
    `No. SPK: ${data.spkNumber ?? "-"}`,
    `Proses: ${data.transactionType ?? "-"}`,
    `Kode Barang: ${data.productCode ?? "-"}`,
    `Nama Barang: ${data.productName ?? "-"}`,
    `Penjahit: ${data.tailorName ?? "-"}`,
    `Employee: ${data.employeeName ?? "-"}`,
    `Quantity: ${data.quantity ?? "-"}`,
    `Satuan: ${data.unit ?? "-"}`,
  ].join("\n");
}

export default function OcrScanner({
  disabled = false,
  onResult,
}: OcrScannerProps) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const streamRef =
    useRef<MediaStream | null>(null);

  const workerRef =
    useRef<Worker | null>(null);

  const [cameras, setCameras] =
    useState<CameraDevice[]>([]);

  const [
    selectedCamera,
    setSelectedCamera,
  ] = useState("");

  const [
    cameraLoading,
    setCameraLoading,
  ] = useState(true);

  const [
    ocrLoading,
    setOcrLoading,
  ] = useState(false);

  const [
    ocrProgress,
    setOcrProgress,
  ] = useState(0);

  const [
    ocrStage,
    setOcrStage,
  ] = useState("");

  const [
    rawText,
    setRawText,
  ] = useState("");

  const [
    documentNumber,
    setDocumentNumber,
  ] = useState<string | null>(
    null,
  );

  const [error, setError] =
    useState<string | null>(null);

  const [geminiLoading, setGeminiLoading] =
    useState(false);

  const [geminiResult, setGeminiResult] =
    useState<GeminiOcrData | null>(null);

  // ============================================================
  // STOP CAMERA
  // ============================================================

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (
        const track of
        streamRef.current.getTracks()
      ) {
        track.stop();
      }

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null;
    }
  }, []);

  // ============================================================
  // START CAMERA
  // ============================================================

  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (disabled) {
        return;
      }

      try {
        setCameraLoading(true);
        setError(null);

        stopCamera();

        const videoConstraints =
          deviceId
            ? {
                deviceId: {
                  exact: deviceId,
                },
                width: {
                  ideal: 1920,
                },
                height: {
                  ideal: 1080,
                },
              }
            : {
                facingMode: {
                  ideal: "environment",
                },
                width: {
                  ideal: 1920,
                },
                height: {
                  ideal: 1080,
                },
              };

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video:
                videoConstraints,
              audio: false,
            },
          );

        streamRef.current =
          stream;

        if (videoRef.current) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current.play();
        }

        const devices =
          await navigator.mediaDevices.enumerateDevices();

        const videoDevices =
          devices
            .filter(
              (device) =>
                device.kind ===
                "videoinput",
            )
            .map(
              (
                device,
                index,
              ) => ({
                deviceId:
                  device.deviceId,
                label:
                  device.label ||
                  `Camera ${
                    index + 1
                  }`,
              }),
            );

        setCameras(
          videoDevices,
        );

        if (
          !selectedCamera &&
          videoDevices.length >
            0
        ) {
          setSelectedCamera(
            deviceId ||
              videoDevices[0]
                .deviceId,
          );
        }
      } catch (err) {
        console.error(
          "Camera error:",
          err,
        );

        setError(
          "Kamera tidak dapat diakses. Pastikan permission kamera sudah diberikan.",
        );
      } finally {
        setCameraLoading(
          false,
        );
      }
    },
    [
      disabled,
      selectedCamera,
      stopCamera,
    ],
  );

  // ============================================================
  // INITIAL CAMERA
  // ============================================================

  useEffect(() => {
    if (disabled) {
      return;
    }

    void startCamera();

    return () => {
      stopCamera();
    };
  }, [
    disabled,
    startCamera,
    stopCamera,
  ]);

  // ============================================================
  // CAMERA CHANGE
  // ============================================================

  const previousCamera =
    useRef("");

  useEffect(() => {
    if (!selectedCamera) {
      return;
    }

    if (cameraLoading) {
      return;
    }

    if (
      previousCamera.current ===
      selectedCamera
    ) {
      return;
    }

    previousCamera.current =
      selectedCamera;

    void startCamera(
      selectedCamera,
    );
  }, [
    selectedCamera,
    cameraLoading,
    startCamera,
  ]);

  // ============================================================
  // OCR WORKER
  // ============================================================

  const getWorker = useCallback(
    async () => {
      if (workerRef.current) {
        return workerRef.current;
      }

      const worker =
        await createWorker(
          ["ind", "eng"],
          1,
          {
            logger: (message) => {
              if (
                message.status ===
                "recognizing text"
              ) {
                setOcrProgress(
                  Math.round(
                    (message.progress ||
                      0) * 100,
                  ),
                );
              }
            },
          },
        );

      workerRef.current =
        worker;

      return worker;
    },
    [],
  );

  // ============================================================
  // CLEANUP WORKER
  // ============================================================

  useEffect(() => {
    return () => {
      stopCamera();

      const worker =
        workerRef.current;

      workerRef.current = null;

      if (worker) {
        void worker.terminate();
      }
    };
  }, [stopCamera]);

  // ============================================================
  // OCR SINGLE CANVAS
  // ============================================================

  const recognize = useCallback(
    async (
      worker: Worker,
      canvas: HTMLCanvasElement,
      options?: {
        whitelist?: string;
      },
    ) => {
      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SINGLE_BLOCK,

        preserve_interword_spaces:
          "1",

        user_defined_dpi:
          "300",

        ...(options?.whitelist
          ? {
              tessedit_char_whitelist:
                options.whitelist,
            }
          : {
              tessedit_char_whitelist:
                "",
            }),
      });

      const result =
        await worker.recognize(
          canvas,
        );

      return (
        result.data.text || ""
      );
    },
    [],
  );

  // ============================================================
  // OCR PROCESS
  // ============================================================

  const handleOcr =
    useCallback(async () => {
      if (
        disabled ||
        ocrLoading
      ) {
        return;
      }

      try {
        setError(null);
        setRawText("");
        setDocumentNumber(null);

        setOcrLoading(true);
        setOcrProgress(0);

        const video =
          videoRef.current;

        if (!video) {
          throw new Error(
            "Kamera belum tersedia.",
          );
        }

        // ------------------------------------------------------
        // CAPTURE
        // ------------------------------------------------------

        setOcrStage(
          "Mengambil gambar...",
        );

        const sourceCanvas =
          captureVideoFrame(
            video,
          );

        const worker =
          await getWorker();

        // ------------------------------------------------------
        // PASS 1
        // FULL PAGE ENHANCED
        // ------------------------------------------------------

        setOcrStage(
          "OCR 1/4: membaca seluruh nota...",
        );

        setOcrProgress(5);

        const fullEnhanced =
          preprocessCanvas(
            sourceCanvas,
            "enhanced",
          );

        const fullText =
          await recognize(
            worker,
            fullEnhanced,
          );

        let combinedText =
          fullText;

        let detected =
          extractDocumentNumber(
            fullText,
          );

        // ------------------------------------------------------
        // PASS 2
        // FULL PAGE BINARY
        // ------------------------------------------------------

        if (!detected) {
          setOcrStage(
            "OCR 2/4: meningkatkan kontras...",
          );

          setOcrProgress(30);

          const fullBinary =
            preprocessCanvas(
              sourceCanvas,
              "binary",
            );

          const binaryText =
            await recognize(
              worker,
              fullBinary,
            );

          combinedText +=
            "\n\n--- OCR PASS 2 ---\n\n" +
            binaryText;

          detected =
            extractDocumentNumber(
              combinedText,
            );
        }

        // ------------------------------------------------------
        // PASS 3
        // CROP AREA NO. NOTA
        // ------------------------------------------------------

        if (!detected) {
          setOcrStage(
            "OCR 3/4: fokus area nomor nota...",
          );

          setOcrProgress(55);

          const documentRegion =
            cropDocumentNumberRegion(
              sourceCanvas,
            );

          const documentEnhanced =
            preprocessCanvas(
              documentRegion,
              "enhanced",
            );

          const documentText =
            await recognize(
              worker,
              documentEnhanced,
              {
                whitelist:
                  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:./ ",
              },
            );

          combinedText +=
            "\n\n--- OCR AREA NO. NOTA ---\n\n" +
            documentText;

          detected =
            extractDocumentNumber(
              documentText,
            );
        }

        // ------------------------------------------------------
        // PASS 4
        // CROP LEBIH FOKUS
        // ------------------------------------------------------

        if (!detected) {
          setOcrStage(
            "OCR 4/4: fokus nomor dokumen...",
          );

          setOcrProgress(75);

          const topRegion =
            cropTopCenterRegion(
              sourceCanvas,
            );

          const topBinary =
            preprocessCanvas(
              topRegion,
              "binary",
            );

          const topText =
            await recognize(
              worker,
              topBinary,
              {
                whitelist:
                  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:./ ",
              },
            );

          combinedText +=
            "\n\n--- OCR FOCUS NO. NOTA ---\n\n" +
            topText;

          detected =
            extractDocumentNumber(
              topText,
            );
        }

        // ------------------------------------------------------
        // FINAL RESULT
        // ------------------------------------------------------

        setOcrProgress(100);

        setRawText(
          combinedText.trim(),
        );

        setDocumentNumber(
          detected,
        );

        setOcrStage(
          detected
            ? "Nomor dokumen ditemukan."
            : "OCR selesai, nomor belum ditemukan.",
        );

        const result: OcrResult = {
          text: combinedText.trim(),
          documentNumber:
            detected,
        };

        onResult(result);
      } catch (err) {
        console.error(
          "OCR processing error:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "OCR gagal diproses.",
        );
      } finally {
        setOcrLoading(false);
      }
    }, [
      disabled,
      ocrLoading,
      getWorker,
      recognize,
      onResult,
    ]);

  // ============================================================
  // GEMINI VISION OCR
  // ============================================================

  const handleGeminiOcr = useCallback(async () => {
    if (disabled || geminiLoading) {
      return;
    }

    try {
      setError(null);
      setGeminiLoading(true);
      setGeminiResult(null);

      const video = videoRef.current;

      if (!video) {
        throw new Error("Kamera belum tersedia.");
      }

      const canvas = captureVideoFrame(video);
      const image = canvas.toDataURL("image/jpeg", 0.9);

      const response = await fetch("/api/scanner/ai-ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ image }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Gemini OCR gagal diproses.",
        );
      }

      const data = result.data as GeminiOcrData;

      setGeminiResult(data);
      setDocumentNumber(data.documentNumber ?? null);
      setRawText(formatGeminiResult(data));

      onResult({
        text: formatGeminiResult(data),
        documentNumber: data.documentNumber ?? null,
        aiData: data,
      });
    } catch (err) {
      console.error("Gemini OCR error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Gemini OCR gagal diproses.",
      );
    } finally {
      setGeminiLoading(false);
    }
  }, [disabled, geminiLoading, onResult]);

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="space-y-4">
      {/* CAMERA */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        <div className="relative aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />

          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-white">
              Membuka kamera...
            </div>
          )}

          {!cameraLoading &&
            !ocrLoading && (
              <div className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-lg bg-black/70 px-4 py-2 text-xs font-medium text-white">
                Arahkan kamera ke seluruh
                nota
              </div>
            )}

          {ocrLoading && (
            <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded-lg bg-indigo-600/90 px-4 py-2 text-xs font-medium text-white">
              {ocrStage}
            </div>
          )}
        </div>
      </div>

      {/* CAMERA SELECT */}
      {cameras.length > 1 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Kamera
          </label>

          <select
            value={selectedCamera}
            onChange={(event) =>
              setSelectedCamera(
                event.target.value,
              )
            }
            disabled={
              disabled ||
              ocrLoading
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {cameras.map(
              (camera) => (
                <option
                  key={
                    camera.deviceId
                  }
                  value={
                    camera.deviceId
                  }
                >
                  {camera.label}
                </option>
              ),
            )}
          </select>
        </div>
      )}

      {/* OCR BUTTON */}
      <button
        type="button"
        onClick={handleOcr}
        disabled={
          disabled ||
          cameraLoading ||
          ocrLoading
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ocrLoading ? (
          <>
            <span className="animate-pulse">
              ⏳
            </span>

            Membaca Nota...
          </>
        ) : (
          <>
            📄
            Baca Nota dengan OCR
          </>
        )}
      </button>

      {/* GEMINI AI OCR BUTTON */}
      <button
        type="button"
        onClick={handleGeminiOcr}
        disabled={
          disabled ||
          cameraLoading ||
          ocrLoading ||
          geminiLoading
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {geminiLoading ? (
          <>
            <span className="animate-pulse">✨</span>
            Membaca Nota dengan Gemini AI...
          </>
        ) : (
          <>
            ✨
            Baca Nota dengan Gemini AI
          </>
        )}
      </button>

      {geminiResult && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">✨</span>
            <div>
              <div className="text-sm font-bold text-slate-800">Hasil Gemini AI</div>
              <div className="text-xs text-slate-500">Data terstruktur dari nota.</div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["No. Nota", geminiResult.documentNumber],
              ["Tanggal", geminiResult.date],
              ["SPK", geminiResult.spkNumber],
              ["Proses", geminiResult.transactionType],
              ["Barang", geminiResult.productName],
              ["Penjahit", geminiResult.tailorName],
              ["Employee", geminiResult.employeeName],
              [
                "Quantity",
                geminiResult.quantity === null
                  ? null
                  : `${geminiResult.quantity}${geminiResult.unit ? ` ${geminiResult.unit}` : ""}`,
              ],
            ] as Array<[string, string | number | null]>).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-violet-100 bg-white p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
                <div className="mt-1 text-xs font-semibold text-slate-700">{value ?? "-"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROGRESS */}
      {ocrLoading && (
        <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-indigo-700">
            <span>
              {ocrStage}
            </span>

            <span>
              {ocrProgress}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{
                width: `${ocrProgress}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="font-semibold">
            OCR gagal
          </div>

          <div className="mt-1">
            {error}
          </div>
        </div>
      )}

      {/* RESULT */}
      {rawText && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <div className="text-sm font-semibold text-slate-800">
              Hasil OCR
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Periksa hasil sebelum
              melanjutkan.
            </div>
          </div>

          {/* DOCUMENT NUMBER */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Nomor Dokumen
            </div>

            {documentNumber ? (
              <div className="mt-1 text-lg font-bold text-emerald-700">
                {documentNumber}
              </div>
            ) : (
              <div className="mt-1 text-sm font-medium text-rose-600">
                Tidak ditemukan
              </div>
            )}
          </div>

          {/* RAW TEXT */}
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Raw Text
            </div>

            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-200">
              {rawText}
            </pre>
          </div>

          {/* SUCCESS */}
          {documentNumber && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <div className="font-semibold">
                Nomor dokumen berhasil
                ditemukan.
              </div>

              <div className="mt-1">
                {documentNumber}
              </div>
            </div>
          )}

          {/* FAILED */}
          {!documentNumber && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <div className="font-semibold">
                Nomor dokumen belum
                ditemukan.
              </div>

              <div className="mt-1">
                Coba posisikan nota lebih
                dekat sehingga tulisan
                memenuhi area kamera.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}