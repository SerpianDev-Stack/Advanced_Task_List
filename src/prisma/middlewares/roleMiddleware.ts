import { UserRole } from "@prisma/client";
import { Request, Response, NextFunction } from "express";

export function roleMiddleware(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: "Acesso negado",
      });
    }

    next();
  };
}
