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
    public class ImagesController : ControllerBase
    {
        private readonly string _connectionString;

        // 🔹 Khởi tạo connection string trong constructor
        public ImagesController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("ConnStr");
        }

        // 🟡 Thêm nhiều ảnh cùng lúc
        [HttpPost("add")]
        [Authorize]
        public async Task<IActionResult> AddImages([FromBody] List<Image> images)
        {
            if (images == null || images.Count == 0)
            {
                return BadRequest(new { message = "Danh sách ảnh không được để trống." });
            }

            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync();
                    using (var transaction = await connection.BeginTransactionAsync())
                    {
                        try
                        {
                            // Lấy ID lớn nhất hiện tại
                            int maxId = await connection.ExecuteScalarAsync<int>(
                                "SELECT ISNULL(MAX(Id), 0) FROM Image", transaction: transaction);

                            // Danh sách ảnh sẽ thêm
                            var imagesToInsert = new List<object>();

                            foreach (var image in images)
                            {
                                maxId++; // Tăng ID lên 1
                                imagesToInsert.Add(new
                                {
                                    Id = maxId,
                                    image.Name,
                                    image.Description,
                                    image.TimeOccurs,
                                    image.Path,
                                    image.EventId
                                });
                            }

                            // Câu lệnh SQL thêm ảnh
                            var sql = "INSERT INTO Image (Id, Name, Description, TimeOccurs, Path, EventId) " +
                                      "VALUES (@Id, @Name, @Description, @TimeOccurs, @Path, @EventId)";

                            // Thực thi thêm danh sách ảnh
                            var result = await connection.ExecuteAsync(sql, imagesToInsert, transaction);

                            await transaction.CommitAsync();

                            return Ok(new { message = $"Thêm {result} ảnh thành công." });
                        }
                        catch (Exception ex)
                        {
                            await transaction.RollbackAsync();
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

        // 🟠 Cập nhật thông tin ảnh
        [HttpPut("update/{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateImage(int id, [FromBody] Image model)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "UPDATE Image SET Name = @Name, Description = @Description, TimeOccurs = @TimeOccurs, Path = @Path WHERE Id = @Id";
                    var result = await connection.ExecuteAsync(sql, new { model.Name, model.Description, model.TimeOccurs, model.Path, Id = id });

                    if (result > 0)
                        return Ok(new { message = "Cập nhật ảnh thành công." });

                    return NotFound(new { message = "Không tìm thấy ảnh để cập nhật." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
            }
        }

        // 🟢 Lấy danh sách tất cả ảnh
        [HttpGet("get")]
        [Authorize]
        public async Task<IActionResult> GetAllImages()
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "SELECT * FROM Image";
                    var images = await connection.QueryAsync<Image>(sql);

                    return Ok(images);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
            }
        }

        // 🟡 Lấy danh sách ảnh theo EventId
        [HttpGet("getbyevent/{eventId}")]
        [Authorize]
        public async Task<IActionResult> GetImagesByEventId(string eventId)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "SELECT * FROM Image WHERE EventId = @EventId";
                    var images = await connection.QueryAsync<Image>(sql, new { EventId = eventId });

                    return Ok(images);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
            }
        }

        // 🔍 Lấy chi tiết ảnh theo Id
        [HttpGet("get/{id}")]
        [Authorize]
        public async Task<IActionResult> GetImageById(int id)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "SELECT * FROM Image WHERE Id = @Id";
                    var image = await connection.QueryFirstOrDefaultAsync<Image>(sql, new { Id = id });

                    if (image == null)
                        return NotFound(new { message = "Không tìm thấy ảnh." });

                    return Ok(image);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
            }
        }

        // 🔥 Xóa tạm nhiều ảnh cùng lúc
        [HttpDelete("soft-delete")]
        [Authorize]
        public async Task<IActionResult> SoftDeleteImages([FromBody] List<int> imageIds)
        {
            if (imageIds == null || !imageIds.Any())
                return BadRequest(new { message = "Danh sách ID không hợp lệ." });

            using (var connection = new SqlConnection(_connectionString))
            {
                await connection.OpenAsync();
                using (var transaction = await connection.BeginTransactionAsync())
                {
                    try
                    {
                        // Lấy danh sách ảnh từ bảng Image
                        var queryGetImages = "SELECT * FROM Image WHERE Id IN @Ids";
                        var images = (await connection.QueryAsync<Image>(queryGetImages, new { Ids = imageIds }, transaction)).ToList();

                        if (images.Count == 0)
                            return NotFound(new { message = "Không tìm thấy ảnh nào để xóa." });

                        // Lấy ID lớn nhất trong bảng DeletedImages
                        int maxId = await connection.ExecuteScalarAsync<int>(
                            "SELECT ISNULL(MAX(Id), 0) FROM DeletedImages", transaction: transaction);

                        // Danh sách ảnh cần thêm vào DeletedImages
                        var imagesToInsert = new List<object>();

                        foreach (var image in images)
                        {
                            maxId++; // Tăng ID lên 1
                            imagesToInsert.Add(new
                            {
                                Id = maxId,
                                image.Name,
                                image.Description,
                                image.TimeOccurs,
                                image.Path,
                                image.EventId
                            });
                        }

                        if (imagesToInsert.Any())
                        {
                            // Chèn vào DeletedImages
                            var queryInsert = @"
                        INSERT INTO DeletedImages (Id, Name, Description, TimeOccurs, Path, EventId)
                        VALUES (@Id, @Name, @Description, @TimeOccurs, @Path, @EventId)";
                            await connection.ExecuteAsync(queryInsert, imagesToInsert, transaction);
                        }

                        // Xóa ảnh khỏi bảng Image
                        var queryDelete = "DELETE FROM Image WHERE Id IN @Ids";
                        await connection.ExecuteAsync(queryDelete, new { Ids = imageIds }, transaction);

                        await transaction.CommitAsync();
                        return Ok(new { message = "Xóa tạm thành công.", deletedCount = imagesToInsert.Count });
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
                    }
                }
            }
        }

        // 🔍 Lấy danh sách ảnh đã bị xóa tạm
        [HttpGet("deleted-images")]
        [Authorize]
        public async Task<IActionResult> GetDeletedImages()
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "SELECT * FROM DeletedImages";
                    var images = await connection.QueryAsync<Image>(sql);

                    return Ok(images);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
            }
        }

        // 🔄 Khôi phục ảnh đã xóa tạm
        [HttpPost("restore")]
        public async Task<IActionResult> RestoreImages([FromBody] List<int> imageIds)
        {
            if (imageIds == null || !imageIds.Any())
                return BadRequest(new { message = "Danh sách ID không hợp lệ." });

            using (var connection = new SqlConnection(_connectionString))
            {
                await connection.OpenAsync();
                using (var transaction = await connection.BeginTransactionAsync())
                {
                    try
                    {
                        // Lấy danh sách ảnh từ bảng DeletedImages
                        var queryGet = "SELECT * FROM DeletedImages WHERE Id IN @Ids";
                        var deletedImages = (await connection.QueryAsync<Image>(queryGet, new { Ids = imageIds }, transaction)).ToList();

                        if (!deletedImages.Any())
                            return NotFound(new { message = "Không tìm thấy ảnh nào để khôi phục." });

                        // Lấy ID lớn nhất trong bảng Image
                        int maxId = await connection.ExecuteScalarAsync<int>(
                            "SELECT ISNULL(MAX(Id), 0) FROM Image", transaction: transaction);

                        // Tạo danh sách ảnh cần thêm vào Image với ID mới
                        var imagesToRestore = new List<object>();

                        foreach (var image in deletedImages)
                        {
                            maxId++; // Tăng ID lên 1
                            imagesToRestore.Add(new
                            {
                                Id = maxId,
                                image.Name,
                                image.Description,
                                image.TimeOccurs,
                                image.Path,
                                image.EventId
                            });
                        }

                        if (imagesToRestore.Any())
                        {
                            // Chèn lại vào bảng Image
                            var queryInsert = @"
                        INSERT INTO Image (Id, Name, Description, TimeOccurs, Path, EventId)
                        VALUES (@Id, @Name, @Description, @TimeOccurs, @Path, @EventId)";
                            await connection.ExecuteAsync(queryInsert, imagesToRestore, transaction);
                        }

                        // Xóa ảnh khỏi bảng DeletedImages
                        var queryDelete = "DELETE FROM DeletedImages WHERE Id IN @Ids";
                        await connection.ExecuteAsync(queryDelete, new { Ids = imageIds }, transaction);

                        await transaction.CommitAsync();
                        return Ok(new { message = "Khôi phục ảnh thành công.", restoredCount = imagesToRestore.Count });
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
                    }
                }
            }
        }

        // 🚨 Xóa hoàn toàn ảnh đã xóa tạm
        [HttpDelete("permanent-delete/{id}")]
        [Authorize]
        public async Task<IActionResult> PermanentDeleteImage(int id)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    var sql = "DELETE FROM DeletedImages WHERE Id = @Id";
                    var result = await connection.ExecuteAsync(sql, new { Id = id });

                    if (result > 0)
                        return Ok(new { message = "Ảnh đã bị xóa hoàn toàn." });

                    return NotFound(new { message = "Không tìm thấy ảnh để xóa vĩnh viễn." });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
            }
        }
        //Xóa nhiều ảnh, xóa thật
        [HttpDelete("permanent-delete")]
        public async Task<IActionResult> DeleteImagesPermanently([FromBody] List<int> imageIds)
        {
            if (imageIds == null || !imageIds.Any())
                return BadRequest(new { message = "Danh sách ID không hợp lệ." });

            using (var connection = new SqlConnection(_connectionString))
            {
                await connection.OpenAsync();
                using (var transaction = await connection.BeginTransactionAsync())
                {
                    try
                    {
                        // Kiểm tra ảnh có tồn tại trong bảng DeletedImages không
                        var queryCheck = "SELECT COUNT(*) FROM DeletedImages WHERE Id IN @Ids";
                        int count = await connection.ExecuteScalarAsync<int>(queryCheck, new { Ids = imageIds }, transaction);

                        if (count == 0)
                            return NotFound(new { message = "Không tìm thấy ảnh nào để xóa." });

                        // Xóa ảnh khỏi database
                        var queryDelete = "DELETE FROM DeletedImages WHERE Id IN @Ids";
                        await connection.ExecuteAsync(queryDelete, new { Ids = imageIds }, transaction);

                        await transaction.CommitAsync();
                        return Ok(new { message = "Xóa ảnh vĩnh viễn thành công.", deletedCount = count });
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
                    }
                }
            }
        }
    }
}
