// $(document).ready(function () {
//   // Tạo hiệu ứng scroll
//   let isDown = false;
//   let startX;
//   let scrollLeft;
//   let container = $("#imageScroll");

//   container.on("mousedown", function (e) {
//     isDown = true;
//     $(this).addClass("active");
//     startX = e.pageX - $(this).offset().left;
//     scrollLeft = $(this).scrollLeft();
//   });

//   $(document).on("mouseup", function () {
//     isDown = false;
//     container.removeClass("active");
//   });

//   container.on("mousemove", function (e) {
//     if (!isDown) return;
//     e.preventDefault();
//     const x = e.pageX - $(this).offset().left;
//     const walk = (x - startX) * 1.5;
//     let newScrollLeft = scrollLeft - walk;
//     let maxScrollLeft = container[0].scrollWidth - container[0].clientWidth;

//     if (newScrollLeft < 0) {
//       newScrollLeft = 0;
//     } else if (newScrollLeft > maxScrollLeft) {
//       newScrollLeft = maxScrollLeft;
//     }

//     container.scrollLeft(newScrollLeft);
//   });
// });
$(document).ready(function () {
  function enableScrollByImage(container) {
    let isDown = false;
    let startX, scrollLeft;

    container.on("mousedown", function (e) {
      isDown = true;
      startX = e.pageX - container.offset().left;
      scrollLeft = container.scrollLeft();
    });

    $(document).on("mouseup", function () {
      isDown = false;
    });

    container.on("mousemove", function (e) {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offset().left;
      const walk = (x - startX) * 1.5;
      container.scrollLeft(scrollLeft - walk);
    });

    // Cuộn theo từng ảnh khi sử dụng phím mũi tên
    container.on("wheel", function (e) {
      e.preventDefault();
      const scrollAmount = container.find("img").first().width() + 10; // Lấy width + gap
      if (e.originalEvent.deltaY > 0) {
        container.animate({ scrollLeft: "+=" + scrollAmount }, 300);
      } else {
        container.animate({ scrollLeft: "-=" + scrollAmount }, 300);
      }
    });
  }

  enableScrollByImage($("#imageScroll"));
  enableScrollByImage($("#highlightScroll"));
  enableScrollByImage($("#eventScroll"));
});
