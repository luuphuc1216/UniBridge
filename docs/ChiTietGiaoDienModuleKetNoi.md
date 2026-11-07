# **ĐẶC TẢ CÁC MODULE CHỨC NĂNG CỦA NỀN TẢNG**

## **1. Module đăng ký, đăng nhập và phân quyền**

### **1.1. Mục đích**

- Cho phép người dùng tạo tài khoản, đăng nhập và sử dụng các chức năng phù hợp với vai trò.
- Phân chia quyền truy cập giữa doanh nghiệp, sinh viên và quản trị viên.


### **1.2. Các giao diện và cách hoạt động**
Giao diện 1: Đăng ký tài khoản

- Thành phần giao diện:

  - Họ và tên: ô nhập văn bản, bắt buộc.
  - Email: ô nhập email, bắt buộc và không được trùng.
  - Mật khẩu và xác nhận mật khẩu: ô nhập mật khẩu, bắt buộc.
  - Loại tài khoản: lựa chọn giữa Doanh nghiệp và Sinh viên.
  - Checkbox đồng ý điều khoản sử dụng.
  - Nút “Đăng ký” và liên kết “Đăng nhập”.

- Cách hoạt động:

  - Người dùng nhập thông tin và chọn loại tài khoản.
  - Khi bấm “Đăng ký”, hệ thống kiểm tra dữ liệu và thông báo lỗi tại trường chưa hợp lệ.
  - Nếu thông tin hợp lệ, hệ thống tạo tài khoản và chuyển đến giao diện hoàn thiện hồ sơ tương ứng với vai trò đã chọn.
  - Người dùng không được tự đăng ký tài khoản quản trị viên.

Giao diện 2: Đăng nhập

- Thành phần giao diện:

  - Ô nhập email và mật khẩu.
  - Nút “Đăng nhập”.
  - Liên kết “Quên mật khẩu” và “Đăng ký”.

- Cách hoạt động:

  - Hệ thống xác thực thông tin đăng nhập.
  - Nếu thành công, người dùng được chuyển đến trang tổng quan theo vai trò.
  - Nếu thông tin không chính xác, hệ thống hiển thị thông báo lỗi.
  - Nếu tài khoản bị khóa, hệ thống từ chối đăng nhập và thông báo trạng thái tài khoản.

Giao diện 3: Trang tổng quan theo vai trò

- Doanh nghiệp: hiển thị thông tin hồ sơ, các vấn đề đã đăng và hồ sơ nhóm sinh viên đã nhận.
- Sinh viên: hiển thị hồ sơ nhóm, vấn đề được đề xuất và các hồ sơ đã gửi.
- Quản trị viên: hiển thị khu vực quản lý tài khoản và kiểm duyệt vấn đề.


### **1.3. Dữ liệu**

- Đọc và ghi: mã tài khoản, họ tên, email, mật khẩu đã mã hóa, vai trò, trạng thái tài khoản và thời gian tạo.
- Trạng thái tài khoản gồm: Hoạt động, Bị khóa.


## **2. Module quản lý hồ sơ doanh nghiệp**

### **2.1. Mục đích**

- Cho phép doanh nghiệp xây dựng hồ sơ giới thiệu về tổ chức, lĩnh vực hoạt động và thông tin liên hệ.
- Cung cấp thông tin để sinh viên tìm hiểu doanh nghiệp trước khi gửi hồ sơ đề xuất giải pháp.


### **2.2. Các giao diện và cách hoạt động**
Giao diện 1: Xem hồ sơ doanh nghiệp

- Thành phần giao diện:

  - Tên doanh nghiệp, logo, lĩnh vực hoạt động và mô tả.
  - Website, địa chỉ và thông tin liên hệ được phép công khai.
  - Nút “Chỉnh sửa hồ sơ”.

- Cách hoạt động:

  - Doanh nghiệp xem thông tin hồ sơ hiện tại.
  - Khi bấm “Chỉnh sửa hồ sơ”, hệ thống chuyển đến giao diện chỉnh sửa.
  - Sinh viên chỉ xem được thông tin công khai của doanh nghiệp, không được chỉnh sửa.

Giao diện 2: Chỉnh sửa hồ sơ doanh nghiệp

- Thành phần giao diện:

  - Tên doanh nghiệp: ô nhập, bắt buộc.
  - Logo: tải ảnh lên, không bắt buộc.
  - Lĩnh vực hoạt động: danh sách chọn một hoặc nhiều lĩnh vực.
  - Mô tả doanh nghiệp: ô nhập văn bản.
  - Website, địa chỉ, email, số điện thoại và người đại diện.
  - Nút “Lưu thay đổi” và “Hủy”.

