import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hashPassword } from "../src/lib/auth/password";

const databaseUrl = new URL(process.env.DATABASE_URL!);

const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.replace("/", ""),
  connectionLimit: 5,
});

const prisma = new PrismaClient({
  adapter,
});

// ============================================================
// PERMISSIONS
// ============================================================

const permissions = [
  // ============================================================
  // DASHBOARD
  // ============================================================
  {
    code: "dashboard.view",
    name: "View Dashboard",
    description: "Melihat dashboard operasional",
  },

  // ============================================================
  // SPK
  // ============================================================
  {
    code: "spk.view",
    name: "View SPK",
    description: "Melihat data SPK",
  },

  {
    code: "spk.create",
    name: "Create SPK",
    description: "Membuat SPK",
  },

  {
    code: "spk.update",
    name: "Update SPK",
    description: "Mengubah SPK",
  },

  {
    code: "spk.delete",
    name: "Delete SPK",
    description: "Menghapus SPK",
  },

  // ============================================================
  // TRANSACTIONS
  // ============================================================
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
    code: "transaction.manage",
    name: "Manage Transaction Types",
    description: "Mengelola master transaction type",
  },

  // ============================================================
  // TRACKING
  // ============================================================
  {
    code: "tracking.view",
    name: "View Tracking",
    description: "Melihat production tracking",
  },

  // ============================================================
  // PRODUCTS
  // ============================================================
  {
    code: "product.view",
    name: "View Products",
    description: "Melihat master product",
  },

  {
    code: "product.manage",
    name: "Manage Products",
    description: "Mengelola master product",
  },

  // ============================================================
  // TAILORS
  // ============================================================
  {
    code: "tailor.view",
    name: "View Tailors",
    description: "Melihat master penjahit",
  },

  {
    code: "tailor.manage",
    name: "Manage Tailors",
    description: "Mengelola master penjahit",
  },

  // ============================================================
  // TAILOR RATES
  // ============================================================
  {
    code: "tailor-rate.view",
    name: "View Tailor Rates",
    description: "Melihat tarif penjahit",
  },

  {
    code: "tailor-rate.manage",
    name: "Manage Tailor Rates",
    description: "Mengelola tarif penjahit",
  },

  // ============================================================
  // TAILOR BILLING
  // ============================================================
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
    code: "tailor-billing.update",
    name: "Update Tailor Billing",
    description: "Mengubah dan mengajukan tagihan penjahit",
  },

  {
    code: "tailor-billing.pay",
    name: "Pay Tailor Billing",
    description: "Memproses pembayaran tagihan penjahit",
  },

  // ============================================================
  // EMPLOYEES
  // ============================================================
  {
    code: "employee.view",
    name: "View Employees",
    description: "Melihat master employee",
  },

  {
    code: "employee.manage",
    name: "Manage Employees",
    description: "Mengelola master employee",
  },

  // ============================================================
  // WORKFLOWS
  // ============================================================
  {
    code: "workflow.view",
    name: "View Workflows",
    description: "Melihat workflow",
  },

  {
    code: "workflow.manage",
    name: "Manage Workflows",
    description: "Mengelola workflow",
  },

  // ============================================================
  // BUSINESS RULES
  // ============================================================
  {
    code: "rule.view",
    name: "View Business Rules",
    description: "Melihat business rules",
  },

  {
    code: "rule.manage",
    name: "Manage Business Rules",
    description: "Mengelola business rules",
  },

  // ============================================================
  // USERS
  // ============================================================
  {
    code: "user.view",
    name: "View Users",
    description: "Melihat user",
  },

  {
    code: "user.manage",
    name: "Manage Users",
    description: "Mengelola user",
  },

  // ============================================================
  // ACTIVITY LOG
  // ============================================================
  {
    code: "activity.view",
    name: "View Activity Logs",
    description: "Melihat activity log",
  },

  // ============================================================
  // FIELD SCANNER
  // ============================================================
  {
    code: "scanner.view",
    name: "View Field Scanner",
    description: "View and use the field scanner",
  },

  {
    code: "scanner.create",
    name: "Process Field Scan",
    description: "Create and process scanned documents",
  },
];

