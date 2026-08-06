# HỆ THỐNG QUẢN LÝ DÂN CƯ TỔ DÂN PHỐ / KHU PHỐ NINH PHÚ (QLDC)

Ứng dụng quản lý dân cư, hộ gia đình, nhân khẩu, y tế, lao động, hộ kinh doanh và tiêu chí Đô thị văn minh / Nông thôn mới cấp cơ sở.

---

## 🛠️ HƯỚNG DẪN VẬN HÀNH VÀ TRIỂN KHAI SẢN XUẤT

### 1. Chạy Cục Bộ (Local Development)
- **Yêu cầu**: Node.js 20 trở lên & npm.
- **Bước 1**: Cài đặt thư viện:
  ```bash
  npm install
  ```
- **Bước 2**: Khởi tạo tệp môi trường `.env` từ mẫu `.env.example`:
  ```bash
  cp .env.example .env
  ```
- **Bước 3**: Chạy môi trường phát triển (Vite + Express Server):
  ```bash
  npm run dev
  ```
  Ứng dụng chạy tại: `http://localhost:3000`

---

### 2. Biên Dịch & Chạy Sản Xuất (Production Build)
- **Biên dịch mã nguồn**:
  ```bash
  npm run build
  ```
  *(Lệnh này sẽ build ứng dụng React client vào `dist/` và đóng gói Express server thành `dist/server.cjs`)*

- **Chạy Server Sản xuất**:
  ```bash
  npm start
  ```

---

### 3. Đóng Gói Docker (Docker Containerization)
- **Xây dựng Docker Image**:
  ```bash
  docker build -t qldc-ninhphu .
  ```
- **Khởi chạy Docker Container**:
  ```bash
  docker run -d -p 3000:3000 --env-file .env --name qldc-app qldc-ninhphu
  ```

---

### 4. Đẩy Mã Nguồn Lên GitHub & Cấu Hình CI/CD
- **Bước 1**: Khởi tạo Git repository và commit mã nguồn:
  ```bash
  git init
  git add .
  git commit -m "Initial commit - QLDC Ninh Phu Application"
  ```
- **Bước 2**: Liên kết với GitHub Repository và push mã nguồn:
  ```bash
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
  git push -u origin main
  ```
- **Tự động kiểm tra (GitHub Actions)**:
  Dự án đã tích hợp tệp cấu hình `.github/workflows/ci.yml` tự động kiểm tra `npm run lint` và `npm run build` mỗi khi gửi Pull Request hoặc Push code lên nhánh `main`.

---

## ⚙️ CẤU HÌNH BIẾN MÔI TRƯỜNG (.env)

Các biến môi trường tùy chọn cấu hình trong `.env`:
- `GEMINI_API_KEY`: Khóa API Gemini cho Trợ lý AI Copilot.
- `FIREBASE_API_KEY` & `VITE_FIREBASE_API_KEY`: Kết nối Firestore nếu bật đồng bộ đám mây.
- `GMAIL_USER` & `GMAIL_APP_PASSWORD`: SMTP gửi email thông báo cấp quyền.
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Đăng nhập Google OAuth.
- `VITE_GOOGLE_MAPS_API_KEY`: Tùy chọn hiển thị bản đồ Google GIS.
