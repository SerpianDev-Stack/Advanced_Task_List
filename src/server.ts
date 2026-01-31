import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import express from "express";
import { Router } from "express";
import bcrypt from "bcrypt";
import { authMiddleware } from "./prisma/middlewares/authMiddleware.js";
import type { Prisma } from "@prisma/client";
import { roleMiddleware } from "./prisma/middlewares/roleMiddleware.js";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET não definido");
}

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

app.use((req, _res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});

app.use("/users", usersRoutes);

usersRoutes.get(
  "/",
  authMiddleware,
  roleMiddleware([UserRole.ADMIN, UserRole.MODERATOR]),
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
        },
      });

      return res.status(200).json(users);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Erro interno no servidor",
      });
    }
  },
);

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
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

usersRoutes.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email e senha são obrigatórios",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    const accessToken = jwt.sign(
      {
        sub: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "15m",
      },
    );

    const refreshToken = randomUUID();

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.status(200).json({
      message: "Login realizado com sucesso",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

usersRoutes.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "Usuário não encontrado",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

usersRoutes.put("/me", authMiddleware, async (req, res) => {
  const userId = req.user!.id;
  const { name, email, password } = req.body;

  try {
    if (email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email },
      });

      if (emailInUse && emailInUse.id !== userId) {
        return res.status(409).json({
          message: "Email já está em uso",
        });
      }
    }

    const data: Prisma.UserUpdateInput = {};

    if (name) data.name = name;
    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return res.status(200).json({
      message: "Usuário atualizado com sucesso",
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

usersRoutes.patch(
  "/:id/promote",
  authMiddleware,
  roleMiddleware([UserRole.ADMIN]),
  async (req, res) => {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      if (user.role !== UserRole.USER) {
        return res.status(400).json({
          message: "Usuário já possui cargo elevado",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          role: UserRole.MODERATOR,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return res.status(200).json({
        message: "Usuário promovido a moderador com sucesso",
        user: updatedUser,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Erro interno no servidor",
      });
    }
  },
);

usersRoutes.patch(
  "/:id/demote",
  authMiddleware,
  roleMiddleware([UserRole.ADMIN]),
  async (req, res) => {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      if (user.role === UserRole.USER) {
        return res.status(409).json({
          message: "Usuário já é um usuário comum",
        });
      }

      if (user.role !== UserRole.MODERATOR) {
        return res.status(400).json({
          message: "Apenas moderadores podem ser rebaixados",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          role: UserRole.USER,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return res.status(200).json({
        message: "Moderador rebaixado a usuário com sucesso",
        user: updatedUser,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Erro interno no servidor",
      });
    }
  },
);

usersRoutes.delete(
  "/:id",
  authMiddleware,
  roleMiddleware([UserRole.ADMIN]),
  async (req, res) => {
    const userId = Number(req.params.id);
    const loggedUser = req.user!.id;

    if (isNaN(userId)) {
      return res.status(400).json({
        message: "ID inválido",
      });
    }

    if (userId === loggedUser) {
      return res.status(400).json({
        message: "Você não pode deletar o próprio usuário",
      });
    }

    try {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        return res.status(404).json({
          message: "Usuário não encontrado!",
        });
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      return res.status(200).json({
        message: "Usuário deletado com sucesso!",
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: "Erro Interno no servidor!",
      });
    }
  },
);

usersRoutes.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token obrigatório",
    });
  }

  try {
    const tokenInDb = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenInDb) {
      return res.status(401).json({
        message: "Refresh token inválido",
      });
    }

    if (tokenInDb.expiresAt < new Date()) {
      await prisma.refreshToken.delete({
        where: { token: refreshToken },
      });

      return res.status(401).json({
        message: "Refresh token expirado",
      });
    }

    const newAccessToken = jwt.sign(
      {
        sub: tokenInDb.user.id,
        role: tokenInDb.user.role,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "15m",
      },
    );

    return res.status(200).json({
      accessToken: newAccessToken,
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
