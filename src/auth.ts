import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRole } from "@/lib/roles";
import { consumeRateLimit, isRateLimitReached } from "@/lib/rate-limit";

class LockedAccountSignin extends CredentialsSignin {
  code = "account-locked";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null;
        }

        const email = credentials.email.trim().toLowerCase();
        const rateLimited = await prisma.$transaction((transaction) =>
          isRateLimitReached(transaction, {
            scope: "login-failures",
            identifier: email,
            limit: 10,
            windowMs: 15 * 60 * 1000,
          }),
        );
        if (rateLimited) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (user?.accountStatus === "LOCKED") {
          throw new LockedAccountSignin();
        }
        if (!user || !(await compare(credentials.password, user.passwordHash))) {
          await prisma.$transaction((transaction) =>
            consumeRateLimit(transaction, {
              scope: "login-failures",
              identifier: email,
              limit: 10,
              windowMs: 15 * 60 * 1000,
            }),
          );
          return null;
        }

        if (!isRole(user.role)) {
          return null;
        }

        const loginUpdated = await prisma.user.updateMany({
          where: {
            id: user.id,
            accountStatus: "ACTIVE",
            authVersion: user.authVersion,
          },
          data: { lastLoginAt: new Date() },
        });
        if (loginUpdated.count !== 1) {
          throw new LockedAccountSignin();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authVersion: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.authVersion = user.authVersion;
      } else if (token.sub) {
        const account = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, accountStatus: true, authVersion: true },
        });
        if (
          !account ||
          account.accountStatus !== "ACTIVE" ||
          account.authVersion !== token.authVersion ||
          !isRole(account.role)
        ) {
          return null;
        }
        token.role = account.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = isRole(token.role) ? token.role : "STUDENT";
      }
      return session;
    },
  },
});
