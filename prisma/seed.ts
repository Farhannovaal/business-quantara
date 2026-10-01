import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const url = new URL(databaseUrl);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace("/", ""),
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding permissions...");

  // ============================================================
  // PERMISSIONS
  // ============================================================

  const permissions = [
    // ----------------------------------------------------------
    // DASHBOARD
    // ----------------------------------------------------------
    {
      code: "dashboard.view",
      name: "View Dashboard",
      description: "Melihat dashboard",
    },

    // ----------------------------------------------------------
    // SPK
    // ----------------------------------------------------------
    {
      code: "spk.view",
      name: "View SPK",
      description: "Melihat SPK",
    },
    {
      code: "spk.create",
      name: "Create SPK",
      description: "Membuat SPK",
    },
    {
      code: "spk.edit",
      name: "Edit SPK",
      description: "Mengubah SPK",
    },
    {
      code: "spk.delete",
      name: "Delete SPK",
      description: "Menghapus SPK",
    },

    // ----------------------------------------------------------
    // TRANSACTION
    // ----------------------------------------------------------
    {
      code: "transaction.view",
      name: "View Transactions",
      description: "Melihat transaksi",
    },
    {
      code: "transaction.create",
      name: "Create Transaction",
      description: "Membuat transaksi",
    },
    {
      code: "transaction.edit",
      name: "Edit Transaction",
      description: "Mengubah transaksi",
    },
    {
      code: "transaction.delete",
      name: "Delete Transaction",
      description: "Menghapus transaksi",
    },

    // ----------------------------------------------------------
    // TRACKING
    // ----------------------------------------------------------
    {
      code: "tracking.view",
      name: "View Tracking",
      description: "Melihat tracking SPK",
    },

    // ----------------------------------------------------------
    // PRODUCT
    // ----------------------------------------------------------
    {
      code: "product.view",
      name: "View Products",
      description: "Melihat produk",
    },
    {
      code: "product.create",
      name: "Create Product",
      description: "Membuat produk",
    },
    {
      code: "product.edit",
      name: "Edit Product",
      description: "Mengubah produk",
    },
    {
      code: "product.delete",
      name: "Delete Product",
      description: "Menghapus produk",
    },

    // ----------------------------------------------------------
    // TAILOR
    // ----------------------------------------------------------
    {
      code: "tailor.view",
      name: "View Tailors",
      description: "Melihat penjahit",
    },
    {
      code: "tailor.create",
      name: "Create Tailor",
      description: "Membuat penjahit",
    },
    {
      code: "tailor.edit",
      name: "Edit Tailor",
      description: "Mengubah penjahit",
    },
    {
      code: "tailor.delete",
      name: "Delete Tailor",
      description: "Menghapus penjahit",
    },

    // ----------------------------------------------------------
    // EMPLOYEE
    // ----------------------------------------------------------
    {
      code: "employee.view",
      name: "View Employees",
      description: "Melihat karyawan",
    },
    {
      code: "employee.create",
      name: "Create Employee",
      description: "Membuat karyawan",
    },
    {
      code: "employee.edit",
      name: "Edit Employee",
      description: "Mengubah karyawan",
    },
    {
      code: "employee.delete",
      name: "Delete Employee",
      description: "Menghapus karyawan",
    },

    // ----------------------------------------------------------
    // SCANNER
    // ----------------------------------------------------------
    {
      code: "scanner.view",
      name: "View Scanner",
      description: "Melihat field scanner",
    },
    {
      code: "scanner.create",
      name: "Create Scanner Transaction",
      description: "Membuat transaksi melalui scanner",
    },

    // ----------------------------------------------------------
    // WORKFLOW
    // ----------------------------------------------------------
    {
      code: "workflow.view",
      name: "View Workflows",
      description: "Melihat workflow",
    },
    {
      code: "workflow.create",
      name: "Create Workflow",
      description: "Membuat workflow",
    },
    {
      code: "workflow.edit",
      name: "Edit Workflow",
      description: "Mengubah workflow",
    },
    {
      code: "workflow.delete",
      name: "Delete Workflow",
      description: "Menghapus workflow",
    },

    // ----------------------------------------------------------
    // BUSINESS RULE
    // ----------------------------------------------------------
    {
      code: "rule.view",
      name: "View Business Rules",
      description: "Melihat business rules",
    },
    {
      code: "rule.create",
      name: "Create Business Rule",
      description: "Membuat business rule",
    },
    {
      code: "rule.edit",
      name: "Edit Business Rule",
      description: "Mengubah business rule",
    },
    {
      code: "rule.delete",
      name: "Delete Business Rule",
      description: "Menghapus business rule",
    },

    // ----------------------------------------------------------
    // TAILOR RATE
    // ----------------------------------------------------------
    {
      code: "tailor-rate.view",
      name: "View Tailor Rates",
      description: "Melihat tarif penjahit",
    },
    {
      code: "tailor-rate.create",
      name: "Create Tailor Rate",
      description: "Membuat tarif penjahit",
    },
    {
      code: "tailor-rate.edit",
      name: "Edit Tailor Rate",
      description: "Mengubah tarif penjahit",
    },
    {
      code: "tailor-rate.delete",
      name: "Delete Tailor Rate",
      description: "Menghapus tarif penjahit",
    },

    // ----------------------------------------------------------
    // TAILOR BILLING
    // ----------------------------------------------------------
    {
      code: "tailor-billing.view",
      name: "View Tailor Billing",
      description: "Melihat tagihan penjahit",
    },
    {
      code: "tailor-billing.create",
      name: "Create Tailor Billing",
      description: "Membuat tagihan penjahit",
    },
    {
      code: "tailor-billing.submit",
      name: "Submit Tailor Billing",
      description: "Submit tagihan penjahit",
    },
    {
      code: "tailor-billing.pay",
      name: "Pay Tailor Billing",
      description: "Membayar tagihan penjahit",
    },
    {
      code: "tailor-billing.cancel",
      name: "Cancel Tailor Billing",
      description: "Membatalkan tagihan penjahit",
    },
    {
      code: "transaction.operator",
      name: "Operate Production Transactions",
      description:
        "Melakukan transaksi operasional produksi dan rework",
    },

    // ----------------------------------------------------------
    // QUALITY CONTROL
    // ----------------------------------------------------------
    {
      code: "qc.view",
      name: "View Quality Control",
      description: "Melihat monitoring Quality Control",
    },
    {
      code: "qc.manage",
      name: "Manage Quality Control",
      description: "Mengelola proses Quality Control",
    },
  ];

  // ============================================================
  // UPSERT PERMISSIONS
  // ============================================================

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: permission,
    });
  }

  console.log(`✓ ${permissions.length} permissions`);

  // ============================================================
  // ADMINISTRATOR ROLE
  // ============================================================

  const administratorRole = await prisma.role.upsert({
    where: {
      name: "Administrator",
    },
    update: {},
    create: {
      name: "Administrator",
      description: "Full access to Business Operation",
    },
  });

  console.log("✓ Role: Administrator");

  // Administrator mendapatkan SEMUA permission
  const allPermissions = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
    },
  });

  // Hapus mapping lama agar selalu sinkron
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: administratorRole.id,
    },
  });

  if (allPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: allPermissions.map((permission) => ({
        roleId: administratorRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `✓ ${allPermissions.length} permissions assigned`,
  );

  // ============================================================
  // OPERATOR ROLE
  // ============================================================

  const operatorRole = await prisma.role.upsert({
    where: {
      name: "Operator",
    },
    update: {},
    create: {
      name: "Operator",
      description: "Operational user",
    },
  });

  console.log("✓ Role: Operator");

  const operatorPermissionCodes = [
    "dashboard.view",

    "spk.view",

    "transaction.view",
    "transaction.create",
    "transaction.operator",

    "tracking.view",

    "product.view",

    "tailor.view",

    "employee.view",

    "scanner.view",
    "scanner.create",

    "tailor-rate.view",

    "tailor-billing.view",
    "tailor-billing.create",
  ];

  const operatorPermissions =
    await prisma.permission.findMany({
      where: {
        code: {
          in: operatorPermissionCodes,
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

  // Sinkronisasi permission Operator
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: operatorRole.id,
    },
  });

  if (operatorPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: operatorPermissions.map((permission) => ({
        roleId: operatorRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `✓ ${operatorPermissions.length} operator permissions assigned`,
  );

  // ============================================================
  // QC ROLE
  // ============================================================

  const qcRole = await prisma.role.upsert({
    where: {
      name: "QC",
    },
    update: {},
    create: {
      name: "QC",
      description: "Quality Control user",
    },
  });

  console.log("✓ Role: QC");

  const qcPermissionCodes = [
    "qc.view",
    "qc.manage",
  ];

  const qcPermissions =
    await prisma.permission.findMany({
      where: {
        code: {
          in: qcPermissionCodes,
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

  // Sinkronisasi permission QC
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: qcRole.id,
    },
  });

  if (qcPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: qcPermissions.map((permission) => ({
        roleId: qcRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `✓ ${qcPermissions.length} QC permissions assigned`,
  );

  // ============================================================
  // PASSWORDS
  // ============================================================

  const adminPassword = await bcrypt.hash(
    "Admin123!",
    10,
  );

  const operatorPassword = await bcrypt.hash(
    "Operator123!",
    10,
  );

  const qcPassword = await bcrypt.hash(
    "Qc123456!",
    10,
  );

  // ============================================================
  // ADMIN USER
  // ============================================================

  await prisma.user.upsert({
    where: {
      email: "admin@business.local",
    },
    update: {
      name: "Administrator",
      roleId: administratorRole.id,
      status: "ACTIVE",
      passwordHash: adminPassword,
    },
    create: {
      name: "Administrator",
      email: "admin@business.local",
      passwordHash: adminPassword,
      roleId: administratorRole.id,
      status: "ACTIVE",
    },
  });

  console.log("✓ User: admin@business.local");

  // ============================================================
  // OPERATOR USER
  // ============================================================

  await prisma.user.upsert({
    where: {
      email: "operator@business.local",
    },
    update: {
      name: "Operator",
      roleId: operatorRole.id,
      status: "ACTIVE",
      passwordHash: operatorPassword,
    },
    create: {
      name: "Operator",
      email: "operator@business.local",
      passwordHash: operatorPassword,
      roleId: operatorRole.id,
      status: "ACTIVE",
    },
  });

  console.log("✓ User: operator@business.local");

  // ============================================================
  // QC USER
  // ============================================================

  await prisma.user.upsert({
    where: {
      email: "qc@business.local",
    },
    update: {
      name: "QC",
      roleId: qcRole.id,
      status: "ACTIVE",
      passwordHash: qcPassword,
    },
    create: {
      name: "QC",
      email: "qc@business.local",
      passwordHash: qcPassword,
      roleId: qcRole.id,
      status: "ACTIVE",
    },
  });

  console.log("✓ User: qc@business.local");

  // ============================================================
  // DEVELOPMENT ACCOUNTS
  // ============================================================

  console.log("");
  console.log("Development accounts:");
  console.log("");

  console.log("Administrator:");
  console.log("Email: admin@business.local");
  console.log("Password: Admin123!");
  console.log("");

  console.log("Operator:");
  console.log("Email: operator@business.local");
  console.log("Password: Operator123!");
  console.log("");

  console.log("QC:");
  console.log("Email: qc@business.local");
  console.log("Password: Qc123456!");
  console.log("");
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });