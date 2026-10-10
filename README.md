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

Các tài khoản seed dùng chung mật khẩu được cấu hình qua `SEED_USER_PASSWORD`; mật khẩu được băm trước khi lưu.

Email đăng nhập mẫu:

- Quản trị: `admin@unibridge.local`
- Doanh nghiệp: `business1@unibridge.local`, `business2@unibridge.local`, `business3@unibridge.local`
- Sinh viên đại diện nhóm: `student1@unibridge.local` đến `student4@unibridge.local`

## Chạy ứng dụng

```bash
npm run dev
```

Mở <http://localhost:3000>. Giao diện sản phẩm chưa được triển khai.

## Lệnh hữu ích

- `npm run lint`: kiểm tra ESLint.
- `npm run build`: kiểm tra build Next.js.
- `npm run db:generate`: sinh Prisma Client.
- `npm run db:studio`: mở Prisma Studio.
