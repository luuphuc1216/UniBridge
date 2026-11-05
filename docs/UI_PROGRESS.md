# Tiến độ redesign UI UniBridge

## Bước 2 — Component dùng chung

- Đã làm: Thêm Button, Input, Textarea, Label, Card, Badge, Skeleton, Separator, Progress, Select, Checkbox, Dialog, Dropdown Menu, Tabs, Table, Toast và Empty State vào `src/components/ui`.
- Đã làm: Giữ nguyên API dữ liệu/handler hiện có; các primitive mới chưa thay đổi luồng nghiệp vụ.
- Chưa làm: Tích hợp toàn bộ primitive vào các màn hình hiện hữu; sẽ thực hiện ở các bước layout/module.
- Điểm bất thường: Toast dùng nền tảng `@base-ui/react` đã có trong dependency, không thêm thư viện mới.

## Bước 3 — Layout và navigation

- Đã làm: Đổi navigation dashboard sang sidebar cố định trên desktop, drawer trên mobile, topbar sticky và trạng thái active theo route.
- Đã làm: Thêm thu gọn sidebar lưu bằng localStorage; giữ nguyên các server navigation, truy vấn, reminder, notification bell và props.
- Chưa làm: Breadcrumb/menu người dùng chuyên sâu; sẽ cân nhắc trong các bước màn hình.
- Điểm bất thường: Sidebar hiện dùng chữ cái đầu khi thu gọn vì navigation chưa có metadata icon; không thêm dữ liệu điều hướng mới.

## Bước 4 — Landing và authentication

- Chưa làm.

## Bước 5 — Student Dashboard

- Chưa làm.

## Bước 6 — Business Dashboard

- Chưa làm.

## Bước 7 — Admin Dashboard

- Chưa làm.

## Bước 8 — Module nghiệp vụ

- Chưa làm.

## Bước 9 — Responsive, accessibility và rà soát

- Chưa làm.
