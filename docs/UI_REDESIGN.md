# UNIBRIDGE: TỐI ƯU UI/UX TOÀN BỘ WEBSITE (KHÔNG THAY ĐỔI CHỨC NĂNG)

Đọc kèm: .github/copilot-instructions.md (nguyên tắc bất biến), docs/design-reference/README.md (phong cách tham khảo), và các tài liệu đặc tả trong docs/.

## 1. Vai trò và mục tiêu
Bạn là Senior Product Designer kiêm Senior Front-end Engineer. Nhiệm vụ: thiết kế lại giao diện UniBridge để người dùng có trải nghiệm tốt hơn. UniBridge là marketplace hai chiều (doanh nghiệp đăng bài toán, nhóm sinh viên đề xuất giải pháp), KHÔNG phải website tuyển dụng.
Mục tiêu: chuyên nghiệp, đáng tin cậy; hiểu ngay cách nền tảng hoạt động; giảm thao tác thừa; thông tin phân cấp rõ; nhất quán giữa Landing và Dashboard.

## 2. Ranh giới: chỉ sửa giao diện
- Không đổi: logic nghiệp vụ, Server Actions, API route, schema Prisma, migration, Auth.js, middleware, phân quyền, validation, tên trường form, đường dẫn route, id/name/data-testid, chữ ký props/hàm/hook.
- Được sửa: className, bố cục, typography, màu, spacing, icon, animation, JSX thuần trình bày, tách component trình bày.
- Giữ ranh giới Server/Client Component. Chỉ thêm "use client" ở component trình bày nhỏ khi thật cần.
- Không thêm tính năng. Phần chưa có backend: giữ nguyên, không hiển thị như đã lưu hoặc đã xử lý thành công.
- Cần đụng logic để sửa giao diện: DỪNG và hỏi.
- Không thêm thư viện lớn nếu chưa hỏi.

## 3. Quy trình bắt buộc
Bước 0 (chưa viết code): đọc dự án và báo cáo stack, cấu trúc thư mục, danh sách route theo vai trò, component dùng chung hiện có, luồng chức năng đang chạy, rủi ro. Đề xuất kế hoạch và danh sách file sẽ sửa. CHỜ TÔI XÁC NHẬN.

Sau đó làm tuần tự, dừng báo cáo sau mỗi bước:
1. Design tokens trong globals.css + cấu hình font.
2. Component dùng chung (mở rộng shadcn/ui hiện có): Button, Input, Select, Checkbox, Textarea, Card, Badge, Dialog, Dropdown, Tabs, Table, Toast, Progress, Empty State, Skeleton.
3. Layout: Header, Footer, Sidebar theo vai trò, Topbar, Breadcrumb, menu người dùng, thông báo.
4. Landing Page + Đăng ký, Đăng nhập, Quên mật khẩu.
5. Student Dashboard.
6. Business Dashboard.
7. Admin Dashboard.
8. Các module nghiệp vụ (mục 7), làm theo nhóm: (a) bài toán, (b) hồ sơ, Profile + Approach, chọn nhóm, chat, (c) Prototype, Paid Implementation, Milestone, giao dịch, đánh giá.
9. Responsive, accessibility, hiệu năng, rà soát tổng thể.

Sau mỗi bước: chạy build và lint, liệt kê file đã sửa, nêu phần chưa làm và điểm bất thường. Lỗi build/lint phải sửa trước khi sang bước tiếp.

## 4. Hệ thiết kế
Thương hiệu: UNIBRIDGE. Tagline: "Connect Ideas. Create Impact." Logo: chữ UNIBRIDGE + biểu tượng cây cầu cách điệu tối giản (SVG), rõ ở cỡ lớn và nhỏ, không linh vật.

Màu (khai báo thành token CSS, không viết cứng hex trong component):
- background #F5F8FC; card/popover #FFFFFF; foreground #172B4D; muted-foreground #64748B; border/input #E2E8F0
- primary #2563EB (chữ trên primary: trắng); destructive #DC2626
- Token mới: brand-navy #153B66, brand-light #60A5FA, success #16A34A, warning #F59E0B
- Warning chỉ làm nền badge kèm chữ tối hoặc icon. Brand-light không làm chữ nhỏ trên nền trắng.
- Không lạm dụng gradient, glassmorphism, bóng đổ nặng.

Font: Onest qua next/font/google. Kiểm tra đủ dấu tiếng Việt ("Ướ ệ ỡ ặ Ừ"). Nếu thiếu subset vietnamese hoặc lỗi dấu, dùng Be Vietnam Pro. Heading 600-700, body 400-500, button 500-600.

Hình dạng: radius 10-18px cho thành phần, 24-32px cho section lớn. Icon lucide-react. Có đủ hover, focus, active, disabled.

