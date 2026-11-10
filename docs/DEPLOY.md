# Triển khai UniBridge

## Yêu cầu máy chủ

- Node.js major 24, theo `.nvmrc`; npm 11.19.0, theo trường `packageManager` trong `package.json`.
- Cài `build-essential` và `python3`. `better-sqlite3` thường tải binary phù hợp qua `prebuild-install`; nếu không tải được, quá trình cài đặt fallback sang `node-gyp rebuild` và cần toolchain native.
- Dùng `npm ci` để cài đúng dependency đã khóa. Không dùng `--ignore-scripts`: thiếu install script có thể khiến `better-sqlite3` không có native binding và ứng dụng không mở được database.

## Lưu trữ tệp trên Vercel (Supabase Storage S3 / Cloudflare R2 / Amazon S3)

Vercel dùng Cloud Object Storage; không đặt `UPLOADS_DIR` trỏ vào filesystem của Function. Khi `STORAGE_PROVIDER` chưa cấu hình trên Vercel, ứng dụng từ chối upload thay vì âm thầm lưu vào filesystem tạm. Local development vẫn dùng `STORAGE_PROVIDER=local` và thư mục `uploads/problem-attachments`; VPS hiện tại tiếp tục dùng local storage với `UPLOADS_DIR` tuyệt đối.

### Cấu hình Supabase Storage S3

1. Dùng bucket private `unibridge-storage`; không bật public access.
2. Trong Supabase Dashboard, bật S3 protocol cho Storage và lấy endpoint, region cùng cặp S3 access key trong phần S3 settings. Endpoint có dạng `https://<project-ref>.storage.supabase.co/storage/v1/s3`; dùng region thật được hiển thị cho project, không dùng `auto`.
3. Supabase S3 access keys có quyền rộng và bypass RLS. Chỉ cấu hình chúng ở biến môi trường server-side của Vercel; backend UniBridge tiếp tục xác thực người dùng và quyền tài nguyên trước khi cấp signed URL.
4. Cấu hình CORS cho origin production/preview và cho phép `PUT` cùng header `Content-Type` và các header `x-amz-*`. Bucket vẫn private; không bật public access để khắc phục CORS.
5. Supabase S3 không hỗ trợ S3 Object Lifecycle. Khi promote thành công, ứng dụng xóa object `pending/`; nếu lần xóa gặp lỗi sẽ ghi log và giữ bản permanent. Object pending dư có thể cần được dọn thủ công trong Supabase.

### Cấu hình Cloudflare R2 hoặc Amazon S3

1. Tạo bucket riêng tư trên Cloudflare R2 hoặc Amazon S3. Không bật public access/public bucket.
2. Tạo access key giới hạn vào đúng bucket, với quyền đọc, ghi, xóa và kiểm tra object. Không dùng tài khoản quản trị Cloudflare/AWS.
3. Với R2, đặt endpoint theo dạng `https://<account-id>.r2.cloudflarestorage.com` và region là `auto`. Với Amazon S3, đặt endpoint theo region và dùng region của bucket.
4. Cấu hình CORS cho origin production và preview cần thiết của UniBridge. Cho phép `PUT` và header `Content-Type` cùng các header `x-amz-*`. Không dùng public bucket để giải quyết CORS.
5. Với R2, có thể tạo lifecycle rule xóa object theo prefix `pending/` sau 1 ngày để dọn các lần upload bị bỏ dở.

### Biến môi trường trên Vercel Dashboard

Thêm các biến dưới đây trong **Project → Settings → Environment Variables** cho mọi môi trường cần upload (Production, Preview và Development nếu dùng Vercel):

| Biến | Giá trị |
| --- | --- |
| `STORAGE_PROVIDER` | `s3` cho Supabase/Amazon S3; `r2` cho Cloudflare R2 |
| `STORAGE_BUCKET` | `unibridge-storage` với bucket Supabase hiện tại |
| `STORAGE_REGION` | Region thực tế của Supabase project; `auto` với R2; region bucket với S3 |
| `STORAGE_ENDPOINT` | Supabase: `https://<project-ref>.storage.supabase.co/storage/v1/s3`; R2/S3: endpoint của bucket |
| `STORAGE_ACCESS_KEY_ID` | S3 access key; với Supabase lấy từ S3 settings |
| `STORAGE_SECRET_ACCESS_KEY` | Secret tương ứng |
| `AUTH_SECRET` | Secret Auth.js hiện có, tối thiểu 32 ký tự; dùng ký token upload |

