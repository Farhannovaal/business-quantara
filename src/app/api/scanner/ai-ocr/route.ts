import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenAI,
  Type,
  ThinkingLevel,
} from "@google/genai";

import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

const MODEL = "gemini-3.8-flash";

const documentSchema = {
  type: Type.OBJECT,

  properties: {
    documentNumber: {
      type: Type.STRING,
      nullable: true,
    },

    date: {
      type: Type.STRING,
      nullable: true,
    },

    spkNumber: {
      type: Type.STRING,
      nullable: true,
    },

    transactionType: {
      type: Type.STRING,
      nullable: true,
    },

    productCode: {
      type: Type.STRING,
      nullable: true,
    },

    productName: {
      type: Type.STRING,
      nullable: true,
    },

    tailorName: {
      type: Type.STRING,
      nullable: true,
    },

    employeeName: {
      type: Type.STRING,
      nullable: true,
    },

    quantity: {
      type: Type.NUMBER,
      nullable: true,
    },

    unit: {
      type: Type.STRING,
      nullable: true,
    },
  },

  required: [
    "documentNumber",
    "date",
    "spkNumber",
    "transactionType",
    "productCode",
    "productName",
    "tailorName",
    "employeeName",
    "quantity",
    "unit",
  ],
};

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function normalizeDocumentNumber(value: unknown): string | null {
  const raw = cleanString(value);

  if (!raw) {
    return null;
  }

  const normalized = raw
    .toUpperCase()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const match = normalized.match(
    /\bNT[\s:._-]*(\d{8})[\s:._-]*(\d{5,6})\b/i,
  );

  if (match) {
    return `NT-${match[1]}-${match[2]}`;
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  // ============================================================
  // AUTH
  // ============================================================

  const auth = await requireAuth();

  if (auth.response) {
    return auth.response;
  }

  const user = auth.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  // ============================================================
  // PERMISSION
  // ============================================================

  if (!hasPermission(user, "scanner.view")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  // ============================================================
  // GEMINI API KEY
  // ============================================================

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "GEMINI_API_KEY belum dikonfigurasi di server.",
      },
      {
        status: 500,
      },
    );
  }

  try {
    // ============================================================
    // REQUEST BODY
    // ============================================================

    const body = await request.json();

    const image = body?.image;

    if (typeof image !== "string" || !image) {
      return NextResponse.json(
        {
          success: false,
          error: "Image wajib dikirim.",
        },
        {
          status: 400,
        },
      );
    }

    // ============================================================
    // VALIDATE IMAGE DATA URL
    // ============================================================

    const imageMatch = image.match(
      /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i,
    );

    if (!imageMatch) {
      return NextResponse.json(
        {
          success: false,
          error: "Format image tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    const mimeType = imageMatch[1];
    const base64Data = imageMatch[2];

    // ============================================================
    // LIMIT IMAGE SIZE
    // ============================================================

    if (base64Data.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "Ukuran gambar terlalu besar.",
        },
        {
          status: 413,
        },
      );
    }

    // ============================================================
    // GEMINI CLIENT
    // ============================================================

    const ai = new GoogleGenAI({
      apiKey,
    });

    // ============================================================
    // OCR PROMPT
    // ============================================================

    const prompt = `
Anda adalah OCR untuk membaca NOTA OPERASIONAL.

Tugas Anda adalah membaca dan mengekstrak SEMUA DATA YANG
TERCETAK DAN TERLIHAT pada gambar nota.

Jangan mengarang data.
Jangan menebak data yang tidak terlihat.
Pertahankan teks sesuai dengan yang tercetak pada nota.

==================================================
FIELD YANG HARUS DIBACA
==================================================

1. documentNumber
   Label pada nota:
   "No. Nota"

   Contoh:
   NT-20260930-00999

2. date
   Label pada nota:
   "Tanggal"

   Ambil tanggal yang tercetak pada nota.

3. spkNumber
   Label pada nota:
   "No. SPK"

   Contoh:
   SPK-003

4. transactionType
   Label pada nota:
   "Proses"

   Ambil jenis/proses transaksi yang BENAR-BENAR
   tercetak pada nota.

   Contoh:
   Penerimaan dari penjahit

   Jangan menentukan proses berdasarkan asumsi.
   Jika tulisan Proses tidak terlihat, isi null.

5. productCode
   Label pada nota:
   "Kode Barang"

   Ambil kode barang yang tercetak.

   Jika tertulis "-" maka hasilnya null.

6. productName
   Label pada nota:
   "Nama Barang"

   Ambil nama barang yang tercetak.

7. tailorName
   Label pada nota:
   "Penjahit"

   Ambil nama penjahit yang tercetak.

8. employeeName
   Label pada nota:
   "Employee"

   Ambil nama employee yang tercetak.

   Contoh:
   Raihan

9. quantity
   Label pada nota:
   "Quantity"

   Ambil jumlah barang sebagai angka.

10. unit
    Label pada nota:
    "Satuan"

    Contoh:
    pcs
    unit
    potong

==================================================
ATURAN PENTING
==================================================

1. Hanya baca data yang benar-benar terlihat pada gambar.

2. Jangan menebak data.

3. Jangan mengisi field berdasarkan konteks bisnis.

4. Jangan membuat nama employee jika tidak terlihat.

5. Jangan membuat transaction type jika tidak terlihat.

6. Jangan mengubah transaction type menjadi istilah lain.
   Pertahankan sesuai teks yang tercetak.

7. Jangan mengubah nama employee, penjahit, atau barang.

8. Quantity harus berupa angka.

9. Jika sebuah field tidak terlihat, tidak tersedia,
   atau tidak dapat dibaca dengan yakin, isi null.

10. Jika Kode Barang pada nota berisi "-", isi null.

11. documentNumber dapat dinormalisasi ke format:
    NT-YYYYMMDD-xxxxx
    jika pola tersebut terlihat jelas.

12. Jangan menambahkan field lain di luar schema.

==================================================
TUJUAN
==================================================

Hasil OCR ini akan digunakan untuk mengisi form transaksi
Business Operation.

Karena itu, akurasi teks pada nota lebih penting daripada
membuat asumsi atau melengkapi data yang tidak terlihat.
`;

    // ============================================================
    // GEMINI REQUEST
    // ============================================================

    const response = await ai.models.generateContent({
      model: MODEL,

      contents: [
        {
          role: "user",

          parts: [
            {
              text: prompt,
            },

            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],

      config: {
        responseMimeType: "application/json",
        responseSchema: documentSchema,

        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    // ============================================================
    // READ RESPONSE
    // ============================================================

    const responseText = response.text?.trim();

    if (!responseText) {
      throw new Error(
        "Gemini tidak mengembalikan hasil OCR.",
      );
    }

    // ============================================================
    // PARSE JSON
    // ============================================================

    const parsed = JSON.parse(
      responseText,
    ) as Record<string, unknown>;

    // ============================================================
    // NORMALIZE DATA
    // ============================================================

    const data = {
      documentNumber: normalizeDocumentNumber(
        parsed.documentNumber,
      ),

      date: cleanString(
        parsed.date,
      ),

      spkNumber: cleanString(
        parsed.spkNumber,
      ),

      transactionType: cleanString(
        parsed.transactionType,
      ),

      productCode: cleanString(
        parsed.productCode,
      ),

      productName: cleanString(
        parsed.productName,
      ),

      tailorName: cleanString(
        parsed.tailorName,
      ),

      employeeName: cleanString(
        parsed.employeeName,
      ),

      quantity:
        typeof parsed.quantity === "number" &&
        Number.isFinite(parsed.quantity)
          ? parsed.quantity
          : null,

      unit: cleanString(
        parsed.unit,
      ),
    };

    // ============================================================
    // SUCCESS
    // ============================================================

    return NextResponse.json({
      success: true,

      data,

      meta: {
        provider: "gemini",
        model: MODEL,
        userId: user.id,
      },
    });
  } catch (error) {
    // ============================================================
    // ERROR
    // ============================================================

    console.error(
      "Gemini AI OCR error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Gemini OCR gagal diproses.",
      },
      {
        status: 500,
      },
    );
  }
}