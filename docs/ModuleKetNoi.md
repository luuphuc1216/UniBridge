# **ĐẶC TẢ CÁC MODULE CHO NỀN TẢNG KẾT NỐI DOANH NGHIỆP VÀ NHÓM SINH VIÊN**

## **I. Module đăng ký, đăng nhập và phân quyền**

### **1. Mục đích**
Module này cho phép người dùng tạo tài khoản, đăng nhập và sử dụng các chức năng phù hợp với vai trò của mình trên nền tảng. Hệ thống phân biệt ba vai trò chính gồm doanh nghiệp, nhóm sinh viên và quản trị viên nhằm đảm bảo mỗi người dùng chỉ được truy cập những chức năng và dữ liệu thuộc quyền hạn của mình.

### **2. Đối tượng sử dụng và quyền hạn**

- Doanh nghiệp: Đăng ký tài khoản doanh nghiệp, đăng nhập và quản lý các chức năng dành cho doanh nghiệp.
- Sinh viên: Đăng ký tài khoản nhóm, đăng nhập và tham gia hoặc tạo nhóm sinh viên.
- Quản trị viên: Đăng nhập bằng tài khoản quản trị được cấp để thực hiện các chức năng quản trị hệ thống.
- Người chưa đăng nhập: Chỉ được truy cập các trang công khai được nền tảng cho phép.


### **3. Điểm truy cập chức năng**
Người dùng truy cập chức năng đăng ký hoặc đăng nhập thông qua thanh điều hướng trên website. Sau khi đăng ký thành công, người dùng được chuyển đến bước hoàn thiện thông tin theo vai trò. Sau khi đăng nhập, hệ thống chuyển người dùng đến trang tổng quan tương ứng với tài khoản của mình.

### **4. Giao diện**
Module gồm 4 giao diện chính:

- Giao diện đăng ký tài khoản: Bao gồm họ tên, email, mật khẩu, xác nhận mật khẩu, loại tài khoản và ô đồng ý điều khoản. Người dùng nhấn “Đăng ký” để gửi thông tin. Hệ thống kiểm tra tính hợp lệ của dữ liệu và yêu cầu người dùng sửa nếu có trường không hợp lệ.
- Giao diện đăng nhập: Bao gồm email, mật khẩu, nút “Đăng nhập” và các liên kết “Quên mật khẩu”, “Đăng ký tài khoản”. Sau khi xác thực thành công, hệ thống chuyển người dùng đến trang tổng quan theo vai trò.
- Giao diện khôi phục mật khẩu: Cho phép người dùng thực hiện quy trình khôi phục mật khẩu khi không thể đăng nhập. Hệ thống tiếp nhận thông tin cần thiết và phản hồi theo kết quả xử lý.
- Giao diện tổng quan theo vai trò: Hiển thị các chức năng phù hợp với tài khoản đã đăng nhập. Doanh nghiệp truy cập quản lý hồ sơ và vấn đề; sinh viên truy cập hồ sơ nhóm, tìm kiếm vấn đề và hồ sơ đã gửi; quản trị viên truy cập khu vực quản trị.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi người dùng đăng ký, hệ thống kiểm tra các trường bắt buộc, định dạng email, tính duy nhất của email và sự trùng khớp giữa mật khẩu với mật khẩu xác nhận. Nếu dữ liệu hợp lệ, tài khoản được tạo và người dùng chuyển sang bước hoàn thiện hồ sơ.
Khi người dùng đăng nhập, hệ thống kiểm tra thông tin xác thực và trạng thái tài khoản. Nếu tài khoản bị khóa hoặc thông tin đăng nhập không hợp lệ, hệ thống hiển thị thông báo phù hợp. Khi người dùng đăng xuất, phiên đăng nhập kết thúc và hệ thống chuyển về trang công khai.
Đối với các trường hợp truy cập chức năng không thuộc quyền hạn, hệ thống từ chối truy cập và điều hướng người dùng đến trang phù hợp.

### **6. Dữ liệu**
Module lưu mã tài khoản, họ tên, email, mật khẩu đã mã hóa, vai trò, trạng thái tài khoản, thời điểm tạo tài khoản và thời điểm đăng nhập gần nhất. Trạng thái tài khoản gồm “Hoạt động” và “Bị khóa”. Người dùng không được tự đăng ký vai trò quản trị viên và mỗi email chỉ được sử dụng cho một tài khoản.

