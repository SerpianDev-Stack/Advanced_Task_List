import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

import { Request, Response, NextFunction } from "express";

interface JwtPayload {
  sub: number;
  role: string;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Token não fornecido",
    });
  }

  const [, token] = authHeader.split(" ");

  // 2️⃣ Verifica se o token existe
  if (!token) {
    return res.status(401).json({
      message: "Token inválido",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    return next();
  } catch {
    return res.status(401).json({
      message: "Token inválido ou expirado",
    });
  }
}
