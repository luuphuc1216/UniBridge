import { RoleNavigation } from "./role-navigation";

export function BusinessNavigation() {
  return (
    <RoleNavigation
      links={[
        { href: "/business", label: "Tổng quan" },
        { href: "/business/problems", label: "Bài toán của tôi" },
      ]}
      title="Doanh nghiệp"
    />
  );
}
