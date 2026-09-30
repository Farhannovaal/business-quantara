export type SPKTransactionForStatus = {
  quantity: number;
  transactionType: {
    code: string;
  };
};

export type SPKStatusSummary = {
  totalPengiriman: number;
  totalPenerimaan: number;
  totalQcRijek: number;
  totalQcAcc: number;
  totalPengirimanRijek: number;
  totalPenerimaanRijek: number;

  sisaJahit: number;
  barangDiQc: number;
  jumlahRijek: number;
  jumlahBarang: number;

  nextTransactionTypes: string[];
};

export function calculateSPKStatus(
  transactions: SPKTransactionForStatus[]
): SPKStatusSummary {
  let totalPengiriman = 0;
  let totalPenerimaan = 0;
  let totalQcRijek = 0;
  let totalQcAcc = 0;
  let totalPengirimanRijek = 0;
  let totalPenerimaanRijek = 0;

  for (const transaction of transactions) {
    const quantity = Number(transaction.quantity) || 0;
    const code = transaction.transactionType.code;

    switch (code) {
      case "PENGIRIMAN_SIAP_JAHIT":
        totalPengiriman += quantity;
        break;

      case "PENERIMAAN_DARI_PENJAHIT":
        totalPenerimaan += quantity;
        break;

      case "QC_RIJEK":
        totalQcRijek += quantity;
        break;

      case "QC_ACC_DIKIRIM_KE_GUDANG":
        totalQcAcc += quantity;
        break;

      case "PENGIRIMAN_RIJEK":
        totalPengirimanRijek += quantity;
        break;

      case "PENERIMAAN_RIJEK":
        totalPenerimaanRijek += quantity;
        break;
    }
  }

  const sisaJahit = Math.max(
    totalPengiriman - totalPenerimaan,
    0
  );

  const barangDiQc = Math.max(
    totalPenerimaan - totalQcRijek - totalQcAcc,
    0
  );

  const jumlahRijek = Math.max(
    totalPengirimanRijek - totalPenerimaanRijek,
    0
  );

  const jumlahBarang =
    sisaJahit +
    barangDiQc +
    jumlahRijek;

  const nextTransactionTypes: string[] = [];

  if (totalPengiriman === 0) {
    nextTransactionTypes.push(
      "PENGIRIMAN_SIAP_JAHIT"
    );
  }

  if (sisaJahit > 0) {
    nextTransactionTypes.push(
      "PENERIMAAN_DARI_PENJAHIT"
    );
  }

  if (barangDiQc > 0) {
    nextTransactionTypes.push(
      "QUALITY_CONTROL"
    );

    nextTransactionTypes.push(
      "QC_RIJEK"
    );

    nextTransactionTypes.push(
      "QC_ACC_DIKIRIM_KE_GUDANG"
    );
  }

  if (totalQcRijek > totalPengirimanRijek) {
    nextTransactionTypes.push(
      "PENGIRIMAN_RIJEK"
    );
  }

  if (totalPengirimanRijek > totalPenerimaanRijek) {
    nextTransactionTypes.push(
      "PENERIMAAN_RIJEK"
    );
  }

  return {
    totalPengiriman,
    totalPenerimaan,
    totalQcRijek,
    totalQcAcc,
    totalPengirimanRijek,
    totalPenerimaanRijek,
    sisaJahit,
    barangDiQc,
    jumlahRijek,
    jumlahBarang,
    nextTransactionTypes,
  };
}