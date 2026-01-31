import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed não deve rodar em produção");
  }

  const adminEmail = "admin@email.com";

  const adminExists = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!adminExists) {
    const passwordHash = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || "admin123",
      10,
    );

    await prisma.user.create({
      data: {
        name: "Administrador",
        email: adminEmail,
        password: passwordHash,
        role: UserRole.ADMIN,
      },
    });

    console.log("✅ Usuário ADMIN criado");
  } else {
    console.log("ℹ️ Usuário ADMIN já existe");
  }
}

main()
  .catch((error) => {
    console.error("❌ Erro no seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