## **II. Module quản lý hồ sơ doanh nghiệp**

### **1. Mục đích**
Module này cho phép doanh nghiệp tạo và cập nhật hồ sơ giới thiệu trên nền tảng. Hồ sơ cung cấp thông tin về lĩnh vực hoạt động, năng lực và thông tin liên hệ, giúp sinh viên hiểu rõ hơn về doanh nghiệp trước khi quyết định gửi Profile + Approach cho các vấn đề được đăng.

### **2. Đối tượng sử dụng và quyền hạn**

- Doanh nghiệp: Tạo, xem và chỉnh sửa hồ sơ của chính mình.
- Nhóm sinh viên: Xem thông tin công khai của doanh nghiệp để tìm hiểu về đơn vị đăng vấn đề.
- Quản trị viên: Xem hồ sơ để hỗ trợ xử lý nội dung hoặc kiểm tra khi cần thiết theo quyền được cấp.


### **3. Điểm truy cập chức năng**
Doanh nghiệp truy cập module thông qua mục “Hồ sơ doanh nghiệp” trong menu tài khoản. Nhóm sinh viên có thể mở hồ sơ doanh nghiệp từ trang chi tiết vấn đề hoặc từ khu vực hiển thị thông tin doanh nghiệp.

### **4. Giao diện**
Module gồm 2 giao diện chính:

- Giao diện xem hồ sơ doanh nghiệp: Hiển thị tên doanh nghiệp, logo, lĩnh vực hoạt động, mô tả, website, địa chỉ và thông tin liên hệ được phép công khai. Sinh viên sử dụng giao diện này để tìm hiểu doanh nghiệp trước khi gửi hồ sơ.
- Giao diện tạo và chỉnh sửa hồ sơ: Bao gồm các trường nhập thông tin doanh nghiệp, nút “Lưu thay đổi” và nút “Hủy”. Tên doanh nghiệp là trường bắt buộc; logo, website và địa chỉ có thể không bắt buộc. Các trường email và số điện thoại phải đúng định dạng.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi doanh nghiệp mở hồ sơ, hệ thống hiển thị thông tin đã lưu. Nếu doanh nghiệp chưa có hồ sơ, hệ thống hiển thị biểu mẫu tạo mới.
Khi doanh nghiệp nhấn “Lưu thay đổi”, hệ thống kiểm tra dữ liệu bắt buộc và định dạng thông tin. Nếu dữ liệu hợp lệ, hệ thống cập nhật hồ sơ và thông báo lưu thành công. Nếu dữ liệu không hợp lệ, hệ thống hiển thị lỗi tại trường tương ứng. Khi nhấn “Hủy”, các thay đổi chưa lưu được loại bỏ.
Mỗi hồ sơ doanh nghiệp phải liên kết với tài khoản sở hữu tương ứng. Doanh nghiệp không được chỉnh sửa hồ sơ của doanh nghiệp khác.

### **6. Dữ liệu**
Module lưu mã doanh nghiệp, mã tài khoản chủ sở hữu, tên doanh nghiệp, logo, lĩnh vực hoạt động, mô tả, website, địa chỉ và thông tin liên hệ. Dữ liệu hồ sơ được liên kết với tài khoản doanh nghiệp để đảm bảo tính nhất quán giữa thông tin đăng ký và thông tin hiển thị trên nền tảng.

## **III. Module quản lý hồ sơ nhóm sinh viên**

### **1. Mục đích**
Module này cho phép sinh viên tạo nhóm, quản lý thành viên và xây dựng hồ sơ năng lực của nhóm. Hồ sơ nhóm là cơ sở để doanh nghiệp đánh giá mức độ phù hợp của nhóm với vấn đề, thông qua các thông tin như chuyên ngành, kỹ năng, kinh nghiệm, dự án đã thực hiện và lĩnh vực quan tâm.

### **2. Đối tượng sử dụng và quyền hạn**

- Sinh viên: Tạo nhóm, cập nhật hồ sơ và quản lý thành viên theo quyền được cấp.
- Doanh nghiệp: Xem hồ sơ nhóm được công khai hoặc được gửi kèm Profile + Approach.
- Quản trị viên: Kiểm tra và xử lý các báo cáo hoặc vi phạm liên quan đến hồ sơ nhóm theo quyền hạn.


### **3. Điểm truy cập chức năng**
Sinh viên truy cập module thông qua mục “Hồ sơ nhóm” hoặc “Quản lý nhóm” trong menu tài khoản. Doanh nghiệp có thể xem hồ sơ nhóm từ danh sách hồ sơ nhận được của một vấn đề.