Cách áp dụng phong cách tham khảo:
- Section bo góc lớn, xen kẽ sáng và navy; heading lớn, letter-spacing hơi âm; eyebrow nhỏ phía trên tiêu đề.
- Nút pill; nút chính có mũi tên trong badge tròn, mũi tên dịch nhẹ khi hover.
- Danh sách quy trình/lĩnh vực dạng hàng đánh số, đường kẻ mảnh, hover đổi nền nhẹ.
- Khối số liệu nền navy, 4 cột (2 cột trên mobile).
- Card nổi nhẹ khi hover (translateY -4 đến -8px), chỉ trên thiết bị có hover.
- Reveal khi cuộn: fade + trượt lên, stagger 80-120ms, chạy một lần.
Không dùng: loader intro, smooth-scroll, root font-size theo vw, canvas/WebGL/3D, parallax, watermark khổng lồ.

## 5. Website công khai
Header sticky nền sáng: logo; Trang chủ, Khám phá bài toán, Dành cho doanh nghiệp, Dành cho sinh viên, Về UniBridge; Đăng nhập, Đăng ký; mobile dùng hamburger. Mục chưa có trang riêng thì cuộn tới section tương ứng trên trang chủ, không tạo trang rỗng, không để liên kết chết.

Các section Landing:
1. Hero: "Kết nối tri thức. Giải quyết bài toán thực tế." + subheadline: "UniBridge kết nối doanh nghiệp đang tìm kiếm giải pháp với những nhóm sinh viên có năng lực và mong muốn biến kiến thức thành giá trị thực tiễn." Hai CTA: "Tôi là doanh nghiệp" / "Tôi là sinh viên". Bên phải là composition UI mockup dựng bằng HTML/CSS (thẻ bài toán, hồ sơ nhóm, biểu tượng kết nối), không dùng ảnh stock.
2. Bài toán nổi bật: card gồm tên, doanh nghiệp, lĩnh vực, mô tả ngắn, kỹ năng, thời gian, ngân sách tham khảo, trạng thái, nút Xem chi tiết. Ưu tiên dữ liệu thật từ DB (chỉ bài toán Đã duyệt và đang mở). Nếu dùng dữ liệu seed/demo, ghi rõ "Dữ liệu demo".
3. "Một nền tảng. Hai phía giá trị.": hai khối Doanh nghiệp / Sinh viên.
4. "Từ bài toán đến giải pháp thực tế": timeline 8 bước (đăng vấn đề, kiểm duyệt, Recommendation, Profile + Approach, chọn nhóm, Prototype/Solution Proposal, Paid Implementation nếu doanh nghiệp quyết định, Milestone/nghiệm thu/đánh giá). Phân biệt trực quan giai đoạn thử nghiệm và giai đoạn trả phí.
5. "Khám phá cơ hội theo lĩnh vực của bạn": Marketing, Business & Management, Technology, UI/UX & Design, Data Analysis, Research & Development. Chỉ hiện số lượng bài toán nếu lấy từ dữ liệu thật.
6. "Minh bạch trong từng bước hợp tác": chỉ nêu cơ chế hệ thống thực sự có (kiểm duyệt, hồ sơ hai bên, thống nhất phạm vi và đầu ra, theo dõi tiến độ, lịch sử bàn giao, đánh giá hai chiều). Không quảng cáo chứng nhận hay bảo đảm chưa triển khai.
7. FAQ accordion: hoạt động thế nào; sinh viên tham gia ra sao; doanh nghiệp đăng bài có mất phí không (giai đoạn đầu đăng bài toán cơ bản miễn phí; phí nền tảng chỉ phát sinh khi chuyển sang Paid Implementation, mức phí là "dự kiến"); Profile + Approach là gì; Prototype khác Paid Implementation; thanh toán ra sao; quyền sở hữu sản phẩm (theo thỏa thuận hai bên). Không khẳng định hệ thống tự động thu/chuyển tiền nếu chưa tích hợp thanh toán.
8. CTA cuối: "Ý tưởng của bạn có thể tạo nên giá trị thực tế." với Đăng bài toán ngay / Khám phá cơ hội.
9. Footer: logo + tagline, giới thiệu, dành cho doanh nghiệp, dành cho sinh viên, hỗ trợ, điều khoản, chính sách bảo mật, liên hệ.

Authentication: Đăng ký (chọn Doanh nghiệp hoặc Sinh viên, không tự đăng ký Admin), Đăng nhập, Quên mật khẩu. Giữ đúng luồng hiện có, chỉ cải thiện giao diện.

