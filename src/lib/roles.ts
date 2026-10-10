export const roles = ["BUSINESS", "STUDENT", "ADMIN"] as const;

export type Role = (typeof roles)[number];
export type SelfRegistrationRole = Exclude<Role, "ADMIN">;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export function getRoleHome(role: Role): string {
  switch (role) {
    case "BUSINESS":
      return "/business";
    case "STUDENT":
      return "/student";
    case "ADMIN":
      return "/admin";
  }
}
