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

        // 🟡 Thêm nhiều ảnh cùng lúc
        [HttpPost("add")]
        [Authorize]
        public async Task<IActionResult> AddImages([FromForm] List<IFormFile> files, [FromForm] string metadataJson)
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "Vui lòng chọn ít nhất 1 ảnh để upload." });
            }

            // Chuyển JSON metadata thành danh sách đối tượng
            List<Image> images;
            try
            {
                images = JsonConvert.DeserializeObject<List<Image>>(metadataJson);
                if (images == null || images.Count != files.Count)
                {
                    return BadRequest(new { message = "Số lượng ảnh và metadata không khớp." });
                }
            }
            catch (Exception)
            {
                return BadRequest(new { message = "Metadata không hợp lệ." });
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
                            int maxId = await connection.ExecuteScalarAsync<int>("SELECT ISNULL(MAX(Id), 0) FROM Image", transaction: transaction);

                            var imagesToInsert = new List<object>();

                            for (int i = 0; i < files.Count; i++)
                            {
                                var file = files[i];
                                var image = images[i];

                                if (file.Length > 0)
                                {
                                    // Đặt tên file theo quy tắc: <Năm>_<EventId>_<Guid>.<ext>
                                    string fileName = $"{image.TimeOccurs.Year}_{image.EventId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                                    string filePath = Path.Combine(_uploadFolder, fileName);

                                    // Lưu ảnh vào server
                                    using (var stream = new FileStream(filePath, FileMode.Create))
                                    {
                                        await file.CopyToAsync(stream);
                                    }

                                    // Tăng ID lên 1
                                    maxId++;

                                    // Thêm thông tin vào danh sách lưu DB
                                    imagesToInsert.Add(new
                                    {
                                        Id = maxId,
                                        image.Name,
                                        image.Description,
                                        image.TimeOccurs,
                                        Path = fileName, // Chỉ lưu tên file vào DB
                                        image.EventId
                                    });
                                }
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

                    // Chuyển metadata từ JSON sang object
                    var model = JsonConvert.DeserializeObject<Image>(metadataJson);
                    if (model == null)
                    {
                        return BadRequest(new { message = "Metadata không hợp lệ." });
                    }

                    string newFilePath = oldImage.Path; // Giữ nguyên ảnh cũ nếu không có ảnh mới

                    if (file != null && file.Length > 0)
                    {

                        // Xóa ảnh cũ (nếu có)
                        if (!string.IsNullOrEmpty(oldImage.Path))
                        {
                            string oldFilePath = Path.Combine(_uploadFolder, oldImage.Path);
                            if (System.IO.File.Exists(oldFilePath))
                            {
                                System.IO.File.Delete(oldFilePath);
                            }
                        }

                        // Tạo tên file mới
                        string newFileName = $"{model.TimeOccurs.Year}_{model.EventId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                        newFilePath = newFileName;

                        // Lưu ảnh mới vào server
                        string fullPath = Path.Combine(_uploadFolder, newFileName);
                        using (var stream = new FileStream(fullPath, FileMode.Create))
                        {
                            await file.CopyToAsync(stream);
                        }
                    }

                    // Cập nhật database
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
                        // Lấy danh sách ảnh cần xóa để lấy đường dẫn file
                        var queryGetPaths = "SELECT Path FROM DeletedImages WHERE Id IN @Ids";
                        var imagePaths = (await connection.QueryAsync<string>(queryGetPaths, new { Ids = imageIds }, transaction)).ToList();

                        if (!imagePaths.Any())
                            return NotFound(new { message = "Không tìm thấy ảnh nào để xóa." });

                        // Xóa ảnh khỏi database
                        var queryDelete = "DELETE FROM DeletedImages WHERE Id IN @Ids";
                        await connection.ExecuteAsync(queryDelete, new { Ids = imageIds }, transaction);

                        // Xóa ảnh khỏi thư mục server
                        foreach (var imagePath in imagePaths)
                        {
                            string filePath = Path.Combine(_uploadFolder, imagePath);
                            if (System.IO.File.Exists(filePath))
                            {
                                System.IO.File.Delete(filePath);
                            }
                        }

                        await transaction.CommitAsync();
                        return Ok(new { message = "Xóa ảnh vĩnh viễn thành công.", deletedCount = imagePaths.Count });
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
