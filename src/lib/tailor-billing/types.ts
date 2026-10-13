export type BillStatus = "DRAFT" | "SUBMITTED" | "PAID" | "CANCELLED";
export type Tailor = { id: number; name: string };
export type BillingSummary = {
  spkId: number; spkNumber: string; tailorId: number; tailorName: string;
  productId: number; productCode: string; productName: string;
  totalPengiriman: number; totalPenerimaan: number; totalQcRijek: number; totalQcAcc: number;
  totalPengirimanRijek: number; totalPenerimaanRijek: number; sisaJahit: number;
  barangDiQc: number; jumlahRijek: number; jumlahBarang: number;
  totalAlreadyBilled: number; billableQuantity: number; rate: number; billableAmount: number;
};
export type BillItem = {
  id: number; spkId: number; productId: number; quantity: number | string;
  rate: number | string; amount: number | string;
  spk: { id: number; spkNumber: string };
  product: { id: number; code: string; name: string };
};
export type TailorBill = {
  id: number; billNumber: string; tailorId: number; status: BillStatus;
  subtotal: number | string; totalAmount: number | string; notes: string | null;
  paidAt: string | null; createdAt: string; updatedAt: string;
  tailor: { id: number; name: string };
  createdBy: { id: number; name: string; email: string } | null;
  items: BillItem[];
};
export type SelectedItem = { spkId: number; productId: number; quantity: number };
