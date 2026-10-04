export type QCStatus =
  | "WAITING"
  | "IN_PROGRESS"
  | "COMPLETED";

export type QCItem = {
  spkId: number;
  spkNumber: string;

  productId: number;

  product: {
    id: number;
    code: string;
    name: string;
  };

  tailor: {
    id: number;
    name: string;
  };

  totalDiterima: number;
  totalSudahQC: number;
  totalAcc: number;
  totalRijek: number;
  sisaQC: number;

  progressPercentage: number;

  status: QCStatus;

  lastQC: {
    transactionNumber: string;
    quantity: number;
    employee: string;
    createdAt: string;
  } | null;
};

export type QCSummary = {
  totalDiterima: number;
  totalSudahQC: number;
  totalAcc: number;
  totalRijek: number;
  sisaQC: number;

  waiting: number;
  inProgress: number;
  completed: number;
};

export type QCResponse = {
  success: boolean;
  data: {
    summary: QCSummary;
    items: QCItem[];
  };
  error?: string;
};

export type StatusFilter =
  | "ALL"
  | "WAITING"
  | "IN_PROGRESS"
  | "COMPLETED";

export type QCTimelineItem = {
  id: number;
  transactionNumber: string;
  type: string;
  typeName: string;
  quantity: number;
  employee: string;
  createdAt: string;
};