- Cách hoạt động:

  - Doanh nghiệp cập nhật các thông tin cần thiết.
  - Khi bấm “Lưu thay đổi”, hệ thống kiểm tra dữ liệu và lưu thông tin hợp lệ.
  - Khi bấm “Hủy”, các thay đổi chưa lưu được loại bỏ.
  - Mỗi doanh nghiệp chỉ được chỉnh sửa hồ sơ thuộc quyền quản lý của mình.


### **2.3. Dữ liệu**

- Đọc và ghi: mã doanh nghiệp, mã tài khoản chủ sở hữu, tên doanh nghiệp, logo, lĩnh vực, mô tả, website, địa chỉ và thông tin liên hệ.
- Thông tin riêng tư không được hiển thị cho người dùng khác nếu chưa được cho phép.


## **3. Module quản lý hồ sơ nhóm sinh viên**

### **3.1. Mục đích**

- Cho phép sinh viên tạo nhóm, quản lý thành viên và xây dựng hồ sơ năng lực chung.
- Sử dụng hồ sơ nhóm làm cơ sở để tìm kiếm vấn đề phù hợp và gửi Profile cho doanh nghiệp.


### **3.2. Các giao diện và cách hoạt động**
Giao diện 1: Danh sách và quản lý nhóm

- Thành phần giao diện:

  - Tên nhóm, trưởng nhóm và danh sách thành viên.
  - Trạng thái lời mời tham gia nhóm.
  - Nút “Tạo nhóm”, “Xem hồ sơ” và “Quản lý thành viên”.

- Cách hoạt động:

  - Sinh viên chưa thuộc nhóm có thể tạo nhóm hoặc chấp nhận lời mời tham gia nhóm.
  - Khi tạo nhóm, người tạo được thiết lập làm trưởng nhóm.
  - Trưởng nhóm có quyền quản lý thông tin nhóm và gửi lời mời cho sinh viên khác.
  - Thành viên được mời có thể chấp nhận hoặc từ chối lời mời.

Giao diện 2: Tạo và chỉnh sửa hồ sơ nhóm

- Thành phần giao diện:

  - Tên nhóm: bắt buộc.
  - Ảnh đại diện và phần giới thiệu nhóm.
  - Chuyên ngành: chọn một hoặc nhiều.
  - Kỹ năng: chọn nhiều kỹ năng.
  - Kinh nghiệm, dự án đã thực hiện, sản phẩm và thành tích.
  - Lĩnh vực quan tâm.
  - Nút “Lưu hồ sơ”.

- Cách hoạt động:

  - Nhóm nhập hoặc cập nhật thông tin năng lực.
  - Khi bấm “Lưu hồ sơ”, hệ thống kiểm tra và cập nhật thông tin.
  - Hồ sơ được sử dụng để hiển thị cho doanh nghiệp khi nhóm gửi Profile + Approach.

Giao diện 3: Quản lý thành viên

- Thành phần giao diện:

  - Danh sách thành viên, vai trò trong nhóm.
  - Nút “Thêm thành viên”, “Xóa thành viên” và “Rời nhóm”.

- Cách hoạt động:

  - Trưởng nhóm tìm tài khoản sinh viên và gửi lời mời tham gia.
  - Hệ thống cập nhật danh sách khi sinh viên chấp nhận lời mời.
  - Chỉ người có quyền mới được xóa thành viên.
  - Nếu trưởng nhóm muốn rời nhóm, cần chuyển quyền trưởng nhóm trước.


### **3.3. Dữ liệu**

- Đọc và ghi: mã nhóm, tên nhóm, mã trưởng nhóm, thành viên, chuyên ngành, kỹ năng, kinh nghiệm, dự án, sản phẩm, thành tích và lĩnh vực quan tâm.
- Reputation được hiển thị khi hệ thống đã có dữ liệu đánh giá phù hợp.


## **4. Module đăng và quản lý vấn đề, kèm kiểm duyệt**

### **4.1. Mục đích**

- Cho phép doanh nghiệp đăng các vấn đề thực tế cần giải quyết và theo dõi tình trạng xử lý.
- Đảm bảo vấn đề được kiểm tra trước khi công khai cho sinh viên.


### **4.2. Các giao diện và cách hoạt động**
Giao diện 1: Danh sách vấn đề của doanh nghiệp

- Thành phần giao diện:

  - Bảng danh sách vấn đề gồm tên vấn đề, ngày đăng, lĩnh vực, ngân sách và trạng thái.
  - Bộ lọc theo trạng thái và lĩnh vực.
  - Nút “Đăng vấn đề mới”.
  - Các thao tác “Xem chi tiết”, “Chỉnh sửa” và “Đóng vấn đề”.

