# Triển khai Supabase và Vercel

Ứng dụng giữ nguyên Google/Firebase Authentication hiện tại. Dữ liệu nghiệp vụ được lưu trong Supabase, chỉ được API phía máy chủ truy cập bằng khóa bí mật.

## 1. Tạo cơ sở dữ liệu Supabase

1. Tạo một project Supabase ở region đã được đơn vị phê duyệt cho dữ liệu dân cư.
2. Mở **SQL Editor**, chạy tệp `supabase/migrations/20260818_create_app_records.sql`.
3. Trong **Settings → API Keys**, lấy Project URL và Secret key (hoặc legacy service_role key).
4. Không đưa khóa bí mật vào mã nguồn, biến `VITE_*`, hoặc trình duyệt.

## 2. Import dữ liệu hiện có

Lệnh sau thay thế dữ liệu trong bảng `app_records` bằng nội dung `data/data_store.json`. Hãy sao lưu project Supabase trước khi thực hiện.

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SECRET_KEY = "<secret-key>"
node scripts/migrate-data-to-supabase.mjs --confirm
```

Äá»ƒ nháº­p má»™t tệp sao lÆ°u JSON thay vÃ¬ `data/data_store.json`, dÃ¹ng `--source`:

```powershell
node scripts/migrate-data-to-supabase.mjs --source "C:\Users\Admin\Downloads\Sao_Luu_Toan_Bo_DB_Dan_Cu_20260818.json" --confirm
```

## 3. Triển khai Vercel

1. Đưa mã nguồn lên GitHub rồi import repository trong Vercel, hoặc chạy `npx vercel` tại thư mục dự án sau khi đăng nhập.
2. Vercel tự dùng `npm run build`, xuất Vite vào `dist`, và chạy các API tại `api/[...path].ts`.
3. Thêm các Environment Variables cho cả **Preview** và **Production**:

   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (hoặc `SUPABASE_SERVICE_ROLE_KEY`)
   - `APP_URL=https://<ten-mien-vercel>`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GEMINI_API_KEY` nếu dùng các tính năng tương ứng
   - `FIREBASE_API_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` nếu đang dùng Firebase Auth/Google Maps

4. Trong Google Cloud OAuth, thêm redirect URI: `https://<ten-mien-vercel>/api/auth/callback`.
5. Redeploy, đăng nhập thử bằng một email đã cấp quyền và kiểm tra trạng thái Supabase trong trang Quản trị. API yêu cầu Firebase ID token nên mở trực tiếp URL API sẽ trả về `401`.

Tệp `vercel.json` đã giữ fallback cho SPA; các endpoint `/api/*` được Vercel Functions ưu tiên trước fallback này.
