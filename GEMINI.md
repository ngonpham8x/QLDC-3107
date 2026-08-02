# HƯỚNG DẪN ĐẦY ĐỦ VỀ CẤU TRÚC VÀ TÍNH NĂNG ỨNG DỤNG (BLUEPRINT)
## ỨNG DỤNG: QUẢN LÝ DÂN CƯ TỔ DÂN PHỐ / KHU PHỐ NINH PHÚ

Tài liệu này đóng vai trò là prompt thông số chi tiết (specification prompt) hoàn chỉnh mô tả toàn bộ kiến trúc, giao diện, dữ liệu và nghiệp vụ của ứng dụng Full-Stack sau các đợt nâng cấp mới nhất. Được lưu trữ để làm tài liệu tham chiếu tái cấu trúc hoặc phục hồi hệ thống.

---

### 1. TỔNG QUAN & PHẠM VI NGHIỆP VỤ (SCOPE)
Hệ thống là giải pháp Full-Stack (React 18 + Vite + Tailwind CSS + Node.js/Express) phục vụ công tác quản lý cư dân, hộ gia đình, nhân khẩu, y tế, giáo dục, lao động, hộ kinh doanh và đánh giá tiêu chí đô thị văn minh/nông thôn mới cấp cơ sở (Tổ dân phố, Thôn, Ấp, Khu phố) tại Việt Nam.

Hệ thống hoạt động offline-first với dữ liệu được đồng bộ và lưu trữ bền vững tại file JSON server-side (`/src/data_store.json`), đảm bảo không mất dữ liệu khi trình duyệt xóa cache. 

Đặc biệt, hệ thống tích hợp khả năng hoạt động ngoại tuyến (offline) hoàn chỉnh:
- **Tự động phát hiện trạng thái mạng**: Sử dụng các listener sự kiện hệ thống và cơ chế ping ngầm định kỳ 15 giây để cập nhật trạng thái kết nối thời gian thực.
- **Bộ nhớ đệm ngoại tuyến (Offline cache)**: Dữ liệu tải về được lưu trữ trực tiếp vào LocalStorage của trình duyệt. Khi mất kết nối, hệ thống sẽ tự động chuyển sang đọc từ cache này.
- **Hàng đợi đồng bộ (Sync Queue)**: Toàn bộ thao tác thay đổi dữ liệu (thêm, sửa, xoá) khi offline sẽ được lưu vào hàng đợi và cập nhật tức thì lên giao diện. Khi phát hiện thiết bị trực tuyến trở lại, hệ thống tự động đồng bộ tuần tự các hành động này lên máy chủ và tải lại dữ liệu sạch.
- **Giao diện Giám sát Trực quan**: Hiển thị bảng điều khiển kết nối (Trực tuyến/Ngoại tuyến) kèm danh sách các thao tác đang chờ xử lý và nút bấm cưỡng bức đồng bộ thủ công.

---

### 2. PHÂN QUYỀN & HỆ THỐNG XÁC THỰC (AUTHENTICATION)
Hệ thống hỗ trợ 3 vai trò người dùng (Roles):
- **SUPER_ADMIN (Quản trị viên cấp cao)**: Toàn quyền quản trị hệ thống, xuất bản dự phòng, xóa sạch dữ liệu mẫu, cấu hình tiêu chí.
- **WARD_LEADER (Trưởng khu phố / Tổ trưởng)**: Thêm/sửa hộ gia đình, nhân khẩu, ghi nhận biến động, cập nhật tiêu chí đô thị văn minh.
- **COLLABORATOR (Cộng tác viên nhập liệu)**: Xem dữ liệu, thêm mới nhân khẩu dưới dạng bản nháp hoặc thực hiện khảo sát y tế/lao động cơ sở.

#### Các phương thức đăng nhập:
1. **Google OAuth thực tế (Cấu hình linh hoạt)**:
   - Nếu có `GOOGLE_CLIENT_ID` hợp lệ, hệ thống sử dụng luồng OAuth chuẩn của Google. Vai trò mong muốn (Role) được mã hóa qua tham số `state` để gán quyền chính xác khi callback về server.
   - Nếu chưa cấu hình Client ID, hệ thống tự động điều hướng sang màn hình giả định thông minh để phục vụ demo.
