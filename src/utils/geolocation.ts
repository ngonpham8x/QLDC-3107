/**
 * Lấy vị trí GPS hiện tại một cách tin cậy với cơ chế thử lại (Fallback)
 * 1. Thử High Accuracy (GPS) trước (timeout 5s)
 * 2. Nếu thất bại / timeout, tự động chuyển sang Low Accuracy (Wi-Fi/Cell) (timeout 8s)
 * 3. Báo lỗi thân thiện nếu bị chặn quyền hoặc chạy trong iFrame
 */

export interface GpsCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

export function getCurrentGpsLocation(
  onSuccess: (coords: GpsCoordinates) => void,
  onError?: (errorMessage: string) => void
) {
  if (!navigator.geolocation) {
    const msg = "Trình duyệt của bạn không hỗ trợ chức năng định vị GPS.";
    if (onError) onError(msg);
    else alert(msg);
    return;
  }

  // Thử lần 1: High Accuracy
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
        accuracy: position.coords.accuracy,
      });
    },
    (firstErr) => {
      console.warn("High accuracy GPS failed, falling back to network positioning:", firstErr.message);

      // Thử lần 2: Low Accuracy (sử dụng định vị mạng Wi-Fi/Trạm phát sóng, phản hồi cực nhanh)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onSuccess({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
            accuracy: position.coords.accuracy,
          });
        },
        (secondErr) => {
          console.error("All geolocation attempts failed:", secondErr);
          let userNotice = "Không thể tự động lấy vị trí GPS hiện tại.";

          if (secondErr.code === 1) { // PERMISSION_DENIED
            userNotice = "Quyền vị trí bị từ chối. Vui lòng cho phép ứng dụng truy cập Vị trí (GPS) trong cài đặt trình duyệt/điện thoại hoặc bấm 'Mở trong tab mới'.";
          } else if (secondErr.code === 2) { // POSITION_UNAVAILABLE
            userNotice = "Vị trí không khả dụng. Vui lòng bật GPS trên thiết bị hoặc bấm nút 'Chọn bản đồ' để ghim vị trí.";
          } else if (secondErr.code === 3) { // TIMEOUT
            userNotice = "Quá thời gian chờ tín hiệu GPS. Vui lòng chọn vị trí trực tiếp trên bản đồ.";
          }

          if (onError) {
            onError(userNotice);
          } else {
            alert(userNotice);
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
}