### **4. Giao diện**
Module gồm 3 giao diện chính:

- Giao diện danh sách và quản lý nhóm: Hiển thị nhóm mà sinh viên đang tham gia, vai trò của sinh viên trong nhóm và các lời mời tham gia nhóm đang chờ xử lý. Tại đây, người dùng có thể mở hồ sơ nhóm hoặc thực hiện các thao tác quản lý theo quyền hạn.
- Giao diện tạo và chỉnh sửa hồ sơ nhóm: Bao gồm tên nhóm, ảnh đại diện, giới thiệu nhóm, chuyên ngành, kỹ năng, kinh nghiệm, dự án đã thực hiện, sản phẩm minh họa, thành tích và lĩnh vực quan tâm. Giao diện có các nút “Lưu hồ sơ”, “Thêm thành viên” và “Rời nhóm” tùy theo quyền của người dùng.
- Giao diện xem Profile nhóm: Hiển thị thông tin năng lực của nhóm để doanh nghiệp tham khảo. Khi hệ thống có dữ liệu đánh giá hợp lệ, giao diện có thể hiển thị thêm Reputation, số dự án đã hoàn thành và các thông tin uy tín được phép công khai.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi sinh viên lưu hồ sơ, hệ thống kiểm tra dữ liệu và cập nhật thông tin nhóm. Khi trưởng nhóm thêm thành viên, hệ thống gửi lời mời đến tài khoản sinh viên được chọn. Thành viên chỉ được thêm vào nhóm sau khi chấp nhận lời mời.
Trưởng nhóm hoặc người được cấp quyền có thể xóa thành viên sau khi xác nhận thao tác. Thành viên có thể rời nhóm theo quy định; nếu người rời nhóm là trưởng nhóm, cần chuyển quyền trưởng nhóm hoặc xử lý việc giải thể nhóm trước khi thực hiện.
Hệ thống lưu trạng thái lời mời gồm “Đang chờ”, “Đã chấp nhận” và “Đã từ chối”. Reputation chỉ được hiển thị khi có dữ liệu đánh giá hợp lệ, không tự tạo điểm khi chưa có kết quả đánh giá.

### **6. Dữ liệu**
Module lưu mã nhóm, tên nhóm, mã trưởng nhóm, danh sách thành viên, chuyên ngành, kỹ năng, kinh nghiệm, dự án, sản phẩm, thành tích, lĩnh vực quan tâm và Reputation nếu có. Dữ liệu thành viên được liên kết với tài khoản sinh viên; dữ liệu lời mời được lưu riêng để theo dõi trạng thái tham gia nhóm.

## **IV. Module đăng và quản lý vấn đề, kèm kiểm duyệt**

### **1. Mục đích**
Module này cho phép doanh nghiệp đăng các vấn đề thực tế cần giải quyết và theo dõi quá trình xử lý của từng vấn đề. Đồng thời, module cung cấp chức năng kiểm duyệt để quản trị viên xem xét nội dung trước khi vấn đề được công khai cho nhóm sinh viên tìm kiếm và gửi Profile + Approach.

### **2. Đối tượng sử dụng và quyền hạn**

- Doanh nghiệp: Tạo, xem, chỉnh sửa và đóng các vấn đề do mình đăng theo trạng thái cho phép.
- Nhóm sinh viên: Xem các vấn đề đã được phê duyệt và đang mở.
- Quản trị viên: Xem xét, phê duyệt, từ chối hoặc yêu cầu doanh nghiệp chỉnh sửa vấn đề.


### **3. Điểm truy cập chức năng**
Doanh nghiệp truy cập từ mục “Quản lý vấn đề” và chọn “Đăng vấn đề mới”. Quản trị viên truy cập thông qua mục “Kiểm duyệt vấn đề”. Sinh viên truy cập các vấn đề đã được duyệt thông qua mục “Khám phá vấn đề”.

### **4. Giao diện**
Module gồm 3 giao diện chính:

