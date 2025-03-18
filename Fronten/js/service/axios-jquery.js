const BASE_URL = "https://localhost:44337"; // Đổi thành URL backend của bạn
let isRefreshing = false;
let refreshSubscribers = [];

// Hàm thêm request vào hàng đợi khi đang refresh token
function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

// Hàm gọi lại các request khi refresh hoàn thành
function onRefreshed(token) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

// Thiết lập jQuery AJAX để tự động thêm accessToken vào request
$.ajaxSetup({
  beforeSend: function (xhr) {
    const token = localStorage.getItem("accessToken");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
  },
  error: function (xhr, status, error) {
    if (xhr.status === 401) {
      handleTokenExpiration(xhr);
    }
  },
});

// Hàm xử lý khi token hết hạn
function handleTokenExpiration(originalRequest) {
  if (!isRefreshing) {
    isRefreshing = true;
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      logoutUser();
      return;
    }

    // Gửi request làm mới token
    $.ajax({
      url: `${BASE_URL}/api/Auth/refresh-token`,
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        accessToken: localStorage.getItem("accessToken"),
        refreshToken: refreshToken,
      }),
      success: function (response) {
        const newAccessToken = response.data.accessToken;
        const newRefreshToken = response.data.refreshToken;

        // Lưu token mới
        localStorage.setItem("accessToken", newAccessToken);
        localStorage.setItem("refreshToken", newRefreshToken);

        // Thông báo các request đang chờ
        onRefreshed(newAccessToken);

        isRefreshing = false;
      },
      error: function () {
        logoutUser();
      },
    });
  }

  // Nếu đang refresh, đợi token mới rồi tiếp tục request
  return new Promise((resolve) => {
    subscribeTokenRefresh((token) => {
      originalRequest.headers["Authorization"] = `Bearer ${token}`;
      resolve($.ajax(originalRequest));
    });
  });
}

// Hàm logout nếu refresh token thất bại
function logoutUser() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.location.href = "/login.html";
}
