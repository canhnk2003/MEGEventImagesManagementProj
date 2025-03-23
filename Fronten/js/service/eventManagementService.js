$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`; // Đường dẫn thư mục chứa ảnh
  let eventsByYear = {}; // 🔹 Biến toàn cục lưu trữ danh sách sự kiện theo năm
  // Xử lý sự kiện lấy toàn bộ danh sách sự kiện
  $.ajax({
    url: `${BASE_URL}/api/v1/Events/get`,
    method: "GET",
    dataType: "json",
    success: function (response) {
      eventsByYear = response; // ✅ Lưu vào biến toàn cục
      renderEvents(eventsByYear);
    },
    error: function () {
      console.error("Error fetching events");
    },
  });
  // Hàm render danh sách sự kiện
  function renderEvents(eventsByYear) {
    const eventListContainer = $("#eventList");
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
                                <a href="detailImageEvent.html?eventId=${event.id}" class="btn btn-outline-primary btn-sm" title="Xem ảnh">
                                  <i class="fa-solid fa-eye"></i>
                                </a>
                                <button class="btnAddImage btn btn-outline-success btn-sm" title="Thêm ảnh vào sự kiện">
                                  <i class="fa-solid fa-plus"></i>
                                </button>
                                <button class="btnEditEvent btn btn-outline-warning btn-sm" title="Sửa thông tin sự kiện" data-bs-toggle="modal" data-bs-target="#editEventModal">
                                  <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button class="btnDeleteEvent btn btn-outline-danger btn-sm" title="Xóa sự kiện" data-bs-toggle="modal" data-bs-target="#deleteEventModal">
                                  <i class="fa-solid fa-trash-can"></i>
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

  $(document).on("click", ".btnAddImage", function () {
    const eventId = $(this).closest(".event-item").attr("id");
    console.log(eventId);
    fileInput.attr("data-event-id", eventId); // Lưu eventId vào input file
    fileInput.trigger("click");
  });

  // Tạo input file bên ngoài
  const fileInput = $("<input>", {
    type: "file",
    class: "d-none",
    multiple: true,
    accept: "image/*",
  }).appendTo("body");

  //Xử lý thêm ảnh vào sự kiện
  //Xử lý sự kiện khi nhấn thêm trong cửa sổ File Explore
  fileInput.on("change", function () {
    console.log("File input changed");
    const files = this.files;
    if (!files || files.length === 0) return;

    const eventId = $(this).attr("data-event-id");
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

  // //Xử lý thêm mới một sự kiện
  $("#btnAddEvent").on("click", function () {
    const eventId = $("#eventId").val().trim();
    const eventName = $("#eventName").val().trim();
    const eventDescription = $("#eventDescription").val().trim();
    const time = $("#timeOccurs").val().trim();

    if (!eventId) {
      alert("Vui lòng nhập mã sự kiện.");
      return;
    }
    if (!eventName) {
      alert("Vui lòng nhập tên sự kiện.");
      return;
    }
    if (!time) {
      alert("Vui lòng nhập ngày diễn ra sự kiện.");
      return;
    }

    // Kiểm tra sự tồn tại của eventId trước khi thêm
    $.ajax({
      url: `${BASE_URL}/api/v1/Events/get/${eventId}`,
      method: "GET",
      success: function () {
        alert("Mã sự kiện đã tồn tại. Vui lòng nhập mã khác.");
      },
      error: function (xhr) {
        if (xhr.status === 404) {
          // Nếu không tìm thấy (404), tiếp tục tạo sự kiện
          const eventData = {
            id: eventId,
            name: eventName,
            description: eventDescription,
            timeOccurs: time,
            status: 0,
          };

          $.ajax({
            url: `${BASE_URL}/api/v1/Events/create`,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(eventData),
            success: function () {
              alert("Sự kiện đã được thêm thành công.");
              location.reload();
            },
            error: function () {
              alert("Lỗi khi thêm sự kiện. Vui lòng thử lại.");
            },
          });
        } else {
          // Nếu lỗi khác 404, thông báo lỗi chung
          alert("Lỗi khi kiểm tra mã sự kiện. Vui lòng thử lại.");
        }
      },
    });
  });

  // Xử lý sửa sự kiện
  $(document).on("click", ".btnEditEvent", function () {
    const eventId = $(this).closest(".event-item").attr("id"); // ✅ Lấy đúng ID sự kiện
    console.log("Event ID:", eventId);

    if (!eventsByYear || Object.keys(eventsByYear).length === 0) {
      alert("Không có dữ liệu sự kiện.");
      return;
    }

    // 🔹 Tìm kiếm sự kiện trong danh sách đã tải về
    let foundEvent = null;
    Object.values(eventsByYear).forEach((events) => {
      const event = events.find((e) => e.id == eventId);
      if (event) {
        foundEvent = event;
      }
    });

    if (!foundEvent) {
      alert("Không tìm thấy sự kiện để chỉnh sửa!");
      return;
    }

    // ✅ Đổ dữ liệu vào modal sửa sự kiện
    $("#editEventModal #eventId").val(foundEvent.id);
    $("#editEventModal #eventName").val(foundEvent.name);
    $("#editEventModal #eventDescription").val(foundEvent.description);
    $("#editEventModal #timeOccurs").val(foundEvent.timeOccurs.split("T")[0]);
  });

  $("#btnUpdateEvent").on("click", function () {
    const eventId = $("#editEventModal #eventId").val();
    const eventName = $("#editEventModal #eventName").val().trim();
    const eventDescription = $("#editEventModal #eventDescription")
      .val()
      .trim();
    const timeOccurs = $("#editEventModal #timeOccurs").val();

    if (!eventName) {
      alert("Tên sự kiện không được để trống.");
      return;
    }
    if (!timeOccurs) {
      alert("Ngày diễn ra sự kiện không được để trống.");
      return;
    }

    const eventData = {
      id: eventId,
      name: eventName,
      description: eventDescription,
      timeOccurs: timeOccurs,
      status: 0,
    };

    $.ajax({
      url: `${BASE_URL}/api/v1/Events/update/${eventId}`,
      method: "PUT",
      contentType: "application/json",
      data: JSON.stringify(eventData),
      success: function (response) {
        alert("Sự kiện đã được cập nhật thành công.");
        location.reload();
      },
      error: function () {
        alert("Lỗi khi cập nhật sự kiện. Vui lòng thử lại.");
      },
    });
  });
  // Xử lý xóa sự kiện
  // 🗑️ Khi nhấn vào nút xóa sự kiện
  $(document).on("click", ".btnDeleteEvent", function () {
    const eventId = $(this).closest(".event-item").attr("id"); // ✅ Lấy ID đúng
    $("#btnDeleteEvent").data("event-id", eventId); // ✅ Lưu eventId vào nút xác nhận
  });

  // 🛑 Xử lý xác nhận xóa khi bấm nút "Xác nhận" trong modal
  $(document).on("click", "#btnDeleteEvent", function () {
    const eventId = $(this).data("event-id"); // ✅ Lấy ID từ data
    if (!eventId) {
      alert("Không tìm thấy ID sự kiện để xóa!");
      return;
    }

    $.ajax({
      url: `${BASE_URL}/api/v1/Events/delete/${eventId}`,
      method: "DELETE",
      success: function () {
        alert("Sự kiện đã được xóa thành công.");
        location.reload(); // ✅ Làm mới trang sau khi xóa
      },
      error: function () {
        alert("Lỗi khi xóa sự kiện. Vui lòng thử lại.");
      },
    });
  });
  // Xử lý tìm kiếm sự kiện
  $("#btnSearch").on("click", function () {
    const searchText = $("#searchInput").val().trim().toLowerCase();

    $(".event-item").each(function () {
      const eventName = $(this).find(".card-title").text().trim().toLowerCase();
      const eventDes = $(this).find(".card-text").text().trim().toLowerCase();
      if (eventName.includes(searchText) || eventDes.includes(searchText)) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  });
});
