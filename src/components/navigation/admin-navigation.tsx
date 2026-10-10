import { RoleNavigation } from "./role-navigation";

export function AdminNavigation() {
  return (
    <RoleNavigation
      links={[
        { href: "/admin", label: "Tổng quan" },
        { href: "/admin/problems", label: "Duyệt bài toán" },
      ]}
      title="Quản trị viên"
    />
  );
}