- Cách hoạt động:

  - Doanh nghiệp xem toàn bộ vấn đề thuộc quyền quản lý.
  - Bấm “Đăng vấn đề mới” để mở biểu mẫu tạo vấn đề.
  - Bấm “Xem chi tiết” để xem nội dung và trạng thái xử lý.
  - Chỉ vấn đề đáp ứng điều kiện nghiệp vụ mới được chỉnh sửa hoặc đóng.

Giao diện 2: Đăng vấn đề mới

- Thành phần giao diện:

  - Tên vấn đề: bắt buộc, nhập văn bản.
  - Mô tả vấn đề: bắt buộc.
  - Mục tiêu mong muốn: bắt buộc.
  - Lĩnh vực: chọn một hoặc nhiều lĩnh vực.
  - Kỹ năng yêu cầu: chọn nhiều kỹ năng.
  - Thời gian dự kiến: nhập thời lượng hoặc chọn ngày dự kiến hoàn thành.
  - Ngân sách tham khảo: nhập số tiền, không bắt buộc.
  - Tài liệu liên quan: tải tệp, không bắt buộc.
  - Nút “Lưu bản nháp”, “Gửi duyệt” và “Hủy”.

- Cách hoạt động:

  - “Lưu bản nháp”: lưu nội dung với trạng thái Bản nháp.
  - “Gửi duyệt”: kiểm tra các trường bắt buộc; nếu hợp lệ, lưu vấn đề với trạng thái Chờ duyệt.
  - Nếu thiếu thông tin, hệ thống báo lỗi ngay tại trường tương ứng.
  - “Hủy”: quay về danh sách mà không lưu các thay đổi chưa xác nhận.

Giao diện 3: Kiểm duyệt vấn đề dành cho quản trị viên

- Thành phần giao diện:

  - Danh sách vấn đề Chờ duyệt.
  - Thông tin doanh nghiệp đăng vấn đề.
  - Nội dung mô tả, mục tiêu, lĩnh vực và tài liệu đính kèm.
  - Ô nhập lý do xử lý.
  - Nút “AI kiểm tra”, checklist ĐẠT/KHÔNG ĐẠT, nút “Phê duyệt”, “Yêu cầu chỉnh sửa”, “Từ chối” và “Thu hồi duyệt”.

- Cách hoạt động:

  - Quản trị viên mở một vấn đề để kiểm tra nội dung.
  - “Phê duyệt”: chuyển sang trạng thái Đã duyệt và cho phép công khai.
  - “Yêu cầu chỉnh sửa”: chuyển sang Cần chỉnh sửa, lưu lý do và thông báo doanh nghiệp.
  - “Từ chối”: chuyển sang Bị từ chối và lưu lý do.
  - “AI kiểm tra”: chạy kiểm tra theo luật trước rồi hiển thị checklist AI; kết quả chỉ là gợi ý cho admin.
  - “Thu hồi duyệt”: đưa bài toán Đã duyệt về Chờ duyệt và ghi nhật ký ghi đè.
  - Sau khi doanh nghiệp chỉnh sửa theo yêu cầu, vấn đề được gửi duyệt lại nếu cần.


### **4.3. Dữ liệu**

- Đọc và ghi: mã vấn đề, mã doanh nghiệp, tên, mô tả, mục tiêu, lĩnh vực, kỹ năng, thời gian, ngân sách, tài liệu, ngày tạo, người kiểm duyệt, lý do xử lý và trạng thái.
- Các trạng thái chính: Bản nháp, Chờ duyệt, Cần chỉnh sửa, Đã duyệt, Bị từ chối và Đã đóng.
- Chỉ vấn đề Đã duyệt và còn mở mới được hiển thị trong danh sách tìm kiếm công khai.


## **5. Module tìm kiếm và lọc vấn đề**

### **5.1. Mục đích**

- Hỗ trợ nhóm sinh viên tìm kiếm những vấn đề phù hợp với năng lực và định hướng của nhóm.
- Cung cấp các bộ lọc để thu hẹp kết quả và lưu lại những vấn đề quan tâm.


### **5.2. Các giao diện và cách hoạt động**
Giao diện 1: Khám phá vấn đề

- Thành phần giao diện:

  - Ô tìm kiếm theo tên hoặc nội dung vấn đề.
  - Bộ lọc lĩnh vực và kỹ năng.
  - Bộ lọc thời gian dự kiến.
  - Bộ lọc ngân sách tối thiểu và tối đa.
  - Bộ sắp xếp theo mới nhất hoặc mức độ phù hợp.
  - Danh sách vấn đề hiển thị tên, doanh nghiệp, lĩnh vực, thời gian và ngân sách nếu có.
  - Nút “Xem chi tiết” và “Lưu vấn đề”.