Không đặt các credential storage thành biến `NEXT_PUBLIC_*`, không đưa giá trị thật vào Git và không cần `UPLOADS_DIR` trên Vercel. Sau khi thêm/sửa biến môi trường cần redeploy để Function nhận cấu hình.

### Luồng và quyền truy cập

Trình duyệt xin quyền upload theo batch sau khi đăng nhập; backend kiểm tra vai trò và quyền sở hữu bài toán, nhóm, hồ sơ hoặc dự án rồi cấp signed PUT URL hết hạn sau 5 phút, gắn với object key và Content-Type do backend tạo. Với Supabase, adapter dùng path-style endpoint và region lấy từ project settings. Bucket giới hạn dung lượng 20 MB/tệp; backend xác minh lại kích thước, MIME và chữ ký định dạng file trước khi gắn metadata. Download đi qua API route của UniBridge, route kiểm tra quyền trước khi redirect sang signed GET URL hết hạn sau 60 giây. Bucket vẫn private và URL không được lưu vào database.

### Chuyển file local hiện có

Không có migration Prisma. Các khóa UUID trong database được giữ nguyên. Local storage vẫn đọc được dữ liệu hiện có trong `uploads/problem-attachments`; khi cần chuyển các file đó sang bucket, trước tiên chạy chế độ xem trước:

```sh
npm run storage:migrate-local
```

Sau khi xác nhận đúng thư mục nguồn và bucket đích, đặt các biến `STORAGE_*`, chọn `STORAGE_PROVIDER=s3` (Supabase/Amazon S3) hoặc `STORAGE_PROVIDER=r2`, cùng `UPLOADS_DIR` trỏ tới dữ liệu local, rồi chạy:

```sh
npm run storage:migrate-local -- --apply
```

Công cụ chỉ sao chép file UUID, bỏ qua object đã tồn tại và không xóa/đổi tên file local. Không chạy lệnh `--apply` trên production nếu chưa có bản backup và chưa xác nhận bucket đích. Cần chuyển cả metadata/database hiện tại theo quy trình database riêng nếu môi trường production đang tham chiếu các UUID này.

## Chính sách install-scripts và SQLite driver

`allowScripts` trong `package.json` chỉ duyệt các phiên bản đã xem xét:

| Gói | Phiên bản được duyệt |
| --- | --- |
| `esbuild` | `0.28.2` |
| `prisma` | `7.10.1` |
| `@prisma/engines` | `7.10.1` |
| `unrs-resolver` | `1.12.2` |
| `better-sqlite3` | `12.11.1` |

`fsevents` bị từ chối vì chỉ dành cho macOS. Khi nâng phiên bản bất kỳ gói nào trong danh sách được duyệt, hãy xem xét lại install script và chạy `npm install-scripts approve <tên-gói>` để ghi nhận phiên bản mới trước khi cập nhật lockfile. Kiểm tra danh sách sau cài bằng `npm install-scripts ls`.

Cây dependency chỉ dùng một bản `better-sqlite3@12.11.1`, dedupe giữa root `devDependencies` (phục vụ test) và Prisma adapter. Adapter khai báo `^12.6.0`; phiên bản này cũng thỏa peer range `>=9.0.0` của Prisma CLI. Không thêm `overrides` để ép phiên bản.

## Vận hành job hết hạn lời mời

Job dùng khóa thư mục cạnh database với hậu tố `.expire-invitations.lock`; thư mục khóa có file `owner` chứa PID. Nếu PID còn sống, lượt chạy mới được bỏ qua. Có rủi ro PID đã kết thúc được hệ điều hành cấp lại cho tiến trình khác, khiến job bị bỏ qua dù không còn lượt chạy job thực tế. Với job chạy định kỳ bằng timer, rủi ro này được chấp nhận.

