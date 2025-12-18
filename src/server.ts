import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import express from "express";
import { Router } from "express";
import bcrypt from "bcrypt";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const PORT = 3000;

const app = express();
app.use(express.json());
const usersRoutes = Router();

app.use("/users", usersRoutes);

app.get("/", (req, res) => {
  return res.status(200).json({
    status: "ok",
    message: "Servidor funcionando",
  });
});

usersRoutes.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Nome, email e senha são obrigatório",
    });
  }

  try {
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      return res.status(409).json({
        message: "Email já cadastrado",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
      },
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor funcionando na porta ${PORT}`);
});
