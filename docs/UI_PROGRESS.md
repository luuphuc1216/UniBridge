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

- Đã làm: Redesign landing với header public, hero, CTA hai vai trò, composition UI, hai phía giá trị, quy trình 8 bước, FAQ và footer.
- Đã làm: Làm rõ Prototype (Bản thử nghiệm), Triển khai có phí và cơ chế thỏa thuận; không thêm dữ liệu DB hoặc hành vi mới.
- Đã làm: Cải thiện presentation cho đăng ký, đăng nhập, quên mật khẩu và đặt lại mật khẩu; giữ nguyên route, auth flow và form component.
- Chưa làm: Chưa tích hợp dữ liệu bài toán thật vào landing vì việc thêm truy vấn sẽ vượt ranh giới UI-only.
- Điểm bất thường: FAQ dùng native `details` để không thêm logic/client state; sẽ rà soát accessibility ở Bước 9.

## Bước 5 — Student Dashboard

- Đã làm: Làm rõ hero dashboard, khu vực gợi ý và trạng thái chưa có hồ sơ nhóm.
- Đã làm: Đổi nhãn hiển thị `APPROVED` thành “đã duyệt”, thêm card hover chỉ trên thiết bị hỗ trợ hover.
- Chưa làm: Không bổ sung metric giả hoặc truy vấn mới; các số liệu khác chưa có trong dữ liệu dashboard hiện tại.

## Bước 6 — Business Dashboard

- Đã làm: Làm rõ hero, hạn mức còn lại, quản lý bài toán và CTA đăng bài toán.
- Đã làm: Giữ nguyên truy vấn credit, notification/reminder và điều kiện hiển thị hết hạn mức.
- Chưa làm: Không thêm metric giả về bài toán/dự án vì dashboard hiện chưa truy vấn các số liệu đó.

## Bước 7 — Admin Dashboard

- Đã làm: Làm rõ header quản trị, cảnh báo thanh toán mô phỏng và metric cards.
- Đã làm: Đổi nhãn hiển thị “Phí legacy 15%” thành “Phí nền tảng (dự kiến)”, giữ nguyên dữ liệu `metrics.projectFees.legacy`.
- Chưa làm: Chưa tái cấu trúc sâu các bảng Admin; phần đó nằm trong rà soát module ở Bước 8/9.

## Bước 8 — Module nghiệp vụ

- Đã làm: Cải thiện presentation cho khám phá bài toán, danh sách bài toán doanh nghiệp, biểu đồ Admin, workspace Prototype/Đề xuất giải pháp và các form/danh sách mốc công việc.
- Đã làm: Đổi các nhãn UI đã duyệt: Bài toán, Nhóm sinh viên, mốc công việc, Bản thử nghiệm (Prototype), Đề xuất giải pháp, khoản đặt cọc/hoàn tiền mô phỏng.
- Đã làm: Bỏ hiển thị cứng `15%` khỏi các màn hình giao dịch, thay bằng “phí nền tảng theo luồng cũ”; không đổi dữ liệu/enum.
- Chưa làm: Một số thông báo lỗi/action/API nội bộ vẫn dùng “Milestone”, “Proposal” hoặc “legacy”; cần rà soát riêng vì nằm trong logic/action và không tự đổi trong UI-only scope.
- Điểm bất thường: Không thêm truy vấn, server action, route hoặc field; build/lint vẫn đạt.

## Bước 9 — Responsive, accessibility và rà soát

- Chưa làm.