- Cách hoạt động:

  - Sinh viên nhập từ khóa hoặc chọn bộ lọc.
  - Hệ thống trả về các vấn đề phù hợp với điều kiện tìm kiếm.
  - Khi thay đổi bộ lọc, danh sách được cập nhật tương ứng.
  - Khi bấm “Xem chi tiết”, hệ thống chuyển đến trang chi tiết vấn đề.
  - Khi bấm “Lưu vấn đề”, hệ thống thêm vấn đề vào danh sách đã lưu của người dùng hoặc nhóm.

Giao diện 2: Chi tiết vấn đề

- Thành phần giao diện:

  - Tên vấn đề, thông tin doanh nghiệp, mô tả và mục tiêu.
  - Lĩnh vực, kỹ năng yêu cầu, thời gian và ngân sách tham khảo.
  - Tài liệu liên quan được phép công khai.
  - Nút “Lưu vấn đề”.
  - Nút “Gửi Profile + Approach” dành cho nhóm sinh viên đủ điều kiện.

- Cách hoạt động:

  - Sinh viên xem toàn bộ thông tin cần thiết để đánh giá mức độ phù hợp.
  - Bấm “Lưu vấn đề” để lưu hoặc bỏ lưu.
  - Bấm “Gửi Profile + Approach” để chuyển đến biểu mẫu gửi hồ sơ.
  - Nếu vấn đề đã đóng hoặc không còn nhận hồ sơ, nút gửi hồ sơ bị vô hiệu hóa và hiển thị thông báo.

Giao diện 3: Vấn đề đã lưu và đề xuất dành cho nhóm

- Thành phần giao diện:

  - Danh sách vấn đề đã lưu.
  - Danh sách vấn đề được hệ thống đề xuất.
  - Bộ lọc và nút bỏ lưu.

- Cách hoạt động:

  - Sinh viên xem lại những vấn đề đã lưu trước đó.
  - Hệ thống có thể đề xuất vấn đề dựa trên chuyên ngành, kỹ năng, lĩnh vực quan tâm và lịch sử tương tác.
  - Nếu chức năng Recommendation chưa được triển khai, giao diện chỉ sử dụng dữ liệu và quy tắc lọc hiện có, không hiển thị kết quả giả như thể hệ thống đã phân tích thông minh.


### **5.3. Dữ liệu**

- Đọc: dữ liệu vấn đề đã duyệt, hồ sơ nhóm và các tiêu chí tìm kiếm.
- Ghi: lịch sử tìm kiếm, vấn đề đã xem và danh sách vấn đề đã lưu.

6. Module gửi và quản lý Profile + Approach
6.1. Mục đích

- Cho phép nhóm sinh viên giới thiệu năng lực và đề xuất cách tiếp cận, giải quyết vấn đề do doanh nghiệp đăng tải.
- Giúp doanh nghiệp xem xét, đánh giá và so sánh các nhóm dựa trên hồ sơ năng lực (Profile) và phương án tiếp cận (Approach) trước khi lựa chọn.
- Cho phép nhóm sinh viên theo dõi trạng thái hồ sơ ứng tuyển và kết quả lựa chọn từ doanh nghiệp.
- Hỗ trợ liên kết với quy trình gửi lời mời và xác nhận hợp tác tại Module 7.

6.2. Các giao diện và cách hoạt động
**Giao diện 1: Gửi Profile + Approach**
**Thành phần giao diện:**

- Phần Profile hiển thị thông tin nhóm, thành viên, chuyên ngành, kỹ năng, kinh nghiệm, dự án và sản phẩm đã thực hiện.
- Phần Approach gồm:

  - Cách nhóm hiểu vấn đề: bắt buộc.
  - Hướng giải quyết dự kiến: bắt buộc.
  - Phương pháp thực hiện: bắt buộc.
  - Các bước thực hiện chính: bắt buộc.
  - Công cụ hoặc công nghệ dự kiến: không bắt buộc.
  - Nguồn lực cần thiết: không bắt buộc.
  - Thời gian dự kiến: bắt buộc.
  - Tài liệu minh họa hoặc đường dẫn tham khảo: không bắt buộc.
  - Tệp: tối đa 3 tệp PDF, PNG/JPG, DOCX, XLSX, PPTX hoặc CSV; tối đa 20 MB mỗi tệp và 60 MB tổng. Liên kết tham khảo tối đa 3 địa chỉ HTTP/HTTPS.

- Nút “Lưu bản nháp”, “Gửi hồ sơ” và “Hủy”.

**Cách hoạt động:**

