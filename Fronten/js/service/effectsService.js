$(document).ready(function () {
  // Lấy hiệu ứng đã lưu từ LocalStorage (giữ hiệu ứng khi chuyển trang)
  const savedEffect = localStorage.getItem("selectedEffect");
  if (savedEffect) {
    applyParticlesEffect(savedEffect);
  }

  // Khi nhấn nút "Apply", lưu hiệu ứng vào LocalStorage và áp dụng
  $("#applyEffect").click(function () {
    const selectedEffect = $("#effectSelect").val();

    if (selectedEffect === "") {
      removeParticlesEffect(); // Nếu không chọn hiệu ứng nào, xóa hiệu ứng
      localStorage.removeItem("selectedEffect"); // Xóa hiệu ứng đã lưu
    } else {
      localStorage.setItem("selectedEffect", selectedEffect); // Lưu hiệu ứng
      applyParticlesEffect(selectedEffect);
    }
  });

  function applyParticlesEffect(effect) {
    let particlesConfig = {
      particles: {
        number: { value: 50, density: { enable: true, value_area: 800 } },
        shape: { type: "image", image: { src: "", width: 100, height: 100 } },
        size: { value: 20, random: true },
        move: { enable: true, speed: 3, direction: "bottom", out_mode: "out" },
      },
    };

    switch (effect) {
      case "tet":
        particlesConfig.particles.shape.image.src =
          "assets/img/pngtree-peach-blossom-image_2234967-removebg-preview.png"; // Hoa đào
        break;
      case "noel":
        particlesConfig.particles.shape.image.src =
          "assets/img/snowflake-clipart-md.png"; // Tuyết
        break;
      case "halloween":
        particlesConfig.particles.shape.image.src =
          "assets/img/bi-ngo-halloween-01-removebg-preview.png"; // Bí ngô
        break;
      case "mooncake":
        particlesConfig.particles.shape.image.src =
          "assets/img/lovepik-mid-autumn-festival-lotus-seed-moon-cake-png-image_400369987_wh1200.png"; // Bí ngô
        break;
    }

    // Xóa hiệu ứng cũ trước khi tạo hiệu ứng mới
    removeParticlesEffect();

    // Gọi particles.js để hiển thị hiệu ứng
    particlesJS("particles-js", particlesConfig);
  }
  // Hàm xóa hiệu ứng
  function removeParticlesEffect() {
    $("#particles-js").empty(); // Xóa toàn bộ nội dung trong vùng chứa hiệu ứng
  }
});