## 6. Dashboard
Layout: Sidebar trái (thu gọn được), Topbar, Breadcrumb, nội dung, thông báo, menu người dùng. Mỗi vai trò có điều hướng riêng. Chỉ trình bày các mục đã có chức năng; mục chưa có thì không tạo trang giả.
- Sinh viên: Tổng quan, Khám phá bài toán, Bài toán đề xuất, Bài toán đã lưu, Nhóm sinh viên, Hồ sơ năng lực, Hồ sơ đã gửi, Dự án của tôi, Tin nhắn, Giao dịch, Thông báo, Cài đặt.
- Doanh nghiệp: Tổng quan, Hồ sơ doanh nghiệp, Đăng bài toán, Quản lý bài toán, Hồ sơ nhận được, Dự án đang thực hiện, Tin nhắn, Giao dịch, Thông báo, Cài đặt.
- Quản trị viên: Tổng quan, Quản lý tài khoản, Kiểm duyệt bài toán, Quản lý dự án, Giao dịch, Báo cáo và xử lý phát sinh, Thống kê. Ưu tiên bảng có tìm kiếm, lọc, phân trang, trạng thái.
Trang Tổng quan: sinh viên gồm lời chào, mức hoàn thiện hồ sơ nhóm, bài toán đề xuất, hồ sơ đã gửi, dự án đang làm, milestone sắp đến hạn, hoạt động gần đây; doanh nghiệp gồm lời chào, tổng bài toán đã đăng, bài toán đang mở, hồ sơ nhận được, dự án đang làm, milestone cần xác nhận, hoạt động gần đây.

## 7. Module nghiệp vụ (chỉ cải thiện giao diện)
Nhãn trạng thái phải nhất quán về màu và chữ, theo đúng tài liệu. Giữ nguyên giá trị enum trong Prisma, chỉ chỉnh nhãn hiển thị; báo tôi những chỗ lệch.
- Bài toán: Bản nháp, Chờ duyệt, Cần chỉnh sửa, Đã duyệt, Bị từ chối, Đã đóng.
- Hồ sơ ứng tuyển: Bản nháp, Đã gửi, Đang xem xét, Chờ xác nhận hợp tác, Được lựa chọn, Không được lựa chọn, Từ chối hợp tác, Hết hạn phản hồi, Đã rút.
- Milestone: Chưa bắt đầu, Đang thực hiện, Chờ nghiệm thu, Cần chỉnh sửa, Đã nghiệm thu, Quá hạn, Chờ xử lý quá hạn phản hồi, Tạm dừng, Có bất đồng - Chờ xử lý.

Các module:
- Khám phá và lọc bài toán: tìm kiếm, lọc lĩnh vực/kỹ năng/thời gian/ngân sách, sắp xếp; chi tiết bài toán có nút Gửi Profile + Approach (vô hiệu hóa khi bài toán đã đóng).
- Đăng bài toán: form dài chia bước, phân biệt trường bắt buộc, lưu bản nháp / gửi duyệt.
- Hồ sơ doanh nghiệp, hồ sơ nhóm: MVP gồm tên nhóm, thành viên, kỹ năng; không thêm lời mời/chuyển quyền trưởng nhóm nếu code chưa có. Hiển thị mức hoàn thiện hồ sơ.
- Gửi Profile + Approach: Profile lấy từ hồ sơ nhóm, Approach là các trường bắt buộc/không bắt buộc theo đặc tả.
- So sánh và chọn nhóm: luồng hai bước, doanh nghiệp gửi lời mời hợp tác, nhóm phải xác nhận. Không hiển thị như đã chọn xong ngay.
- Chat gắn với bài toán.
- Prototype/Solution Proposal: hồ sơ thử nghiệm, nộp sản phẩm, đánh giá (Chấp nhận / Yêu cầu chỉnh sửa / Không tiếp tục, bắt buộc có lý do).
- Paid Implementation: hiển thị phí nền tảng là "dự kiến", lấy từ cấu hình/dữ liệu, không viết cứng 15% trong giao diện. Không tự chuyển sang Paid Implementation khi Prototype được chấp nhận.
- Milestone: timeline hoặc progress tracker. Trạng thái nghiệm thu và thanh toán hiển thị tách biệt.
- Giao dịch, Rating và Reputation: Reputation chỉ hiện khi có dữ liệu đánh giá thật. Nếu chưa tích hợp cổng thanh toán, không ngụ ý đã thu hoặc chuyển tiền thành công.