- Profile được lấy từ hồ sơ nhóm đã lưu trên hệ thống.
- Nhóm sinh viên nhập Approach để trình bày cách tiếp cận và giải quyết vấn đề.
- Khi chọn “Lưu bản nháp”, hệ thống lưu nội dung và tệp để nhóm tiếp tục chỉnh sửa mà chưa gửi đến doanh nghiệp.
- Khi chọn “Gửi hồ sơ”, hệ thống kiểm tra các trường bắt buộc, quyền gửi hồ sơ của người thực hiện và trạng thái của vấn đề.
- Nếu thông tin hợp lệ và vấn đề còn nhận ứng tuyển, hệ thống lưu hồ sơ với trạng thái “Đã gửi” và chuyển đến doanh nghiệp; tệp đính kèm bị khóa theo phiên bản.
- Nếu thông tin chưa đầy đủ, nhóm không có quyền gửi hoặc vấn đề đã ngừng nhận hồ sơ, hệ thống không cho phép gửi và hiển thị thông báo tương ứng.
- Mỗi nhóm chỉ có một hồ sơ ứng tuyển đang có hiệu lực đối với một vấn đề tại một thời điểm, nhằm tránh gửi trùng lặp.
- Việc gửi Profile + Approach chỉ được xem là đăng ký tham gia, chưa đồng nghĩa với việc nhóm được lựa chọn hoặc phải bắt đầu thực hiện dự án.

**Giao diện 2: Hồ sơ đã gửi của nhóm sinh viên**
**Thành phần giao diện:**

- Danh sách hồ sơ đã gửi theo từng vấn đề.
- Tên vấn đề, doanh nghiệp nhận hồ sơ, ngày gửi và trạng thái hiện tại.
- Nút “Xem hồ sơ” và “Rút hồ sơ” khi được phép.
- Thông báo kết quả xem xét và lựa chọn từ doanh nghiệp.
- Thông tin lời mời hợp tác và thời hạn phản hồi nếu nhóm được doanh nghiệp lựa chọn sơ bộ.
- Nút “Xem lời mời hợp tác” khi có lời mời đang chờ xác nhận.

**Cách hoạt động:**

- Nhóm sinh viên có thể theo dõi danh sách hồ sơ đã gửi và trạng thái xử lý của từng hồ sơ.
- Khi chọn “Xem hồ sơ”, hệ thống hiển thị nội dung Profile + Approach tại thời điểm gửi.
- Sau khi gửi thành công, hồ sơ có trạng thái “Đã gửi”. Khi doanh nghiệp tiếp nhận và đánh dấu xem xét, trạng thái có thể được cập nhật thành “Đang xem xét”.
- Khi doanh nghiệp gửi lời mời hợp tác, hồ sơ chuyển sang trạng thái “Chờ xác nhận hợp tác”. Hệ thống hiển thị thông báo và thời hạn phản hồi cho nhóm.
- Nhóm sinh viên chọn “Xem lời mời hợp tác” để chuyển đến giao diện xác nhận tham gia dự án được quy định tại Module 7.
- Nếu nhóm đồng ý tham gia, hồ sơ chuyển sang trạng thái “Được lựa chọn”. Hệ thống ghi nhận kết quả xác nhận và thông báo cho doanh nghiệp.
- Nếu nhóm từ chối, hồ sơ chuyển sang trạng thái “Từ chối hợp tác”. Doanh nghiệp nhận được thông báo và có thể lựa chọn nhóm khác.
- Nếu nhóm không phản hồi trong thời hạn quy định, lời mời chuyển sang trạng thái “Hết hạn phản hồi”. Doanh nghiệp được thông báo để tiếp tục quá trình lựa chọn.
- Nếu doanh nghiệp đã hoàn tất lựa chọn chính thức một nhóm khác, các hồ sơ ứng tuyển còn lại chuyển sang trạng thái “Không được lựa chọn”.
- Nhóm sinh viên có thể chủ động rút hồ sơ khi chưa xác nhận hợp tác chính thức và chưa có lời mời đang chờ phản hồi. Khi đó, hồ sơ chuyển sang trạng thái “Đã rút” và không tiếp tục được xem xét.
- Tệp đính kèm của hồ sơ đã rút được giữ riêng theo phiên bản để bảo toàn lịch sử, không xóa vật lý; việc tải xuống vẫn qua route kiểm tra quyền.
- Sau khi xác nhận hợp tác thành công, hai bên chuyển sang bước trao đổi, thống nhất yêu cầu và chuẩn bị thực hiện Prototype/Solution Proposal.

**Giao diện 3: Hồ sơ nhận được của doanh nghiệp**
**Thành phần giao diện:**