- Giao diện đăng và chỉnh sửa vấn đề: Bao gồm tên vấn đề, mô tả vấn đề, mục tiêu mong muốn, lĩnh vực, kỹ năng yêu cầu, thời gian dự kiến, ngân sách tham khảo và tài liệu đính kèm. Giao diện có các nút “Lưu bản nháp”, “Gửi duyệt” và “Hủy”.
- Giao diện quản lý vấn đề của doanh nghiệp: Hiển thị danh sách vấn đề do doanh nghiệp đăng, gồm tên vấn đề, ngày đăng, lĩnh vực, trạng thái và các thao tác tương ứng. Doanh nghiệp có thể xem chi tiết, chỉnh sửa hoặc đóng vấn đề theo trạng thái hiện tại.
- Giao diện kiểm duyệt của quản trị viên: Hiển thị danh sách vấn đề đang chờ duyệt và nội dung chi tiết của từng vấn đề. Có nút “AI kiểm tra” và checklist ĐẠT/KHÔNG ĐẠT. Quản trị viên có thể chọn “Phê duyệt”, “Yêu cầu chỉnh sửa”, “Từ chối” hoặc “Thu hồi duyệt”; trường hợp yêu cầu chỉnh sửa hoặc từ chối phải có lý do xử lý.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi doanh nghiệp lưu bản nháp, vấn đề được lưu với trạng thái “Bản nháp” và chưa công khai. Khi nhấn “Gửi duyệt”, hệ thống kiểm tra các trường bắt buộc và chuyển vấn đề sang trạng thái “Chờ duyệt” nếu dữ liệu hợp lệ. Sau bước kiểm tra theo luật, hệ thống có thể chạy AI kiểm tra độ rõ ràng, phạm vi, mức phù hợp với sinh viên và dấu hiệu vi phạm. Chế độ AI tự động duyệt được bật mặc định (`AI_AUTO_REVIEW=true`): nếu toàn bộ checklist đạt, bài toán được tự chuyển “Đã duyệt”; nếu cần bổ sung, chuyển “Cần chỉnh sửa”; vi phạm rõ ràng do luật phát hiện có thể chuyển “Bị từ chối”. AI không chắc chắn, lỗi nhà cung cấp, hết lượt hoặc thiếu khóa không được tự từ chối và để bài toán ở “Chờ duyệt” cho quản trị viên. Quản trị viên giám sát, có thể chạy AI kiểm tra thủ công và ghi đè mọi kết quả tự động.
Quản trị viên xem xét nội dung và thực hiện một trong các thao tác. Nếu phê duyệt, vấn đề chuyển sang “Đã duyệt” và được đưa vào danh sách công khai phục vụ tìm kiếm, đề xuất. Nếu yêu cầu chỉnh sửa, vấn đề chuyển sang “Cần chỉnh sửa” và doanh nghiệp nhận được lý do xử lý. Nếu từ chối, vấn đề chuyển sang “Bị từ chối” và hệ thống lưu lại lý do. “Thu hồi duyệt” chuyển bài toán đã duyệt về “Chờ duyệt”, ghi nhật ký ghi đè và dừng hiển thị công khai cho đến khi kiểm tra lại.

AI tự động chỉ được áp dụng theo compare-and-set khi bài toán vẫn ở “Chờ duyệt” và `version` đúng phiên bản đã kiểm. Nếu doanh nghiệp sửa bài toán trong lúc AI kiểm tra, hệ thống chỉ lưu `AiReview`, không đổi trạng thái. Nội dung được xem là thay đổi đáng kể nếu thay đổi tên, mô tả, mục tiêu, yêu cầu, lĩnh vực, thời gian, kỹ năng hoặc thêm/xóa tệp đính kèm; thay đổi ngân sách không kích hoạt kiểm duyệt lại. Sửa chính tả nhỏ không được coi là thay đổi đáng kể; khi nội dung thay đổi đáng kể, bài toán đã duyệt phải quay về “Chờ duyệt” để kiểm tra lại.
Doanh nghiệp có thể chỉnh sửa vấn đề theo trạng thái cho phép. Nếu nội dung cần được duyệt lại, hệ thống chuyển vấn đề về “Chờ duyệt”. Khi đóng vấn đề, hệ thống ngừng nhận hồ sơ mới theo quy định của nền tảng.

### **6. Dữ liệu**
Module lưu mã vấn đề, mã doanh nghiệp, tên vấn đề, mô tả, mục tiêu, lĩnh vực, kỹ năng yêu cầu, thời gian dự kiến, ngân sách, tài liệu đính kèm, ngày tạo, người kiểm duyệt, lý do xử lý và trạng thái. Các trạng thái gồm “Bản nháp”, “Chờ duyệt”, “Cần chỉnh sửa”, “Đã duyệt”, “Bị từ chối” và “Đã đóng”.
Dữ liệu vấn đề phải được liên kết với doanh nghiệp đăng vấn đề và đồng bộ giữa trang quản lý của doanh nghiệp, khu vực kiểm duyệt và danh sách vấn đề công khai. Kết quả AI lưu trong `AiReview`, người thực hiện tự động là “AI”; mọi ghi đè hoặc thu hồi của quản trị viên lưu nhật ký riêng.

