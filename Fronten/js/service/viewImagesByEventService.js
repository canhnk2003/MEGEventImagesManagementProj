$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`; // Đường dẫn thư mục chứa ảnh
  let imagesList = []; // Mảng lưu danh sách ảnh
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

      // 🔹 Hiển thị ảnh theo năm
      Object.keys(imagesByYear)
        .sort((a, b) => b - a) // Sắp xếp năm giảm dần
        .forEach((year) => {
          const yearId = `year-${year}`; // Tạo ID duy nhất cho mỗi năm
          const yearSection = `
        <div class="year-section">
          <h4 class="year-title m-3 ms-0">${year}</h4>
          <div id="${yearId}" class="row images-container"></div>
        </div>`;
          imageContainer.append(yearSection);

          const imagesRow = $(`#${yearId}`); // Lấy đúng container theo ID

          imagesByYear[year].forEach((image, index) => {
            const imgSrc = `${baseImageUrl}${image.path}`;

            // 🟢 Thêm ảnh vào danh sách `imagesList`
            imagesList.push({
              id: image.id,
              src: imgSrc,
              description: image.description || "Không có mô tả",
            });
            const imageItem = `
            <div id="${
              image.id
            }" class="image-item col-xxl-1-5 col-xl-2 col-lg-3 col-md-4 col-sm-6 p-2">
                <div class="card shadow-sm" data-id="${image.id}">
                    <input type="checkbox" class="select-checkbox" id="checkbox-${year}-${index}" />
                    <label for="checkbox-${year}-${index}" class="checkbox-label"></label>

                    <img src="${imgSrc}" class="card-img-top" alt="Image"/>

                    <div class="card-body">
                        <p class="card-text text-start description">
                          ${image.description || "Không có mô tả"}
                        </p>
                    </div>
                </div>
            </div>`;
            imagesRow.append(imageItem);
          });
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

  //Xử lý sự kiện khi nhấn thêm trong cửa sổ File Explore
  fileInput.on("change", function () {
    console.log("File input changed");
    const files = this.files;
    if (!files || files.length === 0) return;
    const today = new Date().toISOString();
    const formData = new FormData();
    const imagesMetadata = [];

    let totalSize = 0; // 🛑 Biến để tính tổng dung lượng

    //Thêm dữ liệu ảnh vào mảng imagesMetadata
    $.each(files, function (index, file) {
      if (!file.type.startsWith("image/")) return; // Bỏ qua file không phải ảnh

      totalSize += file.size; // ✅ Cộng dồn dung lượng

      if (totalSize > 157286400) {
        // 150MB = 157286400 bytes
        alert("Tổng dung lượng ảnh không được vượt quá 150MB!");
        return false; // 🛑 Dừng lặp
      }

      formData.append("files", file);
      // ✅ Tách thông tin từ tên file theo định dạng: id_Họ tên_Mô tả
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, ""); // Loại bỏ phần mở rộng (.jpg, .png,...)
      const nameParts = fileNameWithoutExt.split("_");

      if (nameParts.length < 3) {
        alert(`Tên file "${file.name}" không đúng định dạng!`);
        return false; // 🛑 Dừng lặp nếu tên file không hợp lệ
      }

      const fullName = nameParts[1].trim(); // Lấy "Họ tên"
      const description = nameParts.slice(2).join("_").trim(); // Lấy phần mô tả
      const fullDescription = `${fullName} - ${description}`; // ✅ Mô tả = "Họ tên - Mô tả"
      imagesMetadata.push({
        name: fullName,
        description: fullDescription,
        timeOccurs: today,
        path: "",
        eventId: eventId,
        event: null,
      });
    });

    if (imagesMetadata.length === 0) return;

    formData.append("metadataJson", JSON.stringify(imagesMetadata));

    //Gọi API thêm ảnh
    $.ajax({
      url: `${BASE_URL}/api/v1/Images/add`,
      method: "POST",
      data: formData,
      processData: false,
      contentType: false,
      success: function (response) {
        alert(response.message);
        location.reload(); // Refresh lại trang sau khi thêm ảnh thành công
      },
      error: function () {
        alert("Lỗi khi tải ảnh lên. Vui lòng thử lại.");
      },
    });
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
        alert("Xóa ảnh thành công!");
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

  //Xử lý khi nhấn vào 1 ảnh để xem

  let currentIndex = 0; // Vị trí ảnh hiện tại

  // 🔹 Xử lý khi nhấn vào ảnh để xem trong modal
  $(document).on("click", ".image-item img", function () {
    const imgId = $(this).closest(".card").data("id"); // 🟢 Lấy đúng data-id từ .card
    console.log("🟢 Clicked Image ID:", imgId);

    currentIndex = imagesList.findIndex((img) => img.id == imgId);
    console.log("🔹 Lightbox Index:", currentIndex);

    if (currentIndex !== -1) {
      showImage(currentIndex);
      $("#imageModal").modal("show");
    }
  });

  // 🔹 Hiển thị ảnh trong modal
  function showImage(index) {
    const image = imagesList[index];
    if (!image) return;

    $("#modalImage").attr("src", image.src);
    $("#modalDescription").text(image.description);

    // Vô hiệu hóa nút nếu đến đầu/cuối danh sách
    $("#prevImage").prop("disabled", index === 0);
    $("#nextImage").prop("disabled", index === imagesList.length - 1);
  }

  // 🔹 Xử lý nút Next
  $("#nextImage").on("click", function () {
    if (currentIndex < imagesList.length - 1) {
      currentIndex++;
      showImage(currentIndex);
    }
  });

  // 🔹 Xử lý nút Prev
  $("#prevImage").on("click", function () {
    if (currentIndex > 0) {
      currentIndex--;
      showImage(currentIndex);
    }
  });
  // 🔹 Xử lý sự kiện "Chọn tất cả"
  $("#btnSelectAll").click(function () {
    console.log("Canh");
    $(".select-checkbox").prop("checked", true).trigger("change");
  });

  // 🔹 Xử lý sự kiện "Bỏ chọn tất cả"
  $("#btnDeselectAll").click(function () {
    $(".select-checkbox").prop("checked", false).trigger("change");
  });
});