// ============================================================
// MAIN SEED
// ============================================================

async function main() {
  // ============================================================
  // 1. SEED PERMISSIONS
  // ============================================================

  console.log("Seeding permissions...");

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
      },
    });
  }

  console.log(`✓ ${permissions.length} permissions`);

  // ============================================================
  // 2. SEED ADMINISTRATOR ROLE
  // ============================================================

  const administratorRole = await prisma.role.upsert({
    where: {
      name: "Administrator",
    },
    update: {
      description: "Full access to Business Operation platform",
    },
    create: {
      name: "Administrator",
      description: "Full access to Business Operation platform",
    },
  });

  console.log(`✓ Role: ${administratorRole.name}`);

  // ============================================================
  // 3. ASSIGN ALL PERMISSIONS TO ADMINISTRATOR
  // ============================================================

  const allPermissions = await prisma.permission.findMany();

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: administratorRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: administratorRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log(
    `✓ ${allPermissions.length} permissions assigned`
  );

  // ============================================================
  // 4. SEED DEVELOPMENT ADMIN USER
  // ============================================================

  const developmentPassword = "Admin123!";

  const passwordHash = await hashPassword(
    developmentPassword
  );

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@business.local",
    },
    update: {
      name: "Administrator",
      passwordHash,
      roleId: administratorRole.id,
      status: "ACTIVE",
    },
    create: {
      name: "Administrator",
      email: "admin@business.local",
      passwordHash,
      roleId: administratorRole.id,
      status: "ACTIVE",
    },
  });

  console.log(`✓ User: ${admin.email}`);

  // ============================================================
  // 5. OPERATOR ROLE
  // ============================================================

  const operatorRole = await prisma.role.upsert({
    where: {
      name: "Operator",
    },
    update: {
      description: "Operator operasional harian",
    },
    create: {
      name: "Operator",
      description: "Operator operasional harian",
    },
  });

  // ============================================================
  // OPERATOR PERMISSIONS
  // ============================================================

  const operatorPermissionCodes = [
    // Dashboard
    "dashboard.view",

    // SPK
    "spk.view",

    // Transactions
    "transaction.view",
    "transaction.create",

    // Tracking
    "tracking.view",

    // Products
    "product.view",

    // Tailors
    "tailor.view",

    // Tailor Rates
    "tailor-rate.view",

    // Tailor Billing
    "tailor-billing.view",
    "tailor-billing.create",
    "tailor-billing.update",

    // Employees
    "employee.view",

    // Scanner
    "scanner.view",
    "scanner.create",
  ];

  // ============================================================
  // ASSIGN OPERATOR PERMISSIONS
  // ============================================================

  for (const code of operatorPermissionCodes) {
    const permission = await prisma.permission.findUnique({
      where: {
        code,
      },
    });

    if (!permission) {
      throw new Error(
        `Permission tidak ditemukan: ${code}`
      );
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: operatorRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: operatorRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log(`✓ Role: ${operatorRole.name}`);

  console.log(
    `✓ ${operatorPermissionCodes.length} operator permissions assigned`
  );

  // ============================================================
  // 6. OPERATOR USER
  // ============================================================

  const operatorPasswordHash = await hashPassword(
    "Operator123!"
  );

  const operatorUser = await prisma.user.upsert({
    where: {
      email: "operator@business.local",
    },
    update: {
      name: "Operator",
      passwordHash: operatorPasswordHash,
      status: "ACTIVE",
      roleId: operatorRole.id,
    },
    create: {
      name: "Operator",
      email: "operator@business.local",
      passwordHash: operatorPasswordHash,
      status: "ACTIVE",
      roleId: operatorRole.id,
    },
  });

  console.log(`✓ User: ${operatorUser.email}`);

  // ============================================================
  // 7. DEVELOPMENT LOGIN INFORMATION
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
}

// ============================================================
// RUN SEED
// ============================================================

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });