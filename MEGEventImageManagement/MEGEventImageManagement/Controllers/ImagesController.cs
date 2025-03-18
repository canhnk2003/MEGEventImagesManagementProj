using Dapper;
using MEGEventImageManagement.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;

namespace MEGEventImageManagement.Controllers
{
    [Route("api/v1/[controller]")]
    [ApiController]
    public class ImagesController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly string _uploadFolder;

        // 🔹 Khởi tạo connection string trong constructor
        public ImagesController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("ConnStr");
            // Khởi tạo thư mục lưu ảnh
            _uploadFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(_uploadFolder))
            {
                Directory.CreateDirectory(_uploadFolder);
            }
        }

        #region Helper Methods

        // Hàm thực hiện một hành động trong transaction, xử lý commit/rollback tự động
        private async Task<IActionResult> ExecuteInTransactionAsync(Func<SqlConnection, SqlTransaction, Task<IActionResult>> func)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                await connection.OpenAsync();
                using (var transaction = await connection.BeginTransactionAsync())
                {
                    try
                    {
                        var result = await func(connection, (SqlTransaction)transaction);
                        await transaction.CommitAsync();
                        return result;
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        return StatusCode(500, new { message = "Có lỗi xảy ra! " + ex.Message });
                    }
                }
            }
        }

        // Hàm lưu file và trả về tên file mới theo quy tắc: <Năm>_<EventId>_<Guid>.<ext>
        private async Task<string> SaveFileAsync(IFormFile file, int year, string eventId)
        {
            string fileName = $"{year}_{eventId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            string filePath = Path.Combine(_uploadFolder, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            return fileName;
        }

        // Hàm xóa file nếu tồn tại
        private void DeleteFile(string fileName)
        {
            string filePath = Path.Combine(_uploadFolder, fileName);
            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
            }
        }

        // Hàm lấy giá trị Id lớn nhất từ bảng truyền vào
        private async Task<int> GetMaxIdAsync(SqlConnection connection, SqlTransaction transaction, string tableName)
        {
            string sql = $"SELECT ISNULL(MAX(Id), 0) FROM {tableName}";
            return await connection.ExecuteScalarAsync<int>(sql, transaction: transaction);
        }

        // Hàm thử deserialize JSON metadata
        private bool TryDeserializeMetadata<T>(string json, out T result)
        {
            try
            {
                result = JsonConvert.DeserializeObject<T>(json);
                return true;
            }
            catch
            {
                result = default;
                return false;
            }
        }

        #endregion

        // 🟡 Thêm nhiều ảnh cùng lúc
        [HttpPost("add")]
        [Authorize]
        public async Task<IActionResult> AddImages([FromForm] List<IFormFile> files, [FromForm] string metadataJson)
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "Vui lòng chọn ít nhất 1 ảnh để upload." });
            }

            if (!TryDeserializeMetadata<List<Image>>(metadataJson, out var images) || images == null || images.Count != files.Count)
            {
                return BadRequest(new { message = "Số lượng ảnh và metadata không khớp hoặc metadata không hợp lệ." });
            }

            return await ExecuteInTransactionAsync(async (connection, transaction) =>
            {
                //Xóa hết ảnh trong "SK01" nếu có EventId = "SK01"
                if (images.Any(x => x.EventId == "SK01"))
                {
                    var oldImages = await connection.QueryAsync<string>(
                "SELECT Path FROM Image WHERE EventId = @EventId", new { EventId = "SK01" }, transaction);

                    foreach (var filePath in oldImages)
                    {
                        DeleteFile(filePath);
                    }

                    await connection.ExecuteAsync("DELETE FROM Image WHERE EventId = @EventId", new { EventId = "SK01" }, transaction);
                }

                int maxId = await GetMaxIdAsync(connection, transaction, "Image");
                var imagesToInsert = new List<object>();

                for (int i = 0; i < files.Count; i++)
                {
                    var file = files[i];
                    var image = images[i];

                    if (file.Length > 0)
                    {
                        // Lưu ảnh sử dụng hàm dùng chung
                        string fileName = await SaveFileAsync(file, image.TimeOccurs.Year, image.EventId);
                        maxId++;
                        imagesToInsert.Add(new
                        {
                            Id = maxId,
                            image.Name,
                            image.Description,
                            image.TimeOccurs,
                            Path = fileName, // chỉ lưu tên file
                            image.EventId
                        });
                    }
                }

                var sql = "INSERT INTO Image (Id, Name, Description, TimeOccurs, Path, EventId) " +
                          "VALUES (@Id, @Name, @Description, @TimeOccurs, @Path, @EventId)";
                var result = await connection.ExecuteAsync(sql, imagesToInsert, transaction);
                return Ok(new { message = $"Thêm {result} ảnh thành công." });
            });
        }

        // 🟠 Cập nhật thông tin ảnh
        [HttpPut("update/{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateImage(int id, [FromForm] IFormFile? file, [FromForm] string metadataJson)
        {
            try
            {
                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    // Lấy thông tin ảnh cũ
                    var oldImage = await connection.QueryFirstOrDefaultAsync<Image>(
                        "SELECT * FROM Image WHERE Id = @Id", new { Id = id });

                    if (oldImage == null)
                    {
                        return NotFound(new { message = "Không tìm thấy ảnh để cập nhật." });
                    }

                    if (!TryDeserializeMetadata<Image>(metadataJson, out var model) || model == null)
                    {
                        return BadRequest(new { message = "Metadata không hợp lệ." });
                    }

                    string newFilePath = oldImage.Path; // Giữ nguyên ảnh cũ nếu không có ảnh mới

                    if (file != null && file.Length > 0)
                    {
                        // Xóa ảnh cũ (nếu có)
                        if (!string.IsNullOrEmpty(oldImage.Path))
                        {
                            DeleteFile(oldImage.Path);
                        }

                        // Lưu ảnh mới
                        newFilePath = await SaveFileAsync(file, model.TimeOccurs.Year, model.EventId);
                    }

                    var sql = "UPDATE Image SET Name = @Name, Description = @Description, TimeOccurs = @TimeOccurs, Path = @Path WHERE Id = @Id";
                    var result = await connection.ExecuteAsync(sql, new
                    {
                        model.Name,
                        model.Description,
                        model.TimeOccurs,
                        Path = newFilePath,
                        Id = id
                    });

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

            return await ExecuteInTransactionAsync(async (connection, transaction) =>
            {
                var queryGetImages = "SELECT * FROM Image WHERE Id IN @Ids";
                var images = (await connection.QueryAsync<Image>(queryGetImages, new { Ids = imageIds }, transaction)).ToList();

                if (images.Count == 0)
                    return NotFound(new { message = "Không tìm thấy ảnh nào để xóa." });

                int maxId = await GetMaxIdAsync(connection, transaction, "DeletedImages");
                var imagesToInsert = new List<object>();

                foreach (var image in images)
                {
                    maxId++;
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
                    var queryInsert = @"
                        INSERT INTO DeletedImages (Id, Name, Description, TimeOccurs, Path, EventId)
                        VALUES (@Id, @Name, @Description, @TimeOccurs, @Path, @EventId)";
                    await connection.ExecuteAsync(queryInsert, imagesToInsert, transaction);
                }

                var queryDelete = "DELETE FROM Image WHERE Id IN @Ids";
                await connection.ExecuteAsync(queryDelete, new { Ids = imageIds }, transaction);

                return Ok(new { message = "Xóa tạm thành công.", deletedCount = imagesToInsert.Count });
            });
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

            return await ExecuteInTransactionAsync(async (connection, transaction) =>
            {
                var queryGet = "SELECT * FROM DeletedImages WHERE Id IN @Ids";
                var deletedImages = (await connection.QueryAsync<Image>(queryGet, new { Ids = imageIds }, transaction)).ToList();

                if (!deletedImages.Any())
                    return NotFound(new { message = "Không tìm thấy ảnh nào để khôi phục." });

                int maxId = await GetMaxIdAsync(connection, transaction, "Image");
                var imagesToRestore = new List<object>();

                foreach (var image in deletedImages)
                {
                    maxId++;
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
                    var queryInsert = @"
                        INSERT INTO Image (Id, Name, Description, TimeOccurs, Path, EventId)
                        VALUES (@Id, @Name, @Description, @TimeOccurs, @Path, @EventId)";
                    await connection.ExecuteAsync(queryInsert, imagesToRestore, transaction);
                }

                var queryDelete = "DELETE FROM DeletedImages WHERE Id IN @Ids";
                await connection.ExecuteAsync(queryDelete, new { Ids = imageIds }, transaction);

                return Ok(new { message = "Khôi phục ảnh thành công.", restoredCount = imagesToRestore.Count });
            });
        }

        // Xóa nhiều ảnh, xóa thật
        [HttpDelete("permanent-delete")]
        public async Task<IActionResult> DeleteImagesPermanently([FromBody] List<int> imageIds)
        {
            if (imageIds == null || !imageIds.Any())
                return BadRequest(new { message = "Danh sách ID không hợp lệ." });

            return await ExecuteInTransactionAsync(async (connection, transaction) =>
            {
                var queryGetPaths = "SELECT Path FROM DeletedImages WHERE Id IN @Ids";
                var imagePaths = (await connection.QueryAsync<string>(queryGetPaths, new { Ids = imageIds }, transaction)).ToList();

                if (!imagePaths.Any())
                    return NotFound(new { message = "Không tìm thấy ảnh nào để xóa." });

                var queryDelete = "DELETE FROM DeletedImages WHERE Id IN @Ids";
                await connection.ExecuteAsync(queryDelete, new { Ids = imageIds }, transaction);

                foreach (var imagePath in imagePaths)
                {
                    DeleteFile(imagePath);
                }

                return Ok(new { message = "Xóa ảnh vĩnh viễn thành công.", deletedCount = imagePaths.Count });
            });
        }
    }


}