- Danh sách các nhóm đã gửi Profile + Approach vào từng vấn đề.
- Tên nhóm, chuyên ngành, kỹ năng, kinh nghiệm, Reputation (nếu có) và thời gian gửi hồ sơ.
- Trạng thái xử lý của từng hồ sơ.
- Bộ lọc hồ sơ theo trạng thái và thời gian gửi.
- Nút “Xem Profile”, “Xem Approach” và “Đánh dấu cần xem xét”.
- Thông báo kết quả phản hồi lời mời hợp tác của nhóm sinh viên.

**Cách hoạt động:**

- Doanh nghiệp chỉ được xem các hồ sơ ứng tuyển thuộc những vấn đề do mình đăng tải và quản lý.
- Khi mở một hồ sơ, hệ thống hiển thị Profile và Approach mà nhóm đã gửi để doanh nghiệp đánh giá.
- Doanh nghiệp có thể đánh dấu hồ sơ cần xem xét, đồng thời lọc và so sánh các hồ sơ ứng tuyển.
- Khi muốn lựa chọn nhóm, doanh nghiệp chuyển đến chức năng lựa chọn và gửi lời mời hợp tác tại Module 7.
- Sau khi lời mời được gửi, hồ sơ tương ứng chuyển sang trạng thái “Chờ xác nhận hợp tác”. Các hồ sơ khác vẫn giữ trạng thái hiện tại trong thời gian chờ phản hồi.
- Nếu nhóm đồng ý tham gia, hệ thống cập nhật trạng thái “Được lựa chọn” và thông báo kết quả cho doanh nghiệp. Các hồ sơ còn lại chuyển sang “Không được lựa chọn”.
- Nếu nhóm từ chối hoặc lời mời hết hạn, hệ thống cập nhật trạng thái tương ứng và cho phép doanh nghiệp tiếp tục lựa chọn nhóm khác.
- Doanh nghiệp không thể gửi đồng thời nhiều lời mời hợp tác đang chờ xác nhận cho cùng một vấn đề.
- Việc doanh nghiệp gửi lời mời chưa tạo ra dự án chính thức hoặc phát sinh giao dịch thanh toán.

6.3. Dữ liệu
**Dữ liệu đọc:**

- Hồ sơ nhóm sinh viên, danh sách thành viên, chuyên ngành, kỹ năng, kinh nghiệm và dự án đã thực hiện.
- Thông tin vấn đề, trạng thái nhận ứng tuyển và thông tin doanh nghiệp.
- Thông tin lời mời hợp tác và kết quả phản hồi được ghi nhận tại Module 7.

**Dữ liệu ghi:**

- Mã hồ sơ ứng tuyển.
- Mã nhóm sinh viên.
- Mã vấn đề.
- Nội dung Approach.
- Phiên bản Profile tại thời điểm gửi.
- Thời gian tạo và thời gian gửi hồ sơ.
- Trạng thái hồ sơ ứng tuyển.
- Thời gian cập nhật trạng thái và thông tin xử lý liên quan.

**Các trạng thái hồ sơ:**

| **Trạng thái** | **Ý nghĩa** |
| --- | --- |
| Bản nháp | Nhóm đang chuẩn bị hồ sơ, chưa gửi doanh nghiệp |
| Đã gửi | Hồ sơ đã được gửi thành công |
| Đang xem xét | Doanh nghiệp đang đánh giá hồ sơ |
| Chờ xác nhận hợp tác | Doanh nghiệp đã gửi lời mời, chờ nhóm phản hồi |
| Được lựa chọn | Nhóm đã đồng ý hợp tác và được lựa chọn chính thức |
| Không được lựa chọn | Doanh nghiệp đã lựa chọn chính thức nhóm khác |
| Từ chối hợp tác | Nhóm từ chối lời mời hợp tác |
| Hết hạn phản hồi | Nhóm không phản hồi trong thời hạn quy định |
| Đã rút | Nhóm chủ động rút hồ sơ trước khi xác nhận hợp tác |
**Các quy tắc xử lý dữ liệu:**

- Mỗi hồ sơ phải được liên kết với một nhóm sinh viên và một vấn đề cụ thể.
- Nội dung Profile tại thời điểm gửi được lưu để đảm bảo doanh nghiệp đánh giá đúng phiên bản hồ sơ đã nhận.
- Trạng thái hồ sơ phải được đồng bộ giữa tài khoản doanh nghiệp và nhóm sinh viên.
- Chỉ nhóm được gửi lời mời hợp tác mới có quyền phản hồi lời mời đó; việc phản hồi được thực hiện bởi trưởng nhóm hoặc người được phân quyền.
- Khi lời mời bị từ chối hoặc hết hạn, doanh nghiệp có thể lựa chọn nhóm khác theo quy trình của Module 7.
- Một vấn đề chỉ có một nhóm được lựa chọn chính thức trong phạm vi quy trình ban đầu.
- Việc xác nhận hợp tác không đồng nghĩa với việc dự án đã chuyển sang giai đoạn Paid Implementation hoặc phát sinh nghĩa vụ thanh toán.


