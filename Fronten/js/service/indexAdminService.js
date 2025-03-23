$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`;

  // 🟢 1. Gọi API lấy danh sách sự kiện và hiển thị event đầu tiên
  $.ajax({
    url: `${BASE_URL}/api/v1/Events/get`,
    method: "GET",
    dataType: "json",
    success: function (eventsByYear) {
      const eventSelect = $("#eventSelect");
      let firstEventId = null;

      Object.values(eventsByYear).forEach((events) => {
        events.forEach((event) => {
          eventSelect.append(
            `<option value="${event.id}">${event.name}</option>`
          );
          if (firstEventId === null) firstEventId = event.id;
        });
      });

      // 🟢 Nếu có sự kiện trong localStorage, dùng nó, nếu không dùng sự kiện đầu tiên
      const savedEventId =
        localStorage.getItem("selectedEventId") || firstEventId;
      eventSelect.val(savedEventId);
      loadSlideshow(savedEventId);
    },
    error: function () {
      alert("Lỗi khi tải danh sách sự kiện!");
    },
  });

  // 🟢 Xử lý khi nhấn "Trình Chiếu"
  const channel = new BroadcastChannel("eventChannel");

  $("#btnShowSlideshow").on("click", function () {
    const eventId = $("#eventSelect").val();
    const delayTime = $("#timeSelect").val() || 3; // Nếu không chọn, mặc định 3s

    if (!eventId) {
      alert("Vui lòng chọn một sự kiện!");
      return;
    }

    // 🟢 Lưu ID sự kiện & thời gian vào localStorage
    localStorage.setItem("selectedEventId", eventId);
    localStorage.setItem("selectedDelayTime", delayTime);

    // 🟢 Gửi thông báo đến index_user.html
    channel.postMessage({ eventId, delayTime });

    // 🟢 Hiển thị slideshow trên index.html
    loadSlideshow(eventId, delayTime);
  });

  function loadSlideshow(eventId, delayTime = 3) {
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

        $(".carousel-inner").empty();
        $(".carousel-indicators").empty();

        images.forEach((image, index) => {
          const activeClass = index === 0 ? "active" : "";
          const match = image.path.match(/^(\d{4})_/);
          const year = match ? match[1] : "Không xác định";

          $(".carousel-indicators").append(`
          <button type="button" data-bs-target="#demo" data-bs-slide-to="${index}" class="${activeClass}"></button>
        `);

          $(".carousel-inner").append(`
          <div class="carousel-item ${activeClass}" data-bs-interval="${
            delayTime * 1000
          }">
            <img src="${baseImageUrl}${
            image.path
          }" class="carousel-img" alt="Ảnh sự kiện">
            <div class="carousel-caption">
              <h3>${year}</h3>
              <p>${image.description || "Không có mô tả"}</p>
            </div>
          </div>
        `);
        });

        // 🟢 Cập nhật thời gian chuyển slide theo thời gian đã chọn
        $("#demo").carousel({
          interval: delayTime * 1000, // Convert giây thành mili-giây
          ride: "carousel",
        });

        // console.log(`Slideshow sẽ chạy với delay ${delayTime} giây`);
      },
      error: function () {
        alert("Lỗi khi tải ảnh sự kiện!");
      },
    });
  }

  // 🟢 Khi thay đổi timeSelect, cập nhật giá trị vào localStorage
  $("#timeSelect").on("change", function () {
    const delayTime = $(this).val();
    localStorage.setItem("selectedDelayTime", delayTime);
  });
});
