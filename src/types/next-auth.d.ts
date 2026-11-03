import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    authVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    authVersion?: number;
  }
}
