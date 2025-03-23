$(document).ready(function () {
    $("#login-btn").click(function (event) {
        event.preventDefault(); // Ngăn form reload trang

        const username = $("#username").val().trim();
        const password = $("#password").val().trim();

        if (!username || !password) {
            alert("Vui lòng nhập đầy đủ thông tin!");
            return;
        }

        // Kiểm tra nếu BASE_URL chưa được định nghĩa
        if (typeof BASE_URL === "undefined") {
            console.error("⚠ Lỗi: BASE_URL chưa được định nghĩa!");
            alert("Có lỗi xảy ra, vui lòng thử lại sau!");
            return;
        }

        $.ajax({
            url: `${BASE_URL}/api/v1/Users/login`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ username, password }),
            success: function (response) {
                console.log("✅ Đăng nhập thành công!", response);

                if (response && response.accessToken && response.refreshToken) {
                    // Lưu token vào localStorage
                    localStorage.setItem("accessToken", response.accessToken);
                    localStorage.setItem("refreshToken", response.refreshToken);
                    localStorage.setItem("username", username);

                    //alert("Đăng nhập thành công!");
                    window.location.href = "index.html"; // Chuyển hướng sau khi login
                } else {
                    alert("Lỗi phản hồi từ máy chủ!");
                }
            },
            error: function (xhr) {
                console.error("❌ Lỗi đăng nhập:", xhr);

                if (xhr.status === 401) {
                    alert("Sai tài khoản hoặc mật khẩu!");
                } else if (xhr.status === 404) {
                    alert("API không tồn tại, kiểm tra lại URL!");
                } else {
                    alert("Đã xảy ra lỗi, vui lòng thử lại!");
                }
            }
        });
    });
});
