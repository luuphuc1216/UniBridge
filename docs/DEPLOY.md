# Triển khai UniBridge

## Yêu cầu máy chủ

- Node.js major 24, theo `.nvmrc`; npm 11.19.0, theo trường `packageManager` trong `package.json`.
- Cài `build-essential` và `python3`. `better-sqlite3` thường tải binary phù hợp qua `prebuild-install`; nếu không tải được, quá trình cài đặt fallback sang `node-gyp rebuild` và cần toolchain native.
- Dùng `npm ci` để cài đúng dependency đã khóa. Không dùng `--ignore-scripts`: thiếu install script có thể khiến `better-sqlite3` không có native binding và ứng dụng không mở được database.

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

Khi áp dụng, script chuyển database cũ cùng các file `-wal`, `-shm`, `-journal` (nếu tồn tại) vào thư mục `<DB_PATH>.pre-restore-<timestamp>`, rồi kiểm tra integrity của database đã cài. Nếu kiểm tra thất bại, script báo vị trí bản cũ và hướng dẫn khôi phục: chuyển database lỗi sang chỗ khác, sau đó chuyển database cũ và sidecar tương ứng từ thư mục pre-restore về cạnh `DB_PATH` với đúng tên ban đầu. Không xóa thư mục pre-restore cho tới khi database đã được xác minh và ứng dụng hoạt động bình thường.

## Kiểm chứng Linux

Workflow [`.github/workflows/linux-check.yml`](../.github/workflows/linux-check.yml) chạy trên `ubuntu-24.04`. Lần chạy **#1** của commit `f470dc9` đạt:

- Job `verify` thành công: `npm ci`, `npm install-scripts ls`, `npm ls better-sqlite3 --all` (chỉ còn `12.11.1`, deduped dưới adapter và Prisma), native binding nạp qua adapter từ `node_modules/better-sqlite3` và SQLite báo phiên bản `3.53.2`; Prisma generate, test, lint, build và TypeScript check đều đạt.
- Job `ignore-scripts-must-fail` thành công: với `npm ci --ignore-scripts`, thao tác mở database bằng `better-sqlite3` lỗi như kỳ vọng do thiếu native binding.

Chưa kiểm chứng triển khai thực tế trên VPS, cụ thể là tải binary thật qua `prebuild-install` và fallback biên dịch bằng `node-gyp`. Thực hiện kiểm tra này trên VPS staging trước khi triển khai production.
