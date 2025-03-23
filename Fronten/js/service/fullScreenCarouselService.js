$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`;

  // 🟢 Sự kiện khi nhấn nút "Show highlight event"
  $("#btnShowHighLightEvent").click(function () {
    const eventId = localStorage.getItem("selectedEventId");
    let delayTime = localStorage.getItem("selectedDelayTime") || 3; // Mặc định 3s

    if (!eventId) {
      alert("Không có sự kiện nổi bật nào được chọn!");
      return;
    }

    // Gọi hàm chung để hiển thị sự kiện trong Carousel Fullscreen
    fetchAndShowEventImages(eventId, delayTime);
  });

  // 🟢 Sự kiện khi nhấn nút "Trình chiếu sự kiện"
  $(document).on("click", ".btn-outline-success", function () {
    let eventId = $(this).closest(".event-item").attr("id"); // Lấy eventId từ div cha
    let delayTime = localStorage.getItem("selectedDelayTime") || 3; // Mặc định 3s

    // Gọi hàm chung để hiển thị sự kiện trong Carousel Fullscreen
    fetchAndShowEventImages(eventId, delayTime);
  });

  // 🟢 Hàm chung: Gọi API và hiển thị ảnh lên Carousel Fullscreen
  function fetchAndShowEventImages(eventId, delayTime) {
    $.ajax({
      url: `${BASE_URL}/api/v1/Images/getbyevent/${eventId}`,
      method: "GET",
      dataType: "json",
      success: function (imagesByYear) {
        const sortedYears = Object.keys(imagesByYear).sort((a, b) => b - a);
        const images = sortedYears.flatMap((year) => imagesByYear[year]);

        if (images.length === 0) {
          alert("Không có ảnh nào trong sự kiện này!");
          return;
        }

        // Cập nhật ảnh vào Carousel Fullscreen
        updateCarousel(images, delayTime);
        $("#fullscreen-carousel").removeClass("d-none");
        $("body").css("overflow", "hidden"); // Ngăn cuộn trang khi carousel hiển thị
      },
      error: function () {
        alert("Lỗi khi tải ảnh sự kiện!");
      },
    });
  }

  // 🟢 Hàm cập nhật Carousel Fullscreen với ảnh mới
  function updateCarousel(images, delayTime) {
    let carouselInner = $("#eventCarousel .carousel-inner");
    let carouselIndicators = $("#eventCarousel .carousel-indicators");

    // 🟢 Xóa nội dung cũ
    carouselInner.empty();
    carouselIndicators.empty();

    // 🟢 Thêm ảnh mới vào carousel
    images.forEach((image, index) => {
      let activeClass = index === 0 ? "active" : "";
      let match = image.path.match(/^(\d{4})_/);
      let year = match ? match[1] : "Không xác định";

      // Thêm indicator
      carouselIndicators.append(`
                <button type="button" data-bs-target="#eventCarousel" data-bs-slide-to="${index}" 
                        class="${activeClass}" aria-label="Slide ${
        index + 1
      }"></button>
            `);

      // Thêm ảnh vào carousel
      carouselInner.append(`
                <div class="carousel-item ${activeClass} h-100" data-bs-interval="${
        delayTime * 1000
      }">
                    <img src="${baseImageUrl}${
        image.path
      }" class="d-block w-100 h-100 object-fit-cover" alt="Ảnh sự kiện">
                    <div class="carousel-caption">
                        <h3>${year}</h3>
                        <p>${image.description || "Không có mô tả"}</p>
                    </div>
                </div>
            `);
    });

    // 🟢 Cập nhật thời gian chuyển slide theo `delayTime`
    $("#eventCarousel").attr("data-bs-interval", delayTime * 1000);
    new bootstrap.Carousel(document.getElementById("eventCarousel"), {
      interval: delayTime * 1000,
      ride: "carousel",
    });
  }

  // 🟢 Đóng Carousel Fullscreen
  $("#closeCarousel").click(function () {
    $("#fullscreen-carousel").addClass("d-none");
    $("body").css("overflow", "auto"); // Cho phép cuộn lại sau khi đóng
  });
});
