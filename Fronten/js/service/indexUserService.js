const channel = new BroadcastChannel("eventChannel");

$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`;

  // 🟢 Nhận sự kiện & thời gian delay từ index.html
  channel.onmessage = function (event) {
    const { eventId, delayTime } = event.data;

    if (eventId) {
      // 🟢 Lưu ID sự kiện & thời gian delay vào localStorage
      localStorage.setItem("selectedEventId", eventId);
      localStorage.setItem("selectedDelayTime", delayTime);

      // 🟢 Load slideshow với thời gian delay nhận được
      loadSlideshow(eventId, delayTime);
    }
  };

  // 🟢 Khi tải lại trang, lấy sự kiện & thời gian từ localStorage
  const savedEventId = localStorage.getItem("selectedEventId");
  const savedDelayTime = localStorage.getItem("selectedDelayTime") || 3; // Mặc định 3s nếu chưa có

  if (savedEventId) {
    loadSlideshow(savedEventId, savedDelayTime);
  }

  function loadSlideshow(eventId, delayTime) {
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
          interval: delayTime * 1000, // Chuyển giây sang mili-giây
          ride: "carousel",
        });

        // console.log(`Trang nhận: Slideshow chạy với delay ${delayTime} giây`);
      },
      error: function () {
        alert("Lỗi khi tải ảnh sự kiện!");
      },
    });
  }
  //Load ảnh từ API
  const currentYear = new Date().getFullYear();
  const validYears = [currentYear, currentYear - 1]; // Chỉ lấy 2 năm gần nhất
  const lightbox = new bootstrap.Modal($("#lightbox")); // Khởi tạo modal Bootstrap

  let imagesList = []; // Danh sách ảnh hiện tại
  let currentIndex = 0; // Vị trí ảnh đang xem trong lightbox

  $.ajax({
    url: `${BASE_URL}/api/v1/Images/get`,
    type: "GET",
    dataType: "json",
    success: function (response) {
      renderEvents(response);
    },
    error: function (error) {
      console.log("Error fetching data:", error);
    },
  });

  function renderEvents(data) {
    $(".event-list").empty(); // Xóa nội dung cũ

    Object.keys(data).forEach((eventId) => {
      const event = data[eventId];
      let eventHtml = `
                <div class="m-5">
                    <h2>${event.name}</h2>
                    <div class="row">
            `;

      let hasValidYear = false; // Kiểm tra sự kiện có ảnh hợp lệ không

      validYears.forEach((year) => {
        if (event.years[year] && event.years[year].length > 0) {
          hasValidYear = true;
          eventHtml += `
                        <div class="year-section">
                            <h4 class="year-title m-3 ms-0">${year}</h4>
                            <div id="year-${year}" class="row images-container">
                    `;

          event.years[year].forEach((image) => {
            imagesList.push({
              id: image.id,
              src: `${BASE_URL}/uploads/${image.path}`,
              description: image.description || "Không có mô tả",
            });

            eventHtml += `
                            <div class="image-item col-xxl-1-5 col-xl-2 col-lg-3 col-md-4 col-sm-6 p-2" data-id="${
                              image.id
                            }">
                                <div class="card shadow-sm">
                                    <img src="${BASE_URL}/uploads/${
              image.path
            }" class="card-img-top" alt="Image">
                                    <div class="card-body">
                                        <p class="card-text text-start description">
                                            ${
                                              image.description ||
                                              "Không có mô tả"
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `;
          });

          eventHtml += `</div></div>`; // Đóng div của year-section
        }
      });

      eventHtml += `</div></div>`; // Đóng div của event

      if (hasValidYear) {
        $(".event-list").append(eventHtml);
      }
    });

    // Kích hoạt Lightbox khi click vào ảnh
    $(".image-item").click(function () {
      const imgId = $(this).data("id");
      openLightbox(imgId);
    });
  }

  // Mở lightbox
  function openLightbox(imgId) {
    currentIndex = imagesList.findIndex((img) => img.id == imgId);
    updateLightbox();
    lightbox.show();
  }

  // Cập nhật ảnh trong lightbox
  function updateLightbox() {
    if (currentIndex >= 0 && currentIndex < imagesList.length) {
      $("#lightbox-img").attr("src", imagesList[currentIndex].src);
    }
  }

  // Sự kiện nút Next
  $("#next-btn").click(function () {
    if (currentIndex < imagesList.length - 1) {
      currentIndex++;
      updateLightbox();
    }
  });

  // Sự kiện nút Prev
  $("#prev-btn").click(function () {
    if (currentIndex > 0) {
      currentIndex--;
      updateLightbox();
    }
  });

  let eventsByYear = {}; // 🔹 Biến toàn cục lưu trữ danh sách sự kiện theo năm
  // Xử lý sự kiện lấy toàn bộ danh sách sự kiện
  $.ajax({
    url: `${BASE_URL}/api/v1/Events/get`,
    method: "GET",
    dataType: "json",
    success: function (response) {
      eventsByYear = response; // ✅ Lưu vào biến toàn cục
      renderEvents1(eventsByYear);
    },
    error: function () {
      console.error("Error fetching events");
    },
  });
  // Hàm render danh sách sự kiện
  function renderEvents1(eventsByYear) {
    const eventListContainer = $("#event-list");
    eventListContainer.empty();

    if (Object.keys(eventsByYear).length === 0) {
      eventListContainer.html(
        "<p class='text-center'>Không có sự kiện nào.</p>"
      );
      return;
    }

    Object.keys(eventsByYear)
      .sort((a, b) => b - a)
      .forEach((year) => {
        const yearSection = `
            <div class="year-section">
              <h3 class="year-title">${year}</h3>
              <div class="row event-container"></div>
            </div>`;
        eventListContainer.append(yearSection);

        const eventRow = eventListContainer.find(".event-container").last();

        eventsByYear[year].forEach((event) => {
          $.ajax({
            url: `${BASE_URL}/api/v1/Images/getbyevent/${event.id}`,
            method: "GET",
            dataType: "json",
            success: function (imagesByYear) {
              const sortedYears = Object.keys(imagesByYear).sort(
                (a, b) => b - a
              );
              let imageUrl = "assets/img/default.png";

              if (
                sortedYears.length > 0 &&
                imagesByYear[sortedYears[0]].length > 0
              ) {
                imageUrl = `${baseImageUrl}${
                  imagesByYear[sortedYears[0]][0].path
                }`;
              }
              const eventItem = `
                        <div id="${event.id}" class="event-item col-xl-3 col-md-4 col-sm-6 mb-4">
                          <div class="card h-100 d-flex flex-column">
                            <img src="${imageUrl}" class="card-img-top event-image" alt="${event.name}" />
                            <div class="card-body d-flex flex-column">
                              <h5 class="card-title event-title">${event.name}</h5>
                              <p class="card-text event-description">${event.description}</p>
                              <div class="mt-auto d-flex justify-content-center gap-2">
                                <a href="detail-event.html?eventId=${event.id}" class="btn btn-outline-primary btn-sm"
                    title="Xem danh sách ảnh" >
                    <i class="fa-solid fa-eye"></i>
                  </a>
                  <button
                    id="presentEvent"
                    class="presentEvent btn btn-outline-success btn-sm"
                    title="Trình chiếu sự kiện"
                  >
                    <i class="fas fa-play"></i>
                  </button>
                              </div>
                            </div>
                          </div>
                        </div>`;
              eventRow.append(eventItem);
            },
            error: function () {
              console.error(`Lỗi lấy ảnh từ sự kiện: ${event.id}`);
            },
          });
        });
      });
  }
});