## **Module quản trị — kiểm duyệt vấn đề**

### **Bước 2. Kiểm tra và giám sát**
Quản trị viên xem danh sách bài toán đã được AI xử lý, có thể bấm “AI kiểm tra”, xem checklist, duyệt lại, yêu cầu chỉnh sửa, từ chối hoặc thu hồi duyệt. Thu hồi duyệt đưa bài toán về “Chờ duyệt”; mọi quyết định thủ công là ghi đè có nhật ký riêng. AI lỗi, hết hạn mức, thiếu khóa hoặc trả JSON sai không làm mất bài toán và để quản trị viên xử lý.

### **Dữ liệu kiểm duyệt**
Mỗi kết quả lưu trong `AiReview`, gồm phiên bản bài toán đã kiểm, checklist, kết luận, lý do, thời điểm, trạng thái và người thực hiện là “AI”. Hành động của quản trị viên lưu trong `AuditLog`; compare-and-set chỉ áp dụng kết quả tự động khi trạng thái và phiên bản vẫn khớp.

## **V. Module tìm kiếm và lọc vấn đề**

### **1. Mục đích**
Module này hỗ trợ nhóm sinh viên tìm kiếm các vấn đề phù hợp với chuyên ngành, kỹ năng, thời gian và định hướng của nhóm. Ngoài chức năng tìm kiếm và lọc, module còn hỗ trợ lưu vấn đề và hiển thị các vấn đề được đề xuất dựa trên mức độ phù hợp.

### **2. Đối tượng sử dụng và quyền hạn**

- Nhóm sinh viên: Tìm kiếm, lọc, xem chi tiết, lưu và theo dõi các vấn đề quan tâm.
- Người chưa đăng nhập: Có thể xem các vấn đề công khai nếu được cho phép, nhưng không thể gửi Profile + Approach.
- Doanh nghiệp: Không được sử dụng module này để truy cập dữ liệu riêng tư của nhóm sinh viên khác.


### **3. Điểm truy cập chức năng**
Sinh viên truy cập module thông qua mục “Khám phá vấn đề” trên thanh điều hướng hoặc nút “Tìm vấn đề” tại trang tổng quan của nhóm.

### **4. Giao diện**
Module gồm 3 giao diện chính:

- Giao diện danh sách và tìm kiếm vấn đề: Bao gồm ô tìm kiếm theo từ khóa, bộ lọc lĩnh vực, kỹ năng, thời gian và ngân sách. Danh sách kết quả hiển thị tên vấn đề, doanh nghiệp, lĩnh vực, kỹ năng yêu cầu, thời gian dự kiến, ngân sách nếu có và trạng thái. Người dùng có thể chọn “Xem chi tiết” hoặc “Lưu vấn đề”.
- Giao diện chi tiết vấn đề: Hiển thị nội dung mô tả, mục tiêu, lĩnh vực, kỹ năng yêu cầu, thời gian dự kiến, ngân sách tham khảo và thông tin công khai về doanh nghiệp. Giao diện cung cấp thao tác gửi Profile + Approach nếu vấn đề còn nhận hồ sơ và người dùng có đủ quyền.
- Giao diện vấn đề đã lưu và đề xuất dành cho nhóm: Hiển thị các vấn đề nhóm đã lưu và danh sách vấn đề được hệ thống đề xuất theo mức độ phù hợp. Người dùng có thể mở lại chi tiết hoặc bỏ lưu vấn đề không còn quan tâm.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi người dùng nhập từ khóa hoặc thay đổi bộ lọc, hệ thống cập nhật danh sách theo các điều kiện được chọn. Khi chọn “Xóa bộ lọc”, các điều kiện tìm kiếm được đưa về mặc định.
Khi người dùng nhấn “Lưu vấn đề”, hệ thống lưu vấn đề vào danh sách của người dùng hoặc nhóm. Nếu vấn đề đã được lưu trước đó, hệ thống hiển thị trạng thái đã lưu. Tại giao diện vấn đề đã lưu, người dùng có thể bỏ lưu khi không còn quan tâm.
Đối với chức năng đề xuất, hệ thống sử dụng thông tin hồ sơ nhóm, chuyên ngành, kỹ năng, lĩnh vực quan tâm và dữ liệu tương tác như lịch sử tìm kiếm, xem hoặc lưu vấn đề để xếp hạng mức độ phù hợp. Nếu chưa xây dựng hệ thống Recommendation tự động, có thể sử dụng bộ lọc và quy tắc xếp hạng cơ bản.
Chỉ các vấn đề đã được phê duyệt và đang mở mới được hiển thị để nhận hồ sơ. Hệ thống không cho gửi hồ sơ vào vấn đề đã đóng.

