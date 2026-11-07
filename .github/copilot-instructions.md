# UniBridge
Nền tảng kết nối doanh nghiệp (đăng Problem) với nhóm sinh viên.
Tài liệu gốc: docs/UniBridge.md (đọc trước khi code mỗi tính năng).

Stack: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Prisma, Auth.js.
Vai trò: BUSINESS, STUDENT, ADMIN.
Quy ước:
- Giao diện và nội dung hiển thị bằng tiếng Việt.
- Code đặt tên tiếng Anh.
- Mỗi tính năng làm xong phải chạy được và có dữ liệu seed.
- Không làm nhiều tính năng cùng lúc; hỏi lại nếu thiếu thông tin.
Tài liệu đặc tả bắt buộc đọc trước khi làm hoặc sửa tính năng liên quan:
- docs/UniBridge.md (ý tưởng và quy trình tổng thể)
- docs/ModuleKetNoi.md (đặc tả module kết nối)
- docs/ChiTietGiaoDienModuleKetNoi.md (chi tiết giao diện, luồng chọn nhóm hai bước; ưu tiên bản này khi mâu thuẫn với ModuleKetNoi.md)
- docs/ModuleGiaiPhapGiaoDich.md (Prototype, Paid Implementation, Milestone, Rating, Admin)
Khi tài liệu mâu thuẫn nhau hoặc mâu thuẫn code hiện tại, báo lại cho tôi chứ không tự quyết.
## Quy tắc thiết kế và redesign giao diện

Trước khi thực hiện bất kỳ thay đổi giao diện nào, bắt buộc đọc:
- docs/README.md: Quy định cách sử dụng tài liệu tham khảo thiết kế.
- docs/UI_REDESIGN.md: Định hướng thiết kế, màu sắc, typography và giao diện mục tiêu.
- docs/GAP_ANALYSIS.md: Những vấn đề và khoảng cách cần khắc phục.

Tài liệu tham khảo:
- docs/lumora.md
- docs/baseline.md

Chỉ tham khảo các thành phần được cho phép trong docs/README.md.
Không sao chép nguyên mẫu hoặc sử dụng lại tài nguyên của website tham khảo.

Nguyên tắc thực hiện:
- Sử dụng Next.js, Tailwind CSS và shadcn/ui theo kiến trúc hiện tại.
- Ưu tiên tái sử dụng component và design token hiện có.
- Không tạo component trùng lặp nếu đã có component tương đương.
- Không tự ý cài thêm thư viện nếu chưa có sự cần thiết.
- Không thay đổi logic nghiệp vụ khi chỉ được yêu cầu redesign giao diện.
- Không xóa chức năng, trường dữ liệu, trạng thái hoặc quyền truy cập hiện có.
- Đảm bảo giao diện responsive trên desktop, tablet và mobile.
- Đảm bảo các trạng thái loading, empty, error và success được xử lý phù hợp.
- Tuân thủ accessibility và hỗ trợ prefers-reduced-motion.

Quy trình:
1. Kiểm tra code hiện tại trước khi chỉnh sửa.
2. Xác định phạm vi file cần thay đổi.
3. Nêu phương án thực hiện trước khi thay đổi lớn.
4. Chỉ triển khai từng nhóm giao diện theo yêu cầu.
5. Chạy lint, test và build phù hợp sau khi hoàn thành.
6. Báo cáo file đã thay đổi, chức năng bị ảnh hưởng và kết quả kiểm tra.

Nếu phát hiện mâu thuẫn giữa thiết kế, đặc tả nghiệp vụ
và code hiện tại, phải dừng phần thay đổi liên quan và báo lại.
## Quy tắc sử dụng tài liệu khi redesign

- `docs/UI_REDESIGN.md` là tài liệu định hướng thiết kế chính, bắt buộc tuân thủ khi thực hiện redesign.
- `docs/GAP_ANALYSIS.md` là tài liệu tham chiếu để hiểu tình trạng triển khai hiện tại, các chức năng đã có, chưa có và những điểm khác biệt giữa đặc tả với code.
- Không được xem các chức năng còn thiếu trong GAP_ANALYSIS.md là yêu cầu triển khai trong nhiệm vụ redesign.
- Khi redesign, chỉ cải thiện cách trình bày những chức năng thực sự tồn tại trong code.
- Không tạo giao diện giả cho chức năng chưa có backend hoặc chưa được triển khai.
- Không tự ý thay đổi nghiệp vụ để làm giao diện giống với tài liệu thiết kế.
- Nếu phát hiện chức năng hiện tại khác với UI_REDESIGN.md hoặc tài liệu đặc tả, phải báo cáo và chờ xác nhận trước khi xử lý.