## **7. Module doanh nghiệp lựa chọn nhóm sinh viên**

### **7.1. Mục đích**

- Hỗ trợ doanh nghiệp so sánh Profile + Approach và lựa chọn nhóm phù hợp với vấn đề.
- Ghi nhận kết quả lựa chọn và thông báo cho các nhóm liên quan.


### **7.2. Các giao diện và cách hoạt động**
Giao diện 1: Danh sách hồ sơ theo vấn đề

- Thành phần giao diện:

  - Tên vấn đề và trạng thái hiện tại.
  - Danh sách nhóm đã gửi Profile + Approach.
  - Thông tin tổng quan gồm chuyên ngành, kỹ năng, kinh nghiệm, Reputation và thời gian gửi.
  - Bộ lọc theo trạng thái.
  - Nút “Xem Profile”, “Xem Approach” và “So sánh nhóm”.

- Cách hoạt động:

  - Doanh nghiệp mở một vấn đề và xem các hồ sơ đã nhận.
  - Có thể mở từng Profile + Approach để đánh giá.
  - Có thể chọn nhiều nhóm để so sánh các tiêu chí trên cùng màn hình.
  - Khi đánh giá chưa đủ thông tin, doanh nghiệp có thể đánh dấu hồ sơ cần xem xét.

Giao diện 2: Chi tiết đánh giá nhóm

- Thành phần giao diện:

  - Profile của nhóm.
  - Approach của nhóm.
  - Các tiêu chí đánh giá gồm kỹ năng, chuyên môn, kinh nghiệm, tính khả thi của Approach, Reputation và thời gian thực hiện.
  - Nút “Quay lại danh sách” và “Chọn nhóm”.

- Cách hoạt động:

  - Doanh nghiệp xem năng lực và phương án tiếp cận của nhóm.
  - Khi bấm “Chọn nhóm”, hệ thống hiển thị hộp thoại xác nhận tên nhóm và vấn đề.
  - Doanh nghiệp xác nhận để hoàn tất lựa chọn.


### **Giao diện 3: Xác nhận lựa chọn nhóm của doanh nghiệp**
**Thành phần giao diện:**

- Tên vấn đề và tên nhóm sinh viên được lựa chọn.
- Thông tin tóm tắt Profile + Approach của nhóm.
- Thông báo rằng nhóm sinh viên cần xác nhận đồng ý trước khi chính thức tham gia dự án.
- Nút “Gửi lời mời hợp tác” và “Hủy”.

**Cách hoạt động:**

- Khi doanh nghiệp nhấn “Gửi lời mời hợp tác”, hệ thống kiểm tra quyền truy cập và trạng thái của vấn đề.
- Nếu hợp lệ, hồ sơ của nhóm được chọn chuyển sang trạng thái “Chờ xác nhận hợp tác”.
- Hệ thống gửi thông báo đến nhóm sinh viên và hiển thị thời hạn phản hồi.
- Trong thời gian chờ xác nhận, doanh nghiệp không thể gửi lời mời hợp tác chính thức cho nhóm khác trong cùng một vấn đề. Các hồ sơ còn lại vẫn giữ trạng thái đang xem xét.


### **Giao diện 4: Xác nhận tham gia dự án của nhóm sinh viên**
**Thành phần giao diện:**

- Tên vấn đề và thông tin doanh nghiệp.
- Nội dung thông báo được doanh nghiệp lựa chọn.
- Thời hạn phản hồi lời mời hợp tác.
- Nút “Đồng ý tham gia” và “Từ chối”.

**Cách hoạt động:**

- Khi nhóm sinh viên nhận được lời mời, trưởng nhóm có thể xem thông tin và xác nhận quyết định.
- Nếu chọn “Đồng ý tham gia”, hệ thống chuyển hồ sơ sang trạng thái “Được lựa chọn” và ghi nhận nhóm chính thức hợp tác với doanh nghiệp.
- Các hồ sơ ứng tuyển còn lại chuyển sang trạng thái “Không được lựa chọn”. Hệ thống gửi thông báo kết quả đến các nhóm liên quan.
- Nếu chọn “Từ chối”, hệ thống ghi nhận trạng thái “Từ chối hợp tác” và thông báo cho doanh nghiệp. Doanh nghiệp có thể tiếp tục lựa chọn nhóm khác trong danh sách hồ sơ ứng tuyển.
- Nếu nhóm không phản hồi trong thời hạn quy định, lời mời chuyển sang trạng thái “Hết hạn phản hồi”. Hệ thống thông báo cho doanh nghiệp và cho phép lựa chọn nhóm khác.
- Sau khi xác nhận hợp tác thành công, hai bên có thể chuyển sang bước trao đổi, thống nhất yêu cầu và chuẩn bị thực hiện Prototype/Solution Proposal.


