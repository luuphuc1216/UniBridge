# UniBridge

Nền tảng kết nối doanh nghiệp với các nhóm sinh viên. Dự án sử dụng Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Auth.js và Prisma với SQLite.

## Yêu cầu

- Node.js phiên bản 20.19 trở lên.
- npm.

## Cài đặt

```bash
npm install
cp .env.example .env
```

Trước khi chạy seed, hãy đổi `SEED_USER_PASSWORD` trong `.env` thành mật khẩu phát triển riêng của bạn.

## Cơ sở dữ liệu

```bash
npm run db:migrate -- --name init
npm run db:seed
```

Seed có tính lặp lại an toàn và tạo:

- 1 tài khoản quản trị.
- 3 tài khoản doanh nghiệp cùng hồ sơ doanh nghiệp.
- 4 tài khoản sinh viên đại diện cho 4 nhóm.
- 10 Problem mẫu gắn với các doanh nghiệp.
- Bài toán mẫu ở trạng thái chờ duyệt, cần chỉnh sửa và tài liệu để kiểm thử kiểm duyệt.

Các tài khoản seed dùng chung mật khẩu được cấu hình qua `SEED_USER_PASSWORD`; mật khẩu được băm trước khi lưu.

Email đăng nhập mẫu:

- Quản trị: `admin@unibridge.local`
- Doanh nghiệp: `business1@unibridge.local`, `business2@unibridge.local`, `business3@unibridge.local`
- Sinh viên đại diện nhóm: `student1@unibridge.local` đến `student4@unibridge.local`

## Chạy ứng dụng

```bash
npm run dev
```

Mở <http://localhost:3000>. Đăng ký tài khoản Doanh nghiệp hoặc Sinh viên, hoặc đăng nhập bằng tài khoản seed.

### Kiểm thử thủ công

1. Đặt `SEED_USER_PASSWORD` trong `.env`, chạy `npm run db:seed`; tất cả tài khoản seed dùng cùng mật khẩu này.
2. Đăng nhập bằng `business1@unibridge.local` và mật khẩu seed; xác nhận trang `/business` hiển thị điều hướng Doanh nghiệp.
3. Đăng xuất, đăng nhập bằng `student1@unibridge.local`; xác nhận trang `/student` hiển thị điều hướng Sinh viên.
4. Đăng xuất, đăng nhập bằng `admin@unibridge.local`; xác nhận trang `/admin` hiển thị điều hướng Quản trị viên.
5. Khi đã đăng xuất, truy cập trực tiếp `/business`, `/student` và `/admin`; mỗi đường dẫn phải chuyển đến `/dang-nhap`. Sau khi đăng nhập, chuyển hướng về đường dẫn được yêu cầu nếu đúng vai trò.
6. Đăng nhập với một vai trò rồi thử vào khu vực của vai trò khác; phải được chuyển về dashboard của chính mình.
7. Tạo lần lượt tài khoản mới với vai trò Doanh nghiệp và Sinh viên; xác nhận mỗi tài khoản vào đúng dashboard. Thử đăng ký lại cùng email và xác nhận có thông báo email đã được sử dụng.
8. Xác nhận form đăng ký chỉ cho chọn Doanh nghiệp hoặc Sinh viên, không có lựa chọn Admin.
9. Đăng nhập với `admin@unibridge.local`, mở `/admin/problems` và xác nhận bài toán mẫu đang chờ duyệt xuất hiện. Mở chi tiết, kiểm tra đủ thông tin doanh nghiệp và 8 trường bài toán; tải `Du-lieu-kiem-duyet.csv`.
10. Thử duyệt khi chưa chọn đủ 6 mục và xác nhận hệ thống từ chối. Chọn đủ 6 mục, bấm “Duyệt”; bài toán phải chuyển sang `APPROVED` và biến mất khỏi danh sách mặc định.
11. Đăng nhập với `student1@unibridge.local`, mở `/student/problems` và xác nhận bài vừa duyệt xuất hiện; mở chi tiết và tải tài liệu đính kèm.
12. Gửi một bài toán khác đang chờ duyệt về chỉnh sửa với lý do để xác nhận trường hợp thiếu lý do bị từ chối. Nhập lý do hợp lệ, gửi lại yêu cầu; đăng nhập doanh nghiệp sở hữu bài toán, mở chuông thông báo và xác nhận lý do hiển thị cả trong thông báo lẫn trang chi tiết. Mở thông báo để xác nhận nó được đánh dấu đã đọc.
13. Thử gửi action kiểm duyệt khi không đăng nhập Admin; máy chủ phải từ chối thao tác.

## Lệnh hữu ích

- `npm run lint`: kiểm tra ESLint.
- `npm run build`: kiểm tra build Next.js.
- `npm run db:generate`: sinh Prisma Client.
- `npm run db:studio`: mở Prisma Studio.