## 8. Quy tắc UX
1. Người dùng luôn biết mình ở đâu; mỗi trang có một hành động chính nổi bật.
2. Không nhồi thông tin; form dài chia bước.
3. Phân biệt trường bắt buộc/không bắt buộc; lỗi hiện ngay tại trường; không mất dữ liệu khi form lỗi.
4. Có loading (skeleton), empty, success, error.
5. Thao tác quan trọng có bước xác nhận.
6. Không dùng dữ liệu giả thể hiện uy tín hay thành tích.
7. Không có nút trang trí không hoạt động; mọi thao tác có phản hồi.
8. Responsive; bảng chuyển thành card hoặc cuộn ngang hợp lý; không tràn ngang.
9. Accessibility: tương phản AA, bàn phím, focus rõ, vùng bấm tối thiểu 40px, ngữ nghĩa đúng, aria-label cho nút chỉ có icon.
10. Animation nhẹ, có mục đích, tôn trọng prefers-reduced-motion.

## 9. Tiêu chuẩn hoàn thành
- Nhận diện nhất quán giữa Landing và Dashboard.
- Mọi chức năng cũ hoạt động như trước (đăng ký, đăng nhập, đăng bài toán, kiểm duyệt, tìm kiếm, Profile + Approach, chọn nhóm, chat, milestone, đánh giá).
- Không có liên kết chết, lỗi console, lỗi build/lint mới, tràn ngang trên mobile.
- Báo cáo cuối: file đã sửa, thay đổi chính, phần chưa làm, điểm tôi cần kiểm tra bằng tay.

BẮT ĐẦU BẰNG BƯỚC 0: đọc dự án, báo cáo, chờ xác nhận. Chưa viết code.
## 10. Motion và Interaction (chi tiết)
Áp dụng cho Landing và Dashboard, theo nguyên tắc nhẹ, nhanh, có mục đích.

- Fade-up khi cuộn: chỉ dùng ở Landing, chạy một lần, stagger 80-120ms. Không dùng ở Dashboard.
- Hover card: nổi nhẹ 4-8px, chỉ trên thiết bị có hover (@media (hover: hover)).
- Button: transition màu và mũi tên 150-200ms; có trạng thái active và disabled; trạng thái loading khi đang gửi form (giữ nguyên logic hiện có, chỉ đổi cách hiển thị).
- Accordion (FAQ), Dropdown (menu người dùng), Dialog: dùng component shadcn/Radix, có animation mở/đóng nhanh (150-250ms), đóng bằng Esc, giữ focus đúng.
- Sidebar collapse: chuyển đổi mượt bằng transition width/transform. Trạng thái thu gọn lưu bằng cookie hoặc localStorage ở component client nhỏ, KHÔNG đổi logic server.
- Skeleton: dùng loading.tsx hoặc Suspense fallback cho các trang tải dữ liệu lâu. Không đổi cách truy vấn dữ liệu.
- Progress: animation thanh tiến độ (hoàn thiện hồ sơ, tiến độ dự án, milestone) bằng CSS transition.
- Cách triển khai: ưu tiên CSS transition/animation và Tailwind. Dùng IntersectionObserver trong một component client nhỏ (ví dụ Reveal) cho fade-up. Không thêm thư viện animation (framer-motion...) nếu chưa hỏi.
- Bắt buộc tôn trọng prefers-reduced-motion: tắt hoặc giảm tối đa animation.
- Không dùng: parallax, smooth-scroll, loader intro, animation lặp vô hạn, animation che nội dung quan trọng.

## 11. Responsive (chi tiết)
Breakpoint theo Tailwind (sm 640, md 768, lg 1024, xl 1280). Dùng rem chuẩn, không scale root font theo vw.

Desktop (lg trở lên)
- Sidebar cố định bên trái (thu gọn được), nội dung nhiều cột, tận dụng không gian.
- Nội dung giới hạn chiều rộng hợp lý, bảng dữ liệu hiển thị đầy đủ cột.

Tablet (md đến lg)
- Sidebar mặc định thu gọn thành icon hoặc dạng drawer.
- Grid 3-4 cột chuyển thành 2 cột. Giữ nguyên thứ tự nội dung quan trọng.

Mobile (dưới md)
- Landing: header hamburger; Dashboard: sidebar thành drawer mở bằng nút menu ở Topbar.
- Card một cột; form toàn chiều rộng; nhóm nút xếp dọc, nút chính nổi bật.
- Vùng bấm tối thiểu 40-44px; input font tối thiểu 16px để iOS không tự zoom.
- Bảng dữ liệu: chuyển thành card hoặc cuộn ngang trong container riêng, không làm cuộn ngang cả trang.
- Các màn hình phức tạp (workspace, so sánh nhóm, form nhiều bước) phải kiểm tra riêng ở 375px và 768px.
- Không có horizontal overflow ở bất kỳ trang nào.

Kiểm tra mỗi bước ở 375px, 768px, 1280px trước khi báo cáo.