### **6. Dữ liệu**
Module đọc dữ liệu vấn đề đã được phê duyệt, hồ sơ nhóm, chuyên ngành, kỹ năng, lĩnh vực quan tâm và thời gian dự kiến. Đồng thời, module ghi nhận lịch sử tìm kiếm, vấn đề đã xem, vấn đề đã lưu và các tương tác liên quan phục vụ việc đề xuất vấn đề.

## **VI. Module gửi và quản lý Profile + Approach**

### **1. Mục đích**
Module này cho phép nhóm sinh viên gửi hồ sơ năng lực (Profile) kèm phương án tiếp cận vấn đề (Approach) để doanh nghiệp xem xét và so sánh các nhóm trước khi lựa chọn. Đây là bước thể hiện năng lực và cách nhóm dự kiến giải quyết vấn đề, chưa yêu cầu nhóm phải xây dựng Prototype ở thời điểm gửi hồ sơ.

### **2. Đối tượng sử dụng và quyền hạn**

- Nhóm sinh viên: Tạo, gửi và theo dõi Profile + Approach đã gửi.
- Doanh nghiệp: Xem hồ sơ được gửi vào các vấn đề thuộc quyền quản lý của mình.
- Quản trị viên: Truy cập hồ sơ khi cần xử lý vi phạm hoặc hỗ trợ theo quyền được cấp.


### **3. Điểm truy cập chức năng**
Sinh viên truy cập chức năng gửi hồ sơ từ nút “Gửi Profile + Approach” tại trang chi tiết vấn đề hoặc mục “Hồ sơ đã gửi”. Doanh nghiệp truy cập thông qua mục “Hồ sơ nhận được” trong trang quản lý vấn đề.

### **4. Giao diện**
Module gồm 3 giao diện chính:

- Giao diện gửi Profile + Approach: Phần Profile tự động hiển thị thông tin từ hồ sơ nhóm đã lưu, gồm tên nhóm, thành viên, chuyên ngành, kỹ năng, kinh nghiệm, dự án, sản phẩm và Reputation nếu có. Phần Approach gồm cách nhóm hiểu vấn đề, hướng giải quyết dự kiến, phương pháp thực hiện, các bước chính và thời gian dự kiến. Nhóm có thể bổ sung công cụ, công nghệ, nguồn lực và tệp minh họa. Giao diện có các nút “Lưu bản nháp”, “Gửi hồ sơ” và “Hủy”.
- Giao diện hồ sơ đã gửi của nhóm sinh viên: Hiển thị danh sách hồ sơ theo từng vấn đề, ngày gửi và trạng thái. Sinh viên có thể mở chi tiết để xem lại nội dung Profile + Approach đã gửi.
- Giao diện hồ sơ nhận được của doanh nghiệp: Hiển thị danh sách các nhóm đã gửi hồ sơ vào vấn đề của doanh nghiệp. Người dùng có thể lọc theo trạng thái hoặc thời gian gửi, mở Profile, xem Approach và đánh dấu hồ sơ cần xem xét.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi nhóm sinh viên lưu bản nháp, hệ thống lưu nội dung và tệp đính kèm để nhóm tiếp tục chỉnh sửa mà chưa gửi đến doanh nghiệp. Khi nhấn “Gửi hồ sơ”, hệ thống kiểm tra các trường bắt buộc, quyền gửi của nhóm và trạng thái của vấn đề. Nếu hợp lệ, hồ sơ được lưu với trạng thái “Đã gửi”; tệp của phiên bản đó không thể sửa hoặc xóa.
Nếu thiếu dữ liệu hoặc vấn đề không còn nhận hồ sơ, hệ thống hiển thị thông báo và không thực hiện gửi. Khi doanh nghiệp mở hồ sơ, hệ thống hiển thị đúng phiên bản Profile + Approach đã gửi để đảm bảo nội dung được đánh giá nhất quán.
Doanh nghiệp chỉ được xem hồ sơ thuộc các vấn đề do mình đăng. Việc gửi hồ sơ không tự động tạo dự án chính thức hoặc phát sinh giao dịch thanh toán. Các trạng thái hồ sơ gồm “Bản nháp”, “Đã gửi”, “Đang xem xét”, “Được lựa chọn”, “Không được lựa chọn” và “Đã rút”.