### **7.3. Dữ liệu**

- **Đọc:** Thông tin vấn đề, Profile + Approach, hồ sơ nhóm, Reputation và trạng thái ứng tuyển.
- **Ghi:** Mã vấn đề, mã nhóm được mời, người gửi lời mời, thời gian gửi, thời hạn phản hồi, thời gian phản hồi, kết quả xác nhận và trạng thái hồ sơ.
- **Trạng thái bổ sung:** Chờ xác nhận hợp tác, Từ chối hợp tác và Hết hạn phản hồi.
- Mỗi vấn đề chỉ có một lời mời hợp tác đang chờ xác nhận tại một thời điểm.
- Chỉ khi nhóm sinh viên đồng ý tham gia, hệ thống mới ghi nhận nhóm được lựa chọn chính thức và chuyển sang giai đoạn chuẩn bị thực hiện dự án.
- Việc lựa chọn nhóm không đồng nghĩa với việc dự án đã chuyển sang giai đoạn triển khai có trả phí.


## **8. Module trao đổi (Chat)**

### **8.1. Mục đích**
- Cung cấp kênh trao đổi giữa doanh nghiệp và nhóm sinh viên để làm rõ vấn đề, thảo luận Approach và phối hợp trong quá trình phát triển giải pháp.

### **8.2. Các giao diện và cách hoạt động**
Giao diện 1: Danh sách cuộc trò chuyện

- Thành phần giao diện:

  - Danh sách cuộc trò chuyện.
  - Tên doanh nghiệp hoặc nhóm sinh viên.
  - Vấn đề liên quan.
  - Tin nhắn gần nhất, thời gian gửi và trạng thái chưa đọc.
  - Bộ lọc theo vấn đề hoặc trạng thái chưa đọc.

- Cách hoạt động:

  - Người dùng mở mục “Tin nhắn” để xem các cuộc trò chuyện mình có quyền tham gia.
  - Bấm vào một cuộc trò chuyện để mở giao diện nhắn tin.
  - Hệ thống không hiển thị cuộc trò chuyện của người dùng khác.

Giao diện 2: Chi tiết cuộc trò chuyện

- Thành phần giao diện:

  - Thông tin đối tượng trao đổi và vấn đề liên quan.
  - Lịch sử tin nhắn theo thứ tự thời gian.
  - Ô nhập tin nhắn.
  - Nút “Gửi”.
  - Chức năng đính kèm tệp nếu được hỗ trợ.

- Cách hoạt động:

  - Người dùng nhập nội dung và bấm “Gửi”.
  - Hệ thống kiểm tra nội dung, lưu tin nhắn và hiển thị cho những người tham gia cuộc trò chuyện.
  - Hệ thống ghi nhận thời gian gửi và trạng thái đọc nếu chức năng này được triển khai.
  - Khi có tin nhắn mới, danh sách cuộc trò chuyện được cập nhật.
  - Người không thuộc cuộc trò chuyện sẽ bị từ chối truy cập.

Giao diện 3: Cuộc trò chuyện gắn với vấn đề

- Thành phần giao diện:

  - Tên vấn đề và trạng thái liên quan.
  - Thông tin cơ bản về doanh nghiệp và nhóm sinh viên.
  - Khung chat.

- Cách hoạt động:

  - Cuộc trò chuyện được gắn với một vấn đề cụ thể để hai bên dễ theo dõi nội dung trao đổi.
  - Hai bên có thể làm rõ yêu cầu, phạm vi giải pháp, thời gian dự kiến và các thông tin cần thiết.
  - Tin nhắn không tự động thay thế hợp đồng hoặc xác nhận thanh toán.


### **8.3. Dữ liệu**

- Đọc và ghi: mã cuộc trò chuyện, mã vấn đề, người tham gia, mã tin nhắn, người gửi, nội dung, tệp đính kèm, thời gian gửi và trạng thái đọc.
- Chỉ người tham gia được cấp quyền mới có thể xem lịch sử trao đổi.


## Bình luận của người review

- **My Ái:** Chức năng nhóm quá phức tạp	Lời mời thành viên, chuyển trưởng nhóm, quản lý quyền có thể để giai đoạn sau.
- **My Ái:** hấy hơi bị phức tạp k bic làm đc hân.
- **My Ái:** Doanh nghiệp bấm chọn là nhóm lập tức được lựa chọn, chưa xét trường hợp nhóm từ chối hoặc không phản hồi.
- **My Ái:** Cần xác định có thể nhắn tin trước hay chỉ sau khi doanh nghiệp chọn nhóm.
