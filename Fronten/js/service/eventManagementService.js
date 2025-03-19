$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`; // Đường dẫn thư mục chứa ảnh

  //Xử lý sự kiện lấy toàn bộ danh sách sự kiện
  $.ajax({
    url: `${BASE_URL}/api/v1/Events/get`,
    method: "GET",
    dataType: "json",
    success: function (events) {
      const eventListContainer = $("#eventList");
      eventListContainer.empty();

      events.forEach((event) => {
        if (event.id === "SK01") return; // Bỏ qua sự kiện có id SK01

        $.ajax({
          url: `${BASE_URL}/api/v1/Images/getbyevent/${event.id}`,
          method: "GET",
          dataType: "json",
          success: function (images) {
            const imageUrl =
              images.length > 0
                ? `${baseImageUrl}${images[0].path}`
                : "assets/img/default.png";
            const eventItem = `
                            <div id="${event.id}" class="eventItem col-xl-2 col-md-4 col-sm-6 mb-4">
                                <div class="card">
                                    <img src="${imageUrl}" class="card-img-top" alt="${event.name}" />
                                    <div class="card-body">
                                        <h5 class="card-title">${event.name}</h5>
                                        <p class="card-text">${event.description}</p>
                                        <div class="d-flex justify-content-center gap-2">
                                            <a href="detailIamgeEvent.html" class="btn btn-outline-primary btn-sm" title="Xem ảnh">
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
            eventListContainer.append(eventItem);
          },
          error: function () {
            console.error(`Error fetching images for event ${event.id}`);
          },
        });
      });
    },
    error: function () {
      console.error("Error fetching events");
    },
  });

  $(document).on("click", ".btnAddImage", function () {
    const eventId = $(this).closest(".eventItem").attr("id");
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
    console.log(eventId);
    const today = new Date().toISOString();
    const formData = new FormData();
    const imagesMetadata = [];

    //Thêm dữ liệu ảnh vào mảng imagesMetadata
    $.each(files, function (index, file) {
      if (!file.type.startsWith("image/")) return; // Bỏ qua file không phải ảnh
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

  //Xử lý thêm mới một sự kiện
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

    $.ajax({
      url: `${BASE_URL}/api/v1/Events/get/${eventId}`,
      method: "GET",
      success: function (exists) {
        if (exists) {
          alert("Mã sự kiện đã tồn tại. Vui lòng nhập mã khác.");
          return;
        }

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
          success: function (response) {
            alert("Sự kiện đã được thêm thành công.");
            location.reload();
          },
          error: function () {
            alert("Lỗi khi thêm sự kiện. Vui lòng thử lại.");
          },
        });
      },
      error: function () {
        alert("Lỗi khi kiểm tra mã sự kiện. Vui lòng thử lại.");
      },
    });
  });

  // Xử lý sửa sự kiện
  $(document).on("click", ".btnEditEvent", function () {
    const eventId = $(this).closest(".eventItem").attr("id");

    $.ajax({
      url: `${BASE_URL}/api/v1/Events/get/${eventId}`,
      method: "GET",
      dataType: "json",
      success: function (event) {
        $("#editEventModal #eventId").val(event.id);
        $("#editEventModal #eventName").val(event.name);
        $("#editEventModal #eventDescription").val(event.description);
        $("#editEventModal #timeOccurs").val(event.timeOccurs.split("T")[0]);
      },
      error: function () {
        alert("Lỗi khi tải thông tin sự kiện.");
      },
    });
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
  $(document).on("click", ".btnDeleteEvent", function () {
    const eventId = $(this).closest(".eventItem").attr("id");
    $(document).on("click", "#btnDeleteEvent", function () {
      $.ajax({
        url: `${BASE_URL}/api/v1/Events/delete/${eventId}`,
        method: "DELETE",
        success: function () {
          alert("Sự kiện đã được xóa thành công.");
          location.reload();
        },
        error: function () {
          alert("Lỗi khi xóa sự kiện. Vui lòng thử lại.");
        },
      });
    });
  });
  // Xử lý tìm kiếm sự kiện
  // Xử lý tìm kiếm sự kiện
$("#btnSearch").on("click", function () {
    const searchText = $("#searchInput").val().trim().toLowerCase();
    
    $(".eventItem").each(function () {
        const eventName = $(this).find(".card-title").text().trim().toLowerCase();
        const eventDescription = $(this).find(".card-text").text().trim().toLowerCase();

        if (eventName.includes(searchText) || eventDescription.includes(searchText)) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
});
});
