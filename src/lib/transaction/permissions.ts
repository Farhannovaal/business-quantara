import type { User } from "@prisma/client";

type UserWithRolePermissions = User & {
  role: {
    name: string;
    permissions: {
      permission: {
        code: string;
      };
    }[];
  } | null;
};

export const TRANSACTION_PERMISSION_MAP = {
  PENGIRIMAN_SIAP_JAHIT: "transaction.operator",
  PENERIMAAN_DARI_PENJAHIT: "transaction.operator",

  QUALITY_CONTROL: "qc.manage",
  QC_RIJEK: "qc.manage",
  QC_ACC_DIKIRIM_KE_GUDANG: "qc.manage",

  PENGIRIMAN_RIJEK: "transaction.operator",
  PENERIMAAN_RIJEK: "transaction.operator",
} as const;

export type TransactionTypeCode =
  keyof typeof TRANSACTION_PERMISSION_MAP;

export function canCreateTransactionType(
  user: UserWithRolePermissions,
  transactionType: string,
) {
  // Administrator boleh melakukan semua jenis transaksi.
  if (
    user.role?.name?.toLowerCase() ===
    "administrator"
  ) {
    return true;
  }

  const requiredPermission =
    TRANSACTION_PERMISSION_MAP[
      transactionType as TransactionTypeCode
    ];

  // Jenis transaksi tidak terdaftar
  // berarti tidak boleh dilakukan.
  if (!requiredPermission) {
    return false;
  }

  return (
    user.role?.permissions.some(
      (rolePermission) =>
        rolePermission.permission.code ===
        requiredPermission,
    ) ?? false
  );
}

export function getAllowedTransactionTypes(
  user: UserWithRolePermissions,
) {
  if (
    user.role?.name?.toLowerCase() ===
    "administrator"
  ) {
    return Object.keys(
      TRANSACTION_PERMISSION_MAP,
    );
  }

  return Object.entries(
    TRANSACTION_PERMISSION_MAP,
  )
    .filter(([, requiredPermission]) =>
      user.role?.permissions.some(
        (rolePermission) =>
          rolePermission.permission.code ===
          requiredPermission,
      ),
    )
    .map(([transactionType]) => transactionType);
}