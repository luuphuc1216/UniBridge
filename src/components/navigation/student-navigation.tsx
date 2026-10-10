import { RoleNavigation } from "./role-navigation";

export function StudentNavigation() {
  return (
    <RoleNavigation
      links={[
        { href: "/student", label: "Tổng quan" },
        { href: "/student/problems", label: "Khám phá bài toán" },
      ]}
      title="Sinh viên"
    />
  );
}