### **6. Dữ liệu**
Module lưu mã hồ sơ, mã nhóm, mã vấn đề, nội dung Approach, phiên bản Profile tại thời điểm gửi, thời gian gửi và trạng thái hồ sơ. Dữ liệu được liên kết với hồ sơ nhóm và vấn đề tương ứng để doanh nghiệp có thể xem xét, so sánh và lựa chọn nhóm.

## **VII. Module doanh nghiệp lựa chọn nhóm sinh viên**

### **1. Mục đích**
Module này hỗ trợ doanh nghiệp đánh giá các Profile + Approach đã nhận, so sánh năng lực giữa các nhóm và lựa chọn nhóm phù hợp với vấn đề. Sau khi được lựa chọn, nhóm sinh viên có thể trao đổi với doanh nghiệp để làm rõ giải pháp và chuẩn bị giai đoạn xây dựng Prototype hoặc Solution Proposal.

### **2. Đối tượng sử dụng và quyền hạn**

- Doanh nghiệp: Xem xét và lựa chọn nhóm đối với các vấn đề do mình đăng.
- Nhóm sinh viên: Theo dõi trạng thái hồ sơ và kết quả lựa chọn.
- Quản trị viên: Hỗ trợ xử lý lỗi hoặc tranh chấp theo quyền được cấp.


### **3. Điểm truy cập chức năng**
Doanh nghiệp truy cập mục “Quản lý vấn đề”, chọn một vấn đề và mở mục “Hồ sơ nhận được”. Tại đây, doanh nghiệp có thể xem từng hồ sơ, so sánh các nhóm và thực hiện lựa chọn.

### **4. Giao diện**
Module gồm 2 giao diện chính:

- Giao diện danh sách và so sánh hồ sơ: Hiển thị tên vấn đề, trạng thái vấn đề và danh sách nhóm đã gửi hồ sơ. Thông tin mỗi nhóm gồm tên nhóm, chuyên ngành, kỹ năng, kinh nghiệm, Reputation nếu có và thời gian gửi. Doanh nghiệp có thể chọn “Xem Profile”, “Xem Approach”, “So sánh nhóm” hoặc “Đánh dấu cần xem xét”.
- Giao diện xác nhận lựa chọn nhóm: Hiển thị tên vấn đề và nhóm được chọn để doanh nghiệp kiểm tra trước khi xác nhận. Giao diện có thể cung cấp ô ghi chú hoặc lý do không lựa chọn để doanh nghiệp phản hồi cho các nhóm.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi doanh nghiệp chọn “So sánh nhóm”, hệ thống hiển thị các tiêu chí của những nhóm được chọn trên cùng một giao diện để hỗ trợ đánh giá. Khi doanh nghiệp đánh dấu hồ sơ cần xem xét, hệ thống cập nhật trạng thái xem xét nội bộ mà không làm thay đổi trạng thái hồ sơ của nhóm sinh viên.
Khi doanh nghiệp nhấn “Chọn nhóm”, hệ thống hiển thị hộp thoại xác nhận. Sau khi doanh nghiệp xác nhận, hệ thống kiểm tra quyền truy cập và trạng thái vấn đề. Nếu hợp lệ, hồ sơ của nhóm được chọn chuyển sang “Được lựa chọn”, các hồ sơ còn lại chuyển sang “Không được lựa chọn” và hệ thống thông báo kết quả cho các nhóm liên quan.
Trong phạm vi quy trình ban đầu, mỗi vấn đề chỉ có một nhóm được lựa chọn chính thức. Việc lựa chọn nhóm không đồng nghĩa với việc dự án đã chuyển sang giai đoạn Paid Implementation hoặc đã phát sinh giao dịch thanh toán.

