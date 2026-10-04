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
  transactions: SPKTransactionForStatus[],
  spkQuantity?: number,
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
    0,
  );

  // Barang yang kembali dari proses rijek
  // masuk kembali ke antrean QC.
  const barangDiQc = Math.max(
    totalPenerimaan +
      totalPenerimaanRijek -
      totalQcRijek -
      totalQcAcc,
    0,
  );

  // Barang yang saat ini masih berada
  // di penjahit untuk proses rework.
  const jumlahRijek = Math.max(
    totalPengirimanRijek -
      totalPenerimaanRijek,
    0,
  );

  const jumlahBarang =
    sisaJahit +
    barangDiQc +
    jumlahRijek;

  const nextTransactionTypes: string[] = [];

  /*
   * Pengiriman Siap Jahit dapat dilakukan
   * berkali-kali selama total pengiriman
   * belum mencapai Qty SPK produk.
   */
  if (
    spkQuantity !== undefined &&
    totalPengiriman < spkQuantity
  ) {
    nextTransactionTypes.push(
      "PENGIRIMAN_SIAP_JAHIT",
    );
  }

  /*
   * Barang yang sudah dikirim tetapi
   * belum diterima penjahit.
   */
  if (sisaJahit > 0) {
    nextTransactionTypes.push(
      "PENERIMAAN_DARI_PENJAHIT",
    );
  }

  /*
   * Barang yang tersedia untuk proses QC.
   *
   * Ini termasuk barang normal yang baru
   * diterima dari penjahit dan barang rijek
   * yang sudah kembali dari proses rework.
   */
  if (barangDiQc > 0) {
    nextTransactionTypes.push(
      "QUALITY_CONTROL",
    );

    nextTransactionTypes.push(
      "QC_RIJEK",
    );

    nextTransactionTypes.push(
      "QC_ACC_DIKIRIM_KE_GUDANG",
    );
  }

  /*
   * Barang rijek yang sudah selesai QC
   * tetapi belum dikirim kembali ke penjahit.
   *
   * Yang tersedia untuk dikirim adalah:
   *
   * total QC Rijek
   * - total Pengiriman Rijek
   */
  const rijekBelumDikirim = Math.max(
    totalQcRijek -
      totalPengirimanRijek,
    0,
  );

  if (rijekBelumDikirim > 0) {
    nextTransactionTypes.push(
      "PENGIRIMAN_RIJEK",
    );
  }

  /*
   * Barang rijek yang sudah dikirim
   * tetapi belum diterima kembali.
   */
  if (
    totalPengirimanRijek >
    totalPenerimaanRijek
  ) {
    nextTransactionTypes.push(
      "PENERIMAAN_RIJEK",
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