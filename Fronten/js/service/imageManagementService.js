$(document).ready(function () {
  function loadImages() {
    $.ajax({
      url: `${BASE_URL}/api/v1/Images/get`,
      method: "GET",
      success: function (images) {
        if (!images || images.length === 0) {
          console.warn("Không có ảnh nào.");
          return;
        }

        // 🔹 Nhóm ảnh theo eventId
        const groupedImages = {};
        images.forEach((image) => {
          if (!groupedImages[image.eventId]) {
            groupedImages[image.eventId] = [];
          }
          groupedImages[image.eventId].push(image);
        });

        // 🔹 Xóa nội dung cũ trước khi thêm mới
        $("#eventContainer").empty();

        // 🔹 Hiển thị SK01 trước tiên
        if (groupedImages["SK01"]) {
          renderEventImages("SK01", groupedImages["SK01"]);
          delete groupedImages["SK01"]; // Xóa SK01 khỏi danh sách chung
        }

        // 🔹 Duyệt các eventId còn lại
        for (const eventId in groupedImages) {
          renderEventImages(eventId, groupedImages[eventId]);
        }
      },
      error: function () {
        alert("Lỗi khi tải danh sách ảnh.");
      },
    });
  }

  function renderEventImages(eventId, images) {
    // 🔹 Gọi API lấy tên sự kiện
    $.ajax({
      url: `${BASE_URL}/api/v1/Events/get/${eventId}`,
      method: "GET",
      success: function (event) {
        let eventName = event.name || `Sự kiện: ${eventId}`;

        let eventHtml = `
            <div id="${eventId}" class="event-item container-fluid mt-4">
                <h2>${eventName}</h2>
                <div class="row">
          `;

        // 🔹 Thêm từng ảnh vào event
        images.forEach((image) => {
          eventHtml += `
                <div class="col-xxl-1-5 col-xl-2 col-lg-3 col-md-4 col-sm-6 p-2 image-item" id="${
                  image.id
                }">
                    <div class="card shadow-sm">
                        <input type="checkbox" class="select-checkbox" id="checkbox-${
                          image.id
                        }" />
                        <label for="checkbox-${
                          image.id
                        }" class="checkbox-label"></label>
                        <img src="${BASE_URL}/uploads/${
            image.path
          }" class="card-img-top" alt="Image"/>
                        <div class="card-body">
                            <p class="card-text text-start">${
                              image.description || "Không có mô tả"
                            }</p>
                        </div>
                    </div>
                </div>
            `;
        });

        // 🔹 Kết thúc HTML của event
        eventHtml += `
                </div>
            </div>
          `;

        // 🔹 Thêm HTML vào trang
        $("#eventContainer").append(eventHtml);
      },
      error: function () {
        console.warn(`Không thể lấy thông tin sự kiện ${eventId}`);
      },
    });
  }

  // Gọi hàm khi trang tải
  loadImages();

  function loadEvents() {
    $.ajax({
      url: `${BASE_URL}/api/v1/Events/get`, // 🔹 API lấy danh sách sự kiện
      method: "GET",
      success: function (events) {
        if (!events || events.length === 0) {
          console.warn("Không có sự kiện nào.");
          return;
        }

        // Xóa tất cả option cũ, chỉ giữ lại option mặc định "-- Chọn sự kiện --"
        $("#eventSelect")
          .empty()
          .append(`<option value="">-- Chọn sự kiện --</option>`);

        // Thêm các sự kiện vào select
        events.forEach((event) => {
          $("#eventSelect").append(
            `<option value="${event.id}">${event.name}</option>`
          );
        });
      },
      error: function () {
        alert("Lỗi khi tải danh sách sự kiện.");
      },
    });
  }

  // Gọi API lấy danh sách sự kiện
  loadEvents();

  //Xử lý khi thêm mới 1 ảnh
  //  Xử lý hiển thị ảnh xem trước khi chọn file
  $("#imageFile").on("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        $("#previewImage").attr("src", e.target.result).removeClass("d-none");
      };
      reader.readAsDataURL(file);
    }
  });

  //Xử lý khi nhấn nút thêm
  $("#btnAddImage").on("click", function () {
    const selectedFiles = $("#imageFile")[0].files;
    const eventId = $("#eventSelect").val();
    const imageName = $("#imageName").val().trim();
    const imageDesc = $("#imageDesc").val().trim();

    if (!eventId) {
      alert("Vui lòng chọn sự kiện.");
      return;
    }
    if (!imageName) {
      alert("Vui lòng nhập tên ảnh.");
      return;
    }
    if (selectedFiles.length === 0) {
      alert("Vui lòng chọn ít nhất một ảnh.");
      return;
    }

    // 🔹 Tạo danh sách metadata cho tất cả ảnh
    const metadataList = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      metadataList.push({
        name: imageName + (selectedFiles.length > 1 ? `_${i + 1}` : ""), // Thêm index nếu có nhiều ảnh
        description: imageDesc,
        timeOccurs: new Date().toISOString(),
        path: "",
        eventId: eventId,
        event: null,
      });
    }

    // 🔹 Tạo FormData
    const formData = new FormData();
    formData.append("metadataJson", JSON.stringify(metadataList)); // Gửi danh sách metadata

    // 🔹 Thêm tất cả file vào FormData
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files", selectedFiles[i]);
    }

    // 🔹 Gọi API tải ảnh lên
    $.ajax({
      url: `${BASE_URL}/api/v1/Images/add`,
      method: "POST",
      data: formData,
      processData: false,
      contentType: false,
      success: function (response) {
        $("#addImageModal").modal("hide"); // Đóng modal
        alert(response.message);
        loadImages(); // Refresh trang sau khi tải ảnh thành công
      },
      error: function (error) {
        $("#addImageModal").modal("hide"); // Đóng modal
        alert(
          "Lỗi khi tải ảnh lên: " +
            (error.responseJSON?.message || "Vui lòng thử lại.")
        );
      },
    });
  });
});