2. **Xác thực số điện thoại bằng mã OTP thực tế (SMS Gateway mô phỏng)**:
   - Cán bộ nhập số điện thoại định dạng 10 chữ số (bắt đầu bằng số 0).
   - Server sinh **mã OTP 6 số ngẫu nhiên** (sử dụng toán tử ngẫu nhiên thực tế), lưu trữ tạm thời tại bộ nhớ `activeOtps` trên Node.js.
   - Mã OTP được in ra console của Server và hiển thị trực quan ngay trên hộp thoại thông báo màu xanh ngọc (Emerald) của Client để người dùng nhập chính xác, loại bỏ hoàn toàn cơ chế nhập mã tĩnh "123456" dễ trùng lặp.

---

### 3. KIẾN TRÚC DỮ LIỆU (DATA SCHEMAS)
Dữ liệu lưu trữ trong `/src/data_store.json` bao gồm các cấu trúc chính:

#### A. Hộ gia đình (Household):
- `id`: Mã định danh (ví dụ: `HH-168...`)
- `ownerName`: Họ tên chủ hộ
- `address`: Số nhà, đường/hẻm (được server tự động phân tích để tách riêng số Tổ dân phố, ví dụ: "Tổ 3")
- `wardId`: Mã Khu phố/Tổ dân phố
- `phone`: Số điện thoại liên hệ
- `hasCleanWater`: Trạng thái nước sạch (Có/Không)
- `wasteStatus`: Trạng thái thu gom rác thải (Thu gom định kỳ/Chưa đăng ký)
- `isPoor`: Diện hộ nghèo/cận nghèo/bình thường
- `isAgri`: Hộ sản xuất nông nghiệp (Có/Không)

#### B. Nhân khẩu (Resident):
- `id`: Mã định danh nhân khẩu
- `householdId`: Liên kết tới `Household.id`
- `fullName`: Họ và tên đầy đủ
- `cccd`: Số định danh cá nhân/CCCD (12 số hoặc trống)
- `relationToOwner`: Quan hệ với chủ hộ (Chủ hộ, Vợ, Chồng, Con, Cháu, v.v.)
- `birthDate`: Ngày tháng năm sinh (YYYY-MM-DD)
- `gender`: Giới tính (Nam/Nữ)
- `permanentAddress`: Địa chỉ thường trú
- `temporaryAddress`: Địa chỉ tạm trú (nếu có)
- `education`: Trình độ học vấn (Chưa đào tạo, Tốt nghiệp THPT, Trung cấp, Cao đẳng, Đại học, Sau đại học)
- `occupation`: Nghề nghiệp thực tế (hoặc "Đã qua đời", "Học sinh/Sinh viên")
- `isStudent`: Cờ xác nhận học sinh/sinh viên
- `hasHealthInsurance`: Có thẻ Bảo hiểm y tế (BHYT) hay không
- `isDisabled`: Có khuyết tật/nhận trợ cấp khuyết tật không
- `isPregnant`: Trạng thái thai sản (áp dụng cho nữ)
- `subsidyType`: Loại trợ cấp nhận hàng tháng (nếu có)
- `notes`: Ghi chú thêm

#### C. Biến động nhân khẩu (Demographic Change):
- `id`, `residentId`, `residentName`, `type` (Khai sinh, Khai tử, Tạm vắng, Chuyển đi, Chuyển đến), `date`, `reason`, `approvedBy`.

#### D. Hộ kinh doanh cá thể (Business Household):
- `id`, `name` (Tên tiệm/cơ sở), `ownerName`, `businessType` (Ăn uống, Tạp hóa, Dịch vụ, Gia công, v.v.), `taxCode`, `revenueClass` (Dưới ngưỡng thuế, Khoán doanh thu, v.v.).

#### E. Tiêu chí Đô thị văn minh / Nông thôn mới (Rural Criteria):
- Định nghĩa bộ chỉ số khảo sát chất lượng cuộc sống (Nước sạch, Rác thải, BHYT toàn dân, Phổ cập giáo dục, An ninh trật tự) kèm điểm số và trạng thái Đạt/Chưa đạt.

---

### 4. CÁC TÍNH NĂNG TRÊN GIAO DIỆN CHÍNH (FRONTEND DASHBOARD)
Giao diện được thiết kế hiện đại, thoáng đãng theo phong cách hành chính điện tử mới với tông màu trắng tinh tế phối hợp xanh lục bảo (Emerald) và xanh đại dương (Blue).

