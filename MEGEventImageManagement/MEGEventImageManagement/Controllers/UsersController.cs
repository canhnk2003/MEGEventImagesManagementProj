using Dapper;
using MEGEventImageManagement.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace MEGEventImageManagement.Controllers
{
    [Route("api/v1/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly string _connectionString;
        public UsersController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("ConnStr");
        }
        /// <summary>
        /// API lấy thông tin người dùng theo ID (Yêu cầu xác thực)
        /// </summary>
        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetUserInfo()
        {
            try
            {
                string userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

                if (string.IsNullOrEmpty(userId))
                    return Unauthorized("Không xác định được người dùng.");

                using (var connection = new SqlConnection(_connectionString))
                {
                    var user = await connection.QueryFirstOrDefaultAsync<UserAdmin>(
                        "SELECT Id, Name, Username FROM UserAdmin WHERE Id = @UserId",
                        new { UserId = userId });

                    if (user == null)
                        return NotFound("Người dùng không tồn tại.");

                    return Ok(user);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }
        /// <summary>
        /// API Đăng nhập
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
                    return BadRequest("Vui lòng nhập đầy đủ thông tin.");

                using (var connection = new SqlConnection(_connectionString))
                {
                    var user = await connection.QueryFirstOrDefaultAsync<UserAdmin>(
                        "SELECT * FROM UserAdmin WHERE Username = @Username",
                        new { request.Username });

                    if (user == null || !VerifyPassword(request.Password, user.Password))
                        return Unauthorized("Tên đăng nhập hoặc mật khẩu không chính xác.");

                    string accessToken = GenerateJwtToken(user);
                    string refreshToken = GenerateRefreshToken();
                    // Lưu refresh token vào database
                    await connection.ExecuteAsync(
                        "UPDATE UserAdmin SET RefreshToken = @RefreshToken, RefreshTokenExpiry = @Expiry WHERE Id = @UserId",
                        new { RefreshToken = refreshToken, Expiry = DateTime.UtcNow.AddDays(7), UserId = user.Id });

                    return Ok(new {message = "Đăng nhập thành công!", accessToken, refreshToken });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }
        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken([FromBody] TokenModel model)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var user = await connection.QueryFirstOrDefaultAsync<UserAdmin>(
                    "SELECT * FROM UserAdmin WHERE RefreshToken = @RefreshToken",
                    new { model.RefreshToken });

                if (user == null || user.RefreshTokenExpiry < DateTime.UtcNow)
                    return Unauthorized("Refresh token không hợp lệ hoặc đã hết hạn.");

                string newAccessToken = GenerateJwtToken(user);
                string newRefreshToken = GenerateRefreshToken();

                // Cập nhật refresh token mới vào database
                await connection.ExecuteAsync(
                    "UPDATE UserAdmin SET RefreshToken = @RefreshToken, RefreshTokenExpiry = @Expiry WHERE Id = @UserId",
                    new { RefreshToken = newRefreshToken, Expiry = DateTime.UtcNow.AddDays(7), UserId = user.Id });

                return Ok(new { accessToken = newAccessToken, refreshToken = newRefreshToken });
            }
        }

        private string GenerateRefreshToken()
        {
            var randomNumber = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(randomNumber);
            }
            return Convert.ToBase64String(randomNumber);
        }

        /// <summary>
        /// API Đăng xuất
        /// </summary>
        [HttpPost("logout")]
        [Authorize]
        public IActionResult Logout()
        {
            try
            {
                // Trả về token mới đã hết hạn ngay lập tức
                var expiredToken = new JwtSecurityToken(
                    expires: DateTime.UtcNow, // Hết hạn ngay khi đăng xuất
                    signingCredentials: new SigningCredentials(
                        new SymmetricSecurityKey(Encoding.UTF8.GetBytes("my-super-secret-key-that-is-long-enough")),
                        SecurityAlgorithms.HmacSha256)
                );

                return Ok(new
                {
                    message = "Đăng xuất thành công",
                    token = new JwtSecurityTokenHandler().WriteToken(expiredToken) // Token này vô hiệu ngay lập tức
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }

        /// <summary>
        /// API Đổi mật khẩu
        /// </summary>
        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.OldPassword) || string.IsNullOrEmpty(request.NewPassword))
                    return BadRequest("Vui lòng nhập đầy đủ thông tin.");

                using (var connection = new SqlConnection(_connectionString))
                {
                    var user = await connection.QueryFirstOrDefaultAsync<UserAdmin>(
                        "SELECT * FROM UserAdmin WHERE Id = @UserId",
                        new { UserId = User.FindFirstValue(ClaimTypes.NameIdentifier) });

                    if (user == null || !VerifyPassword(request.OldPassword, user.Password))
                        return Unauthorized("Mật khẩu cũ không chính xác.");

                    string hashedPassword = HashPassword(request.NewPassword);
                    await connection.ExecuteAsync(
                        "UPDATE UserAdmin SET Password = @Password WHERE Id = @UserId",
                        new { Password = hashedPassword, UserId = user.Id });

                    return Ok(new { message = "Đổi mật khẩu thành công" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }

        /// <summary>
        /// API Reset mật khẩu
        /// </summary>
        [HttpPost("reset-password")]
        [Authorize]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Username))
                    return BadRequest("Vui lòng nhập tên người dùng.");

                using (var connection = new SqlConnection(_connectionString))
                {
                    var user = await connection.QueryFirstOrDefaultAsync<UserAdmin>(
                        "SELECT * FROM UserAdmin WHERE Username = @Username",
                        new { request.Username });

                    if (user == null)
                        return NotFound("Người dùng không tồn tại.");

                    string defaultPassword = "Admin123";
                    string hashedPassword = HashPassword(defaultPassword);

                    await connection.ExecuteAsync(
                        "UPDATE UserAdmin SET Password = @Password WHERE Username = @Username",
                        new { Password = hashedPassword, request.Username });

                    return Ok(new { message = "Mật khẩu đã được đặt lại.", newPassword = defaultPassword });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }

        /// <summary>
        /// Tạo JWT Token
        /// </summary>
        private string GenerateJwtToken(UserAdmin user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("my-super-secret-key-that-is-long-enough"));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.Username)
        };

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// Băm mật khẩu với SHA256
        /// </summary>
        private string HashPassword(string password)
        {
            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] bytes = Encoding.UTF8.GetBytes(password);
                byte[] hash = sha256.ComputeHash(bytes);
                return Convert.ToBase64String(hash);
            }
        }

        /// <summary>
        /// Kiểm tra mật khẩu
        /// </summary>
        private bool VerifyPassword(string inputPassword, string hashedPassword)
        {
            return HashPassword(inputPassword) == hashedPassword;
        }

        // API Đăng ký tài khoản
        //[HttpPost("register")]
        //public async Task<IActionResult> Register([FromBody] RegisterRequest model)
        //{
        //    using (var connection = new SqlConnection(_connectionString))
        //    {
        //        // Kiểm tra xem username đã tồn tại chưa
        //        var existingUser = await connection.QueryFirstOrDefaultAsync<UserAdmin>(
        //            "SELECT * FROM UserAdmin WHERE Username = @Username",
        //            new { model.Username });

        //        if (existingUser != null)
        //            return BadRequest("Tên đăng nhập đã tồn tại.");

        //        // Hash mật khẩu trước khi lưu
        //        string hashedPassword = HashPassword(model.Password);

        //        // Thêm user mới vào database
        //        var sql = "INSERT INTO UserAdmin (Id, Name, Username, Password) VALUES (@Id, @Name, @Username, @Password)";
        //        var result = await connection.ExecuteAsync(sql, new
        //        {
        //            Id = "U02",
        //            Name = model.Name,
        //            Username = model.Username,
        //            Password = hashedPassword
        //        });

        //        return Ok("Đăng ký thành công!");
        //    }

        //}
    }

    // Model nhận dữ liệu từ client
    public class RegisterRequest
    {
        public string Name { get; set; }
        public string Username { get; set; }
        public string Password { get; set; }
    }
}