Nếu xác nhận không có tiến trình job đang chạy nhưng job liên tục bị bỏ qua do khóa còn sót, dừng ứng dụng/job liên quan rồi xóa thư mục khóa tương ứng, gồm file `owner`. Đường dẫn khóa là đường dẫn file SQLite cộng `.expire-invitations.lock`; ví dụ database `/srv/unibridge/data/unibridge.sqlite` dùng khóa `/srv/unibridge/data/unibridge.sqlite.expire-invitations.lock`.

## Sao lưu và khôi phục

`scripts/backup.sh` nhận `DB_PATH`, `UPLOADS_DIR`, `BACKUP_DIR` và `KEEP` qua biến môi trường; các đường dẫn phải tuyệt đối. `KEEP` mặc định là 14. `BACKUP_TIMEOUT_SECONDS` giới hạn thời gian sao lưu SQLite, mặc định 300 giây. Khi lệnh sao lưu lỗi hoặc hết giờ, script xóa file database dở dang, thoát với mã lỗi và không chạy xoay vòng `KEEP`, nhờ đó không xóa các bản sao lưu cũ.

Ví dụ sao lưu:

```sh
DB_PATH=/srv/unibridge/data/unibridge.sqlite \
UPLOADS_DIR=/srv/unibridge/uploads \
BACKUP_DIR=/srv/unibridge/backups \
KEEP=14 \
BACKUP_TIMEOUT_SECONDS=300 \
sh scripts/backup.sh
```

Khôi phục trước tiên nên chạy `scripts/restore.sh <thư-mục-backup>` để kiểm checksum, giải nén vào `RESTORE_STAGING_DIR` mới và kiểm tra `PRAGMA integrity_check`. Chỉ dùng `--apply` khi ứng dụng và job đã dừng, đồng thời xác nhận tên thư mục backup theo yêu cầu của script.

`restore.sh --apply` kiểm tra tiến trình đang dùng database bằng `lsof` (ưu tiên) hoặc `fuser`. VPS cần cài ít nhất một công cụ; trên Debian/Ubuntu có thể cài `lsof` bằng `apt install lsof`. Chạy script bằng đúng user chạy ứng dụng hoặc bằng `sudo`, vì các công cụ này chỉ thấy tiến trình mà user có quyền xem. Luôn dừng ứng dụng và timer trước khi restore, không dựa hoàn toàn vào kiểm tra tự động. Nếu không có cả `lsof` lẫn `fuser`, script yêu cầu nhập xác nhận lần hai bằng tay.

Khi áp dụng, script chuyển database cũ cùng các file `-wal`, `-shm`, `-journal` (nếu tồn tại) vào thư mục `<DB_PATH>.pre-restore-<timestamp>`, rồi kiểm tra integrity của database đã cài. Nếu kiểm tra thất bại, script báo vị trí bản cũ và hướng dẫn khôi phục: chuyển database lỗi sang chỗ khác, sau đó chuyển database cũ và sidecar tương ứng từ thư mục pre-restore về cạnh `DB_PATH` với đúng tên ban đầu. Không xóa thư mục pre-restore cho tới khi database đã được xác minh và ứng dụng hoạt động bình thường.

## Kiểm chứng Linux

Workflow [`.github/workflows/linux-check.yml`](../.github/workflows/linux-check.yml) chạy trên `ubuntu-24.04`. Lần chạy **#1** của commit `f470dc9` đạt:

- Job `verify` thành công: `npm ci`, `npm install-scripts ls`, `npm ls better-sqlite3 --all` (chỉ còn `12.11.1`, deduped dưới adapter và Prisma), native binding nạp qua adapter từ `node_modules/better-sqlite3` và SQLite báo phiên bản `3.53.2`; Prisma generate, test, lint, build và TypeScript check đều đạt.
- Job `ignore-scripts-must-fail` thành công: với `npm ci --ignore-scripts`, thao tác mở database bằng `better-sqlite3` lỗi như kỳ vọng do thiếu native binding.

Chưa kiểm chứng triển khai thực tế trên VPS, cụ thể là tải binary thật qua `prebuild-install` và fallback biên dịch bằng `node-gyp`. Thực hiện kiểm tra này trên VPS staging trước khi triển khai production.
