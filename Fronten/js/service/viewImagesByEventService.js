$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`; // Đường dẫn thư mục chứa ảnh

  // Hàm lấy tham số từ URL
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  const eventId = getQueryParam("eventId");
  if (!eventId) {
    alert("Không tìm thấy sự kiện!");
    return;
  }

  // Gọi API lấy thông tin sự kiện điền vào h2
  $.ajax({
    url: `${BASE_URL}/api/v1/Events/get/${eventId}`,
    method: "GET",
    dataType: "json",
    success: function (event) {
      $("h2").text(event.name); // Hiển thị tên sự kiện
    },
    error: function () {
      alert("Lỗi khi tải thông tin sự kiện.");
    },
  });

  // Gọi API lấy danh sách ảnh theo sự kiện
  $.ajax({
    url: `${BASE_URL}/api/v1/Images/getbyevent/${eventId}`,
    method: "GET",
    dataType: "json",
    success: function (images) {
      const imageContainer = $("#listImageByEvent");
      imageContainer.empty();

      if (images.length === 0) {
        imageContainer.html(
          `<img src="assets/img/default.png" class="text-center w-25"/>`
        );
        return;
      }

      images.forEach((image, index) => {
        const imageItem = `
            <div id="${
              image.id
            }" class="image-item col-xxl-1-5 col-xl-2 col-lg-3 col-md-4 col-sm-6 p-2">
                <div class="card shadow-sm">
                    <input type="checkbox" class="select-checkbox" id="checkbox-${index}" />
                    <label for="checkbox-${index}" class="checkbox-label"></label>
                    <img src="${baseImageUrl}${
          image.path
        }" class="card-img-top" alt="Image"/>
                    <div class="card-body">
                        <p class="card-text text-start">${
                          image.description || "Không có mô tả"
                        }</p>
                    </div>
                </div>
            </div>`;
        imageContainer.append(imageItem);
      });
    },
    error: function () {
      alert("Lỗi khi tải danh sách ảnh.");
    },
  });

  //Xử lý khi nhấn Thêm ảnh
  const fileInput = $("#inputFile");

  // 🔹 Nhấn nút "Thêm mới" -> Mở cửa sổ chọn file
  $("#btnAddImage").on("click", function () {
    fileInput.trigger("click");
  });

  // 🔹 Xử lý khi người dùng chọn ảnh
  fileInput.on("change", function () {
    const files = this.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    const imagesMetadata = [];
    const today = new Date().toISOString();

    $.each(files, function (index, file) {
      if (!file.type.startsWith("image/")) return; // Chỉ chấp nhận file ảnh

      formData.append("files", file);
      imagesMetadata.push({
        name: file.name,
        description: "",
        timeOccurs: today,
        path: "",
        eventId: eventId,
        event: null,
      });
    });

    if (imagesMetadata.length === 0) {
      alert("Vui lòng chọn ít nhất một ảnh hợp lệ.");
      return;
    }

    formData.append("metadataJson", JSON.stringify(imagesMetadata));

    // 🔹 Gửi ảnh lên server qua API
    $.ajax({
      url: `${BASE_URL}/api/v1/Images/add`,
      method: "POST",
      data: formData,
      processData: false,
      contentType: false,
      success: function (response) {
        alert("Thêm ảnh thành công!");
        location.reload(); // Refresh lại trang
      },
      error: function () {
        alert("Lỗi khi tải ảnh lên. Vui lòng thử lại.");
      },
    });

    // Xóa giá trị input file để lần sau chọn lại ảnh
    fileInput.val("");
  });

  // Xử lý tìm kiếm sự kiện
  $("#btnSearch").on("click", function () {
    const searchText = $("#searchInput").val().trim().toLowerCase();

    $(".image-item").each(function () {
      const des = $(this).find(".card-text").text().trim().toLowerCase();
      if (des.includes(searchText)) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  });

  //Xử lý sự kiện khi nhấn nút xóa
  let selectedImages = []; // Danh sách ID ảnh đã chọn

  // 🔹 Hàm cập nhật trạng thái nút Xóa
  function updateDeleteButtonState() {
    if (selectedImages.length > 0) {
      $("#btnDeleteImage").prop("disabled", false);
    } else {
      $("#btnDeleteImage").prop("disabled", true);
    }
  }

  // 🔹 Xử lý khi chọn/bỏ chọn checkbox
  $(document).on("change", ".select-checkbox", function () {
    const imageId = parseInt($(this).closest(".image-item").attr("id"), 10);

    if ($(this).is(":checked")) {
      // Thêm vào danh sách nếu chưa có
      if (!selectedImages.includes(imageId)) {
        selectedImages.push(imageId);
      }
    } else {
      // Xóa khỏi danh sách nếu bỏ chọn
      selectedImages = selectedImages.filter((id) => id !== imageId);
    }

    // Cập nhật trạng thái nút Xóa
    updateDeleteButtonState();
  });

  // 🔹 Xử lý khi nhấn nút xóa
  $("#btnDelete").on("click", function () {
    if (selectedImages.length === 0) {
      alert("Vui lòng chọn ít nhất một ảnh để xóa.");
      return;
    }

    // Gọi API xóa
    $.ajax({
      url: `${BASE_URL}/api/v1/Images/soft-delete`,
      method: "DELETE",
      contentType: "application/json",
      data: JSON.stringify(selectedImages), // Truyền danh sách ID ảnh
      success: function (response) {
        
        //Tải lại trang
        location.reload();

        // Reset danh sách ảnh đã chọn & disable nút Xóa
        selectedImages = [];
        updateDeleteButtonState();
      },
      error: function () {
        alert("Lỗi khi xóa ảnh. Vui lòng thử lại.");
      },
    });
  });
});
