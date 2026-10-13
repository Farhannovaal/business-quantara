import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatNumber(value: number | string) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
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
        { status: 401 },
      );
    }

    if (!hasPermission(user, "tailor-billing.view")) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const billId = Number(id);

    if (!Number.isInteger(billId) || billId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID tagihan tidak valid.",
        },
        { status: 400 },
      );
    }

    const bill = await prisma.tailorBill.findUnique({
      where: {
        id: billId,
      },
      include: {
        tailor: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            spk: {
              select: {
                id: true,
                spkNumber: true,
              },
            },
            product: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!bill) {
      return NextResponse.json(
        {
          success: false,
          error: "Tagihan tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    if (bill.status !== "PAID" || !bill.paidAt) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invoice hanya dapat dicetak setelah tagihan berstatus PAID.",
        },
        { status: 409 },
      );
    }

    const pdf = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: 48,
          right: 48,
          bottom: 48,
          left: 48,
        },
        info: {
          Title: `Invoice ${bill.billNumber} - Overpassion`,
          Author: "Overpassion",
          Subject: "Invoice pembayaran tagihan penjahit",
          Creator: "Overpassion Tailor Billing",
        },
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer | Uint8Array) => {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
        );
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const left = 48;
      const right = pageWidth - 48;
      const contentWidth = right - left;

      const burgundy = "#7f1d1d";
      const dark = "#171717";
      const muted = "#666666";
      const light = "#e5e5e5";

      const drawTableHeader = (y: number) => {
        const headerHeight = 27;

        doc.rect(left, y, contentWidth, headerHeight).fill("#f5f5f5");

        doc.fillColor(muted).font("Helvetica-Bold").fontSize(8);

        doc.text("NO. SPK", col.spk + 7, y + 9, {
          width: 88,
        });

        doc.text("PRODUK", col.product, y + 9, {
          width: 185,
        });

        doc.text("QTY", col.qty, y + 9, {
          width: 48,
          align: "right",
        });

        doc.text("TARIF", col.rate, y + 9, {
          width: 62,
          align: "right",
        });

        doc.text("JUMLAH", col.amount, y + 9, {
          width: right - col.amount - 7,
          align: "right",
        });

        return y + headerHeight;
      };

      const col = {
        spk: left,
        product: left + 100,
        qty: left + 300,
        rate: left + 354,
        amount: left + 420,
      };

      doc.rect(0, 0, pageWidth, 10).fill(burgundy);

      doc.fillColor(burgundy).font("Helvetica-Bold").fontSize(23)
        .text("OVERPASSION", left, 44, {
          width: 260,
        });

      doc.fillColor(muted).font("Helvetica").fontSize(8)
        .text("GARMENT & PRODUCTION", left, 73);

      doc.fillColor(muted).fontSize(8)
        .text("INVOICE PEMBAYARAN PENJAHIT", left, 88);

      doc.fillColor(dark).font("Helvetica-Bold").fontSize(24)
        .text("INVOICE", 350, 46, {
          width: right - 350,
          align: "right",
        });

      doc.roundedRect(right - 86, 80, 86, 23, 5).fill("#dcfce7");

      doc.fillColor("#166534").font("Helvetica-Bold").fontSize(10)
        .text("LUNAS / PAID", right - 82, 87, {
          width: 78,
          align: "center",
        });

      doc.moveTo(left, 119)
        .lineTo(right, 119)
        .lineWidth(1)
        .strokeColor(light)
        .stroke();

      const metaTop = 137;

      doc.fillColor(muted).font("Helvetica-Bold").fontSize(8)
        .text("NOMOR INVOICE", left, metaTop);

      doc.fillColor(dark).font("Helvetica-Bold").fontSize(11)
        .text(bill.billNumber, left, metaTop + 14, {
          width: 240,
        });

      doc.fillColor(muted).font("Helvetica-Bold").fontSize(8)
        .text("TANGGAL DIBUAT", 320, metaTop);

      doc.fillColor(dark).font("Helvetica").fontSize(10)
        .text(formatDate(bill.createdAt), 320, metaTop + 14, {
          width: 230,
        });

      doc.fillColor(muted).font("Helvetica-Bold").fontSize(8)
        .text("TANGGAL PEMBAYARAN", left, metaTop + 51);

      doc.fillColor(dark).font("Helvetica").fontSize(10)
        .text(formatDate(bill.paidAt), left, metaTop + 65, {
          width: 240,
        });

      doc.fillColor(muted).font("Helvetica-Bold").fontSize(8)
        .text("DITAGIHKAN KEPADA", 320, metaTop + 51);

      doc.fillColor(dark).font("Helvetica-Bold").fontSize(11)
        .text(bill.tailor.name, 320, metaTop + 65, {
          width: 230,
        });

      let y = 258;

      doc.fillColor(dark).font("Helvetica-Bold").fontSize(12)
        .text("Rincian Tagihan", left, y);

      y += 24;
      y = drawTableHeader(y);

      for (const item of bill.items) {
        const productText = `${item.product.code} - ${item.product.name}`;

        doc.font("Helvetica").fontSize(8);

        const productHeight = doc.heightOfString(productText, {
          width: 178,
        });

        const rowHeight = Math.max(32, productHeight + 16);

        if (y + rowHeight > doc.page.height - 150) {
          doc.addPage();
          y = 48;
          y = drawTableHeader(y);
        }

        doc.moveTo(left, y + rowHeight)
          .lineTo(right, y + rowHeight)
          .lineWidth(0.5)
          .strokeColor(light)
          .stroke();

        doc.fillColor(dark).font("Helvetica").fontSize(8)
          .text(item.spk.spkNumber, col.spk + 7, y + 10, {
            width: 88,
          });

        doc.text(productText, col.product, y + 8, {
          width: 178,
          height: rowHeight - 10,
        });

        doc.text(formatNumber(Number(item.quantity)), col.qty, y + 10, {
          width: 48,
          align: "right",
        });

        doc.text(formatCurrency(Number(item.rate)), col.rate, y + 10, {
          width: 62,
          align: "right",
        });

        doc.text(
          formatCurrency(Number(item.amount)),
          col.amount,
          y + 10,
          {
            width: right - col.amount - 7,
            align: "right",
          },
        );

        y += rowHeight;
      }

      y += 22;

      if (y > doc.page.height - 130) {
        doc.addPage();
        y = 55;
      }

      const totalX = 330;
      const totalWidth = right - totalX;

      doc.fillColor(muted).font("Helvetica").fontSize(10)
        .text("Subtotal", totalX, y, {
          width: 90,
        });

      doc.fillColor(dark).font("Helvetica").fontSize(10)
        .text(
          formatCurrency(Number(bill.subtotal)),
          totalX + 100,
          y,
          {
            width: totalWidth - 100,
            align: "right",
          },
        );

      y += 24;

      doc.moveTo(totalX, y)
        .lineTo(right, y)
        .lineWidth(1)
        .strokeColor(light)
        .stroke();

      y += 12;

      doc.fillColor(dark).font("Helvetica-Bold").fontSize(11)
        .text("TOTAL DIBAYAR", totalX, y, {
          width: 150,
        });

      doc.fillColor(burgundy).font("Helvetica-Bold").fontSize(14)
        .text(
          formatCurrency(Number(bill.totalAmount)),
          totalX + 120,
          y - 2,
          {
            width: totalWidth - 120,
            align: "right",
          },
        );

      if (bill.notes) {
        y += 42;

        if (y > doc.page.height - 95) {
          doc.addPage();
          y = 55;
        }

        doc.fillColor(muted).font("Helvetica-Bold").fontSize(8)
          .text("CATATAN", left, y);

        doc.fillColor(dark).font("Helvetica").fontSize(9)
          .text(bill.notes, left, y + 13, {
            width: contentWidth,
          });
      }

      const footerY = doc.page.height - 58;

      doc.moveTo(left, footerY - 12)
        .lineTo(right, footerY - 12)
        .lineWidth(0.5)
        .strokeColor(light)
        .stroke();

      doc.fillColor(muted).font("Helvetica").fontSize(8)
        .text(
          "Dokumen ini diterbitkan otomatis oleh sistem Overpassion.",
          left,
          footerY,
          {
            width: contentWidth,
            align: "center",
          },
        );

      doc.end();
    });

    const filename = `Invoice-${safeFilename(bill.billNumber)}.pdf`;

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Generate tailor bill invoice error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal membuat invoice PDF.",
      },
      { status: 500 },
    );
  }
}