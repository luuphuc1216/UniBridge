# UniBridge
Nền tảng kết nối doanh nghiệp (đăng Problem) với nhóm sinh viên.
Tài liệu gốc: docs/UniBridge.md (đọc trước khi code mỗi tính năng).

Stack: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Prisma, Auth.js.
Vai trò: BUSINESS, STUDENT, ADMIN.

## Quy ước chung
- Giao diện và nội dung hiển thị bằng tiếng Việt.
- Code đặt tên tiếng Anh.
- Mỗi tính năng làm xong phải chạy được và có dữ liệu seed.
- Không làm nhiều tính năng cùng lúc; hỏi lại nếu thiếu thông tin.

## Tài liệu đặc tả bắt buộc đọc trước khi làm hoặc sửa tính năng liên quan
- docs/UniBridge.md (ý tưởng và quy trình tổng thể)
- docs/ModuleKetNoi.md (đặc tả module kết nối)
- docs/ChiTietGiaoDienModuleKetNoi.md (chi tiết giao diện, luồng chọn nhóm hai bước; ưu tiên bản này khi mâu thuẫn với ModuleKetNoi.md)
- docs/ModuleGiaiPhapGiaoDich.md (Prototype, Paid Implementation, Milestone, Rating, Admin)
Khi tài liệu mâu thuẫn nhau hoặc mâu thuẫn code hiện tại, báo lại cho tôi chứ không tự quyết.

## Phạm vi thư mục
- Bỏ qua thư mục "án lớn" (tài liệu của dự án khác, không liên quan UniBridge).
- docs/design-reference/ chỉ để tham khảo phong cách. Không import, không copy nguyên code, không dùng lại ảnh, URL, nội dung hay tên thương hiệu của các file mẫu. Đọc docs/design-reference/README.md để biết phần nào được tham khảo.

## Chế độ tối ưu UI/UX (áp dụng khi tôi yêu cầu chỉnh giao diện)
Đây là ngoại lệ cho quy tắc "không làm nhiều tính năng cùng lúc": được sửa giao diện nhiều trang, nhưng phải làm tuần tự và dừng báo cáo sau mỗi bước.

Nguyên tắc bất biến: CHỈ SỬA GIAO DIỆN, KHÔNG SỬA CHỨC NĂNG.
- Không đổi: logic nghiệp vụ, Server Actions, API route, schema Prisma, migration, Auth.js, middleware, phân quyền, validation (schema zod nếu có), tên trường form, đường dẫn route.
- Không đổi tên, xóa hoặc đổi chữ ký của props, hàm, hook, handler đang dùng. Không đổi id, name, data-testid.
- Được sửa: className, bố cục, typography, màu, spacing, icon, animation, cấu trúc JSX thuần trình bày, tách component trình bày.
- Giữ ranh giới Server Component / Client Component hiện có. Chỉ thêm "use client" khi thật sự cần cho hiệu ứng, và chỉ ở component trình bày nhỏ.
- Không thêm tính năng mới. Phần chưa có backend thì giữ nguyên hiện trạng, không hiển thị như đã lưu hoặc xử lý thành công.
- Nếu một thay đổi giao diện buộc phải đụng vào logic: DỪNG LẠI và hỏi tôi.
- Nhãn trạng thái: giữ nguyên giá trị enum trong Prisma, chỉ chỉnh nhãn hiển thị tiếng Việt cho khớp tài liệu. Báo tôi những chỗ lệch.
- Sau mỗi bước: chạy build và lint, liệt kê file đã sửa, nêu phần chưa làm.

Hệ thiết kế (khai báo trong globals.css theo đúng định dạng đang dùng, dùng token, KHÔNG viết cứng mã hex trong component):
- background #F5F8FC; card/popover #FFFFFF; foreground #172B4D; muted-foreground #64748B; border/input #E2E8F0.
- primary #2563EB (chữ trên primary là trắng); destructive #DC2626.
- Token thêm: brand-navy #153B66 (sidebar, section tối, footer), brand-light #60A5FA, success #16A34A, warning #F59E0B.
- Warning chỉ dùng làm nền badge kèm chữ tối hoặc làm icon, không dùng làm chữ trên nền trắng. Brand-light không dùng làm chữ nhỏ trên nền trắng.
- Không lạm dụng gradient, glassmorphism, bóng đổ nặng.
- Font: Onest qua next/font/google. Kiểm tra hiển thị đủ dấu tiếng Việt (thử "Ướ ệ ỡ ặ Ừ"). Nếu không có subset vietnamese hoặc lỗi dấu, dùng Be Vietnam Pro.
- Radius 10-18px cho thành phần, 24-32px cho section lớn. Icon dùng lucide-react.
- Ưu tiên tái sử dụng component shadcn/ui hiện có, mở rộng thay vì viết lại.
- Dashboard dùng rem chuẩn, không loader intro, không smooth-scroll, không canvas/WebGL/parallax.
- Animation nhẹ (fade-up, hover card, accordion, modal), tôn trọng prefers-reduced-motion.
- Accessibility: tương phản AA, điều hướng bàn phím, focus rõ, vùng bấm tối thiểu 40px, aria-label cho nút chỉ có icon.
- Responsive desktop/tablet/mobile, không tràn ngang.