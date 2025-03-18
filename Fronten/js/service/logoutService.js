$(document).ready(function () {
    $("#logout-btn").click(function () {
        // Lấy accessToken từ localStorage
        const accessToken = localStorage.getItem("accessToken");

        if (!accessToken) {
            alert("Bạn chưa đăng nhập!");
            return;
        }

        $.ajax({
            url: `${BASE_URL}/api/v1/Users/logout`, // Thay bằng đúng URL API logout
            type: "POST",
            contentType: "application/json",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            success: function (response) {
                console.log("✅ Đăng xuất thành công!", response);

                // Xóa token khỏi localStorage
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");

               // alert(response.message);
                window.location.href = "login.html"; // Chuyển về trang login
            },
            error: function (xhr) {
                console.error("❌ Lỗi khi đăng xuất:", xhr);
                alert("Đăng xuất thất bại, vui lòng thử lại!");
            },
        });
    });
});
