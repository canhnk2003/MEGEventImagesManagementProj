using Dapper;
using MEGEventImageManagement.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace MEGEventImageManagement.Controllers
{
    [Route("api/v1/[controller]")]
    [ApiController]
    public class EventsController : ControllerBase
    {
        private readonly string _connectionString;
        public EventsController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("ConnStr");
        }
        // 🟢 API: Lấy danh sách tất cả sự kiện
        [HttpGet("get")]
        public async Task<IActionResult> GetAllEvents()
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "SELECT * FROM Event";
                    var events = await connection.QueryAsync<Event>(sql);

                    var groupedEvents = events.GroupBy(e => e.TimeOccurs.Year)
                        .OrderByDescending(g => g.Key)
                        .ToDictionary(g => g.Key, g => g.ToList());

                    return Ok(groupedEvents);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }

        // API: Lấy thông tin một sự kiện theo ID
        [HttpGet("get/{id}")]
        public async Task<IActionResult> GetEventById(string id)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "SELECT * FROM Event WHERE Id = @Id";
                    var eventItem = await connection.QueryFirstOrDefaultAsync<Event>(sql, new { Id = id });

                    if (eventItem == null)
                        return NotFound(new { message = "Không tìm thấy sự kiện." });

                    return Ok(eventItem);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }

        //Thêm sự kiện mới
        [HttpPost("create")]
        [Authorize] // Chỉ admin mới có quyền
        public async Task<IActionResult> CreateEvent([FromBody] Event model)
        {
            try
            {
                if (string.IsNullOrEmpty(model.Id) || string.IsNullOrEmpty(model.Name))
                {
                    return BadRequest(new { message = "Id và Name không được để trống." });
                }

                using (var connection = new SqlConnection(_connectionString))
                {
                    // 🛑 Kiểm tra ID có tồn tại chưa
                    var existingEvent = await connection.QueryFirstOrDefaultAsync<Event>(
                        "SELECT * FROM Event WHERE Id = @Id", new { model.Id });

                    if (existingEvent != null)
                    {
                        return BadRequest(new { message = "Id sự kiện đã tồn tại, vui lòng nhập Id khác." });
                    }
                    // ✅ Nếu ID hợp lệ, tiến hành thêm vào DB
                    var sql = "INSERT INTO Event (Id, Name, Description, TimeOccurs, Status) VALUES (@Id, @Name, @Description, @TimeOccurs, @Status)";
                    var result = await connection.ExecuteAsync(sql, model);

                    if (result > 0)
                        return Ok(new { message = "Thêm sự kiện thành công." });

                    return StatusCode(500, new { message = "Lỗi khi thêm sự kiện." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }

        // Cập nhật sự kiện
        [HttpPut("update/{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateEvent(string id, [FromBody] Event model)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    // 🛑 Kiểm tra ID có tồn tại chưa
                    var existingEvent = await connection.QueryFirstOrDefaultAsync<Event>(
                        "SELECT * FROM Event WHERE Id = @Id", new { Id = id });

                    if (existingEvent == null)
                    {
                        return BadRequest(new { message = "Id sự kiện không tồn tại, vui lòng nhập Id khác." });
                    }
                    var sql = "UPDATE Event SET Name = @Name, Description = @Description, TimeOccurs = @TimeOccurs, Status = @Status WHERE Id = @Id";
                    var result = await connection.ExecuteAsync(sql, new { model.Name, model.Description, model.TimeOccurs, model.Status, Id = id });

                    if (result > 0)
                        return Ok(new { message = "Cập nhật sự kiện thành công." });

                    return NotFound(new { message = "Không tìm thấy sự kiện để cập nhật." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Có lỗi xảy ra! " + ex.Message);
            }
        }

        // 🔴 Xóa sự kiện
        [HttpDelete("delete/{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteEvent(string id)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    using (var transaction = connection.BeginTransaction())
                    {
                        try
                        {
                            // Kiểm tra sự kiện có tồn tại không
                            var checkEventSql = "SELECT COUNT(*) FROM Event WHERE Id = @Id";
                            var eventExists = await connection.ExecuteScalarAsync<int>(checkEventSql, new { Id = id }, transaction);

                            if (eventExists == 0)
                            {
                                return NotFound(new { message = "Không tìm thấy sự kiện để xóa." });
                            }

                            // Xóa ảnh liên quan trước
                            var deleteImagesSql = "DELETE FROM Image WHERE EventId = @Id";
                            await connection.ExecuteAsync(deleteImagesSql, new { Id = id }, transaction);

                            // Xóa sự kiện
                            var deleteEventSql = "DELETE FROM Event WHERE Id = @Id";
                            var result = await connection.ExecuteAsync(deleteEventSql, new { Id = id }, transaction);

                            transaction.Commit();

                            return Ok(new { message = "Xóa sự kiện thành công." });
                        }
                        catch (SqlException ex) when (ex.Number == 547) // Lỗi ràng buộc khóa ngoại
                        {
                            transaction.Rollback();
                            return BadRequest(new { message = "Không thể xóa sự kiện vì có dữ liệu liên quan." });
                        }
                        catch (Exception ex)
                        {
                            transaction.Rollback();
                            return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
            }
        }

    }
}
