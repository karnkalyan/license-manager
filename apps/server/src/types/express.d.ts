import type { UserRole } from '../generated/prisma/enums.js';

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; username: string; role: UserRole };
      requestId?: string;
    }
  }
}
export {};
