$(document).ready(function () {
  const baseImageUrl = `${BASE_URL}/uploads/`; // Đường dẫn thư mục chứa ảnh
  const currentYear = new Date().getFullYear();

  $.ajax({
    url: `${BASE_URL}/api/v1/Images/get`,
    method: "GET",
    dataType: "json",
    success: function (data) {
      let highlightImages = [];
      let imagesNow = [];
      let imagesLast = [];

      data.forEach((image) => {
        const imageYear = parseInt(image.path.split("_")[0]);

        if (image.eventId === "SK01") {
          highlightImages.push(image);
        }
        if (imageYear === currentYear) {
          imagesNow.push(image);
        }
        if (imageYear === currentYear - 1) {
          imagesLast.push(image);
        }
      });
      updateSection("#highlightImages", "Highlight Images", highlightImages);
      updateSection("#imagesNow", `${currentYear}`, imagesNow);
      updateSection("#imagesLast", `${currentYear - 1}`, imagesLast);
    },
    error: function (xhr, status, error) {
      console.error("Error fetching images:", error);
    },
  });
  function updateSection(sectionSelector, title, images) {
    const section = $(sectionSelector);
    if (images.length === 0) {
      section.hide();
    } else {
      section.show();
      section.find("h3.title").text(title);
      appendImages(section.find(".image-container"), images);
    }
  }

  function appendImages(container, images) {
    container.empty();
    images.forEach((image) => {
      const imgElement = `<img src="${baseImageUrl}${image.path}" alt="${image.name}">`;
      container.append(imgElement);
    });
  }
});
