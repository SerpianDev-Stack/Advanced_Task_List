import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import express from "express";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const PORT = 3000;

const app = express();

app.get("/", (req, res) => {
  return res.status(200).json({
    status: "ok",
    message: "Servidor funcionando",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor funcionando na porta ${PORT}`);
});
