$(document).ready(function () {
  // ✅ Đổi mật khẩu
  $("#changePasswordForm").submit(function (event) {
    event.preventDefault(); // Ngăn chặn reload trang

    // Lấy dữ liệu từ form
    const oldPassword = $("#currentPassword").val();
    const newPassword = $("#newPassword").val();
    const confirmPassword = $("#confirmPassword").val();

    // Kiểm tra xác nhận mật khẩu
    if (newPassword !== confirmPassword) {
      alert("Mật khẩu mới và xác nhận mật khẩu không khớp!");
      return;
    }

    // Gửi yêu cầu đổi mật khẩu
    $.ajax({
      url: `${BASE_URL}/api/v1/Users/change-password`,
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        oldPassword: oldPassword, // Truyền đúng key theo API yêu cầu
        newPassword: newPassword,
      }),
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"), // 🛡️ Thêm token xác thực nếu có
      },
      success: function (response) {
        alert("Đổi mật khẩu thành công!");
        $("#changePasswordForm")[0].reset(); // Reset form
      },
      error: function (xhr) {
        alert("Lỗi: " + xhr.responseJSON?.message || "Đổi mật khẩu thất bại!");
      },
    });
  });
  // ✅ Reset mật khẩu
  $("#resetPasswordButton").click(function () {
    const username = localStorage.getItem("username"); // 📌 Lấy username từ localStorage
    if (!username) {
      alert("Không tìm thấy username! Vui lòng đăng nhập lại.");
      return;
    }

    $.ajax({
        url: `${BASE_URL}/api/v1/Users/reset-password`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({ username }),
        success: function (response) {
            // 🟢 Hiển thị mật khẩu mới trong modal
            $("#viewPassword .modal-body").html(`<strong>Mật khẩu mới là: ${response.newPassword}</strong>`);
            $("#viewPassword").modal("show");
        },
        error: function (xhr) {
            alert("Lỗi: " + (xhr.responseJSON?.message || "Không thể đặt lại mật khẩu!"));
            $("#viewPassword .modal-body").html(`<strong>Lỗi reset mật khẩu!</strong>`);
        }
    });
  });
});
