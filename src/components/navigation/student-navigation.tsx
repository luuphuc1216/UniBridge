import { RoleNavigation } from "./role-navigation";

export function StudentNavigation() {
  return (
    <RoleNavigation
      links={[
        { href: "/student", label: "Tổng quan" },
        { href: "/student/problems", label: "Khám phá bài toán" },
        { href: "/student/saved-problems", label: "Bài toán đã lưu" },
        { href: "/student/team", label: "Hồ sơ nhóm" },
        { href: "/student/applications", label: "Hồ sơ đã gửi" },
      ]}
      title="Sinh viên"
    />
  );
}
