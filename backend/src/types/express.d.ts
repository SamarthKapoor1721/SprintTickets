import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        role: UserRole;
        email: string;
        fullName: string | null;
      };
    }
  }
}

export {};