#### A. Tab 1: Tổng quan (Dashboard):
- **Bảng thống kê nhanh (KPI Cards)**: Hiển thị tổng số hộ dân, tổng số nhân khẩu thực tế, số hộ kinh doanh, và tỷ lệ phần trăm đạt chuẩn văn minh.
- **Biểu đồ phân tích cấu trúc**:
  - Biểu đồ hình quạt (Pie Chart) vẽ bằng SVG trực quan thể hiện tỉ lệ nhóm tuổi (Thiếu nhi, Lao động, Cao tuổi).
  - Khối thống kê đa chiều: Thai sản, Khuyết tật, Nhận trợ cấp, Bảo hiểm y tế.
- **Bộ lọc đa chiều thời gian thực (Multi-dimensional Filter & Search)**:
  - Lọc nhân khẩu theo nhóm đặc thù: Độ tuổi nghĩa vụ quân sự (Nam 18-27), Người cao tuổi (>= 60), Trẻ em (< 15), Lao động tự do/thất nghiệp, Hộ nghèo, Đã có BHYT, Thành viên hộ nông nghiệp.
  - Lọc theo giới tính, khu vực Tổ dân phố.
  - Ô tìm kiếm tức thì theo Họ tên hoặc CCCD.
- **Nút xuất báo cáo và in**: Tích hợp nút xuất dữ liệu lọc ra danh sách và hỗ trợ in trực tiếp từ trình duyệt (`window.print`).

#### B. Tab 2: Quản lý Hộ gia đình & Nhân khẩu chi tiết:
- Giao diện danh bạ chia đôi (Split View) hoặc dạng thẻ (Grid Card) hiển thị thông tin chi tiết từng hộ.
- Cho phép thêm mới, sửa đổi thông tin hộ gia đình, tự động tính toán quy đổi địa chỉ.
- Thêm mới thành viên trực tiếp vào hộ gia đình với form nhập liệu đầy đủ các chỉ số an sinh xã hội.

#### C. Tab 3: Khảo sát Tiêu chí Văn minh:
- Liệt kê các tiêu chí cụ thể (ví dụ: Tỷ lệ dùng nước sạch đạt 100%, Phổ cập giáo dục THCS đạt 98%, v.v.).
- Tự động quét toàn bộ dữ liệu thực tế từ cơ sở dữ liệu để kiểm tra và cập nhật trạng thái tự động hoặc cho phép cán bộ đánh giá bằng tay.

#### D. Tab 4: Trợ lý AI Phân tích (Gemini Assistant):
- Tích hợp cổng Chatbot AI gọi trực tiếp tới Gemini API phía server-side.
- Trợ lý AI có khả năng truy vấn sâu vào dữ liệu dân cư thực tế hiện có để trả lời các câu hỏi như: "Khu phố có bao nhiêu người cao tuổi chưa có thẻ BHYT?", "Gợi ý các hộ gia đình cần hỗ trợ quà Tết khó khăn", "Lập báo cáo tổng quan về tình hình lao động tự do".

---

### 5. CÔNG CỤ QUẢN TRỊ & KHỞI TẠO HỆ THỐNG MỚI (ADMIN TOOLS)
Để hệ thống sẵn sàng chuyển giao từ môi trường thử nghiệm sang vận hành thực tế tại các địa phương, ứng dụng trang bị các nút chức năng cực kỳ quan trọng ở thanh tiêu đề/tiêu điểm:

1. **Khởi tạo dữ liệu mẫu (Generate Mock Data)**:
   - Tự động sinh ngẫu nhiên 25 hộ gia đình mẫu và 105 nhân khẩu đa dạng lứa tuổi, nghề nghiệp để trình diễn tính năng phân tích và lọc nâng cao.
2. **Sao lưu & Dự phòng dữ liệu (Full Backup Export)**:
   - Cho phép tải xuống toàn bộ dữ liệu dưới dạng tệp tin sao lưu cấu trúc để lưu trữ ngoại tuyến và phục hồi khi cần thiết.

---

### 6. KHỞI ĐỘNG VÀ VẬN HÀNH (RUN SCRIPTS)
Các lệnh cấu hình trong `package.json` đảm bảo quá trình build và start đồng bộ:
- **Chế độ phát triển (Development)**: `tsx server.ts` (Sử dụng Vite middleware tích hợp xử lý hot-reloading).
- **Biên dịch (Build)**: `vite build` cho client và `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/server.cjs` để đóng gói server thành một file CommonJS duy nhất tối ưu hóa hiệu năng.
- **Chế độ sản xuất (Production Start)**: `node dist/server.cjs` lắng nghe tại cổng `3000` trên host `0.0.0.0`.