### **6. Dữ liệu**
Module đọc thông tin vấn đề, hồ sơ Profile + Approach, thông tin nhóm và Reputation nếu có. Module ghi nhận mã vấn đề, mã nhóm được lựa chọn, thời gian lựa chọn, người thực hiện, trạng thái các hồ sơ và ghi chú phản hồi. Kết quả lựa chọn phải được đồng bộ giữa tài khoản doanh nghiệp và tài khoản nhóm sinh viên.

## **VIII. Module trao đổi giữa doanh nghiệp và nhóm sinh viên**

### **1. Mục đích**
Module này cung cấp kênh trao đổi giữa doanh nghiệp và nhóm sinh viên nhằm làm rõ yêu cầu, thảo luận Approach và phối hợp trong quá trình xem xét hoặc phát triển giải pháp. Các cuộc trò chuyện được gắn với vấn đề liên quan để hai bên dễ dàng theo dõi nội dung trao đổi.

### **2. Đối tượng sử dụng và quyền hạn**

- Doanh nghiệp: Trao đổi với nhóm sinh viên có liên quan đến vấn đề của mình.
- Nhóm sinh viên: Trao đổi với doanh nghiệp liên quan đến vấn đề hoặc hồ sơ của nhóm.
- Quản trị viên: Chỉ truy cập hoặc xử lý cuộc trò chuyện khi được phân quyền và có mục đích phù hợp với quy định của nền tảng.


### **3. Điểm truy cập chức năng**
Người dùng truy cập module thông qua mục “Tin nhắn” trên thanh điều hướng hoặc nút “Nhắn tin” tại trang chi tiết vấn đề và hồ sơ nhóm nếu hai bên được phép liên lạc. Sau khi doanh nghiệp lựa chọn nhóm, hai bên có thể mở cuộc trò chuyện gắn với vấn đề đó.

### **4. Giao diện**
Module gồm 2 giao diện chính:

- Giao diện danh sách cuộc trò chuyện: Hiển thị các cuộc trò chuyện mà người dùng tham gia, tên đối tượng trao đổi, vấn đề liên quan và trạng thái chưa đọc nếu hệ thống hỗ trợ. Người dùng có thể tìm kiếm hoặc lọc cuộc trò chuyện theo vấn đề và đối tượng.
- Giao diện nội dung trò chuyện: Hiển thị lịch sử tin nhắn, thời gian gửi và ô nhập nội dung. Giao diện có nút “Gửi” và chức năng đính kèm tệp nếu được triển khai. Trạng thái đã gửi hoặc đã đọc có thể được hiển thị nếu hệ thống hỗ trợ.


### **5. Luồng xử lý và phản hồi hệ thống**
Khi người dùng mở một cuộc trò chuyện, hệ thống tải lịch sử tin nhắn mà người dùng có quyền xem. Khi nhấn “Gửi”, hệ thống kiểm tra nội dung không được để trống, lưu tin nhắn và hiển thị tin nhắn trong cuộc trò chuyện của các bên tham gia.
Nếu người dùng đính kèm tệp, hệ thống kiểm tra định dạng, dung lượng và quyền truy cập trước khi lưu. Khi mở tin nhắn chưa đọc, hệ thống có thể cập nhật trạng thái đã đọc nếu chức năng này được hỗ trợ.
Người dùng không thuộc cuộc trò chuyện sẽ không được truy cập nội dung. Tin nhắn chỉ đóng vai trò trao đổi thông tin, không tự động được xem là hợp đồng, cam kết thanh toán hoặc xác nhận triển khai dự án.

### **6. Dữ liệu**
Module lưu mã cuộc trò chuyện, mã vấn đề liên quan, danh sách người tham gia, mã tin nhắn, người gửi, nội dung, tệp đính kèm, thời gian gửi và trạng thái đọc nếu có. Dữ liệu tin nhắn được liên kết với cuộc trò chuyện cụ thể và chỉ được hiển thị cho những người có quyền truy cập.

## Bình luận của người review

- **My Ái:** cái ni so với bảng MVP thì hơi nặng hấn hơi phức tạp xí. t nghĩ ban đầu bảng mvp mình làm sương sương đơn giản hoi
- **My Ái:** như ri: Trong MVP, nhóm sinh viên có thể được tạo bằng cách nhập tên nhóm, thông tin thành viên và kỹ năng. Chưa cần xây dựng hệ thống gửi lời mời và chuyển quyền trưởng nhóm phức tạp.
- **Lưu Nguyễn Phúc:** t thấy giờ đang có thời gian thì cứ làm thử coi sao
