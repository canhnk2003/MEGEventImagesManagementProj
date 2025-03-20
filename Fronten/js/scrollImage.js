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

  enableScrollByImage($("#highlightImages #imageScroll"));
  enableScrollByImage($("#imagesNow #imageScroll"));
  enableScrollByImage($("#imagesLast #imageScroll"));
});
