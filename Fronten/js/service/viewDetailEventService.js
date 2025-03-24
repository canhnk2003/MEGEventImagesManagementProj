$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`; // Đường dẫn ảnh
  let imagesList = []; // Lưu danh sách ảnh của sự kiện đang chọn
  let imagesListToPresent = []; // Lưu danh sách ảnh của sự kiện đang chọn để trình chiếu
  let currentIndex = 0; // Ảnh đang hiển thị trong Lightbox
  const lightbox = new bootstrap.Modal($("#lightbox")); // Bootstrap Modal

  // 🟢 Lấy `eventId` từ URL
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }
  const eventId = getQueryParam("eventId");

  if (!eventId) {
    alert("Không tìm thấy sự kiện!");
    return;
  }

  // 🟢 Lấy thông tin sự kiện
  $.ajax({
    url: `${BASE_URL}/api/v1/Events/get/${eventId}`,
    method: "GET",
    dataType: "json",
    success: function (event) {
      $("h3").text(event.name);
      $("p").text(event.description);
    },
    error: function () {
      alert("Lỗi khi tải thông tin sự kiện.");
    },
  });

  // 🟢 Lấy danh sách ảnh theo `eventId`
  $.ajax({
    url: `${BASE_URL}/api/v1/Images/getbyevent/${eventId}`,
    method: "GET",
    dataType: "json",
    success: function (imagesByYear) {
      const imageContainer = $("#listImageByEvent");
      imageContainer.empty();
      imagesList = []; // Reset danh sách ảnh

      if (Object.keys(imagesByYear).length === 0) {
        imageContainer.html(
          `<img src="assets/img/default.png" class="text-center w-25"/>`
        );
        return;
      }

      // 🔹 Hiển thị ảnh theo năm (sắp xếp giảm dần)
      Object.keys(imagesByYear)
        .sort((a, b) => b - a)
        .forEach((year) => {
          const yearId = `year-${year}`;
          const yearSection = `
          <div class="year-section">
            <h4 class="year-title m-3 ms-0">${year}</h4>
            <div id="${yearId}" class="row images-container"></div>
          </div>`;
          imageContainer.append(yearSection);

          const imagesRow = $(`#${yearId}`);

          imagesByYear[year].forEach((image) => {
            const imgSrc = `${baseImageUrl}${image.path}`;
            imagesList.push({
              id: image.id,
              src: imgSrc,
              description: image.description || "Không có mô tả",
            });

            // 🟢 Thêm `data-id` để mở đúng ảnh
            const imageItem = `
                <div class="image-item col-lg-3 col-md-4 col-sm-6 col-12 p-3" data-id="${image.id}">
                  <img src="${imgSrc}" class="img-fluid" alt="Image ${image.id}" />
                </div>`;
            imagesRow.append(imageItem);
          });
        });

      imagesListToPresent = imagesList;
      // 🟢 Kích hoạt Lightbox khi click vào ảnh
      $(".image-item").click(function () {
        const imgId = $(this).data("id");
        openLightbox(imgId);
      });
    },
    error: function () {
      alert("Lỗi khi tải danh sách ảnh.");
    },
  });

  // 🔹 Mở Lightbox đúng ảnh
  function openLightbox(imgId) {
    currentIndex = imagesList.findIndex((img) => img.id == imgId);
    if (currentIndex !== -1) {
      updateLightbox();
      lightbox.show();
    }
  }

  // 🔹 Cập nhật ảnh trong Lightbox
  function updateLightbox() {
    if (currentIndex >= 0 && currentIndex < imagesList.length) {
      $("#lightbox-img").attr("src", imagesList[currentIndex].src);
    }
  }

  // 🔹 Nút Next
  $("#next-btn").click(function () {
    currentIndex = (currentIndex + 1) % imagesList.length;
    updateLightbox();
  });

  // 🔹 Nút Prev
  $("#prev-btn").click(function () {
    currentIndex = (currentIndex - 1 + imagesList.length) % imagesList.length;
    updateLightbox();
  });
  //Xử lý sự kiện khi nhấn nút trình chiếu
  // Hiển thị carousel với danh sách ảnh của sự kiện đang chọn
  $("#present-btn").click(function () {
    updateCarousel(imagesListToPresent); // Cập nhật carousel với ảnh từ imageList

    // Lấy giá trị thời gian từ select
    let delayTime = $("#timeSelect").val()
      ? parseInt($("#timeSelect").val()) * 1000
      : 3000; // Mặc định 3s nếu không chọn

    // Gán thời gian delay vào carousel
    $("#eventCarousel").attr("data-bs-interval", delayTime);

    $("#fullscreen-carousel").removeClass("d-none");
    $("body").css("overflow", "hidden"); // Ngăn cuộn trang khi carousel hiển thị
    // Khởi động carousel
    let carouselInstance = new bootstrap.Carousel(
      document.getElementById("eventCarousel"),
      {
        interval: delayTime,
        ride: "carousel",
      }
    );
  });

  // Đóng carousel khi nhấn nút "Close"
  $("#closeCarousel").click(function () {
    $("#fullscreen-carousel").addClass("d-none");
    $("body").css("overflow", "auto"); // Cho phép cuộn lại sau khi đóng
  });

  // Hàm cập nhật danh sách ảnh vào carousel
  function updateCarousel(images) {
    let carouselInner = $("#eventCarousel .carousel-inner");
    let carouselIndicators = $("#eventCarousel .carousel-indicators");

    // Xóa nội dung cũ
    carouselInner.empty();
    carouselIndicators.empty();

    // Thêm ảnh mới vào carousel
    images.forEach((image, index) => {
      let activeClass = index === 0 ? "active" : ""; // Ảnh đầu tiên sẽ active

      // Thêm slide ảnh
      carouselInner.append(`
        <div class="carousel-item ${activeClass} h-100">
          <img src="${
            image.src
          }" class="d-block w-100 h-100 object-fit-cover" alt="Slide ${
        index + 1
      }">
          <div class="carousel-caption d-none d-md-block">
            <p>${image.description}</p>
          </div>
        </div>
      `);

      // Thêm indicator
      carouselIndicators.append(`
        <button type="button" data-bs-target="#eventCarousel" data-bs-slide-to="${index}" 
                class="${activeClass}" aria-label="Slide ${index + 1}"></button>
      `);
    });
  }
  
});
