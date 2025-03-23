using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

namespace MEGEventImageManagement
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            var key = Encoding.UTF8.GetBytes("my-super-secret-key-that-is-long-enough");

            // Add services to the container.

            builder.Services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
            }).AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,  // ✅ Kiểm tra thời gian hết hạn của Access Token
                    ClockSkew = TimeSpan.Zero // ✅ Hạn chế thời gian trễ mặc định của JWT (mặc định là 5 phút)
                };
            });

            // Thêm dịch vụ CORS
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.AllowAnyOrigin()   // Cho phép bất kể nguồn gốc (origin) nào
                          .AllowAnyMethod()   // Cho phép tất cả các phương thức HTTP (GET, POST, PUT, DELETE, v.v.)
                          .AllowAnyHeader();  // Cho phép tất cả các header
                });
            });

            //Cho phép upload file tối đa 150 MB
            builder.WebHost.ConfigureKestrel(options =>
            {
                options.Limits.MaxRequestBodySize = 157286400; // 150MB
            });

            builder.Services.AddAuthentication();

            // ✅ Thêm Authorization vào Services
            builder.Services.AddAuthorization();

            // ✅ Đăng ký HttpContextAccessor (nếu cần lấy thông tin User từ HttpContext)
            builder.Services.AddHttpContextAccessor();

            builder.Services.AddControllers();
            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "MEGEventImageManagement API", Version = "v1" });

                // Thêm xác thực JWT Bearer Token vào Swagger
                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Description = "Nhập token vào ô bên dưới theo định dạng: Bearer {your_token}",
                    Name = "Authorization",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT"
                });

                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            var app = builder.Build();

            // ✅ Đặt CORS ngay sau UseRouting()
            app.UseRouting();
            app.UseCors("AllowAll");

            // ✅ Cho phép truy cập ảnh từ thư mục tĩnh `/uploads`
            app.UseStaticFiles(new StaticFileOptions
            {
                OnPrepareResponse = ctx =>
                {
                    ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*"); // ✅ Bật CORS cho file tĩnh
                }
            });

            // ✅ Authentication & Authorization
            app.UseAuthentication();
            app.UseAuthorization();

            

            // ✅ Cấu hình Swagger UI chỉ trong môi trường Development
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            // ✅ Bật HTTPS Redirect
            app.UseHttpsRedirection();

            // ✅ Map API Controllers
            app.MapControllers();

            app.Run();
        }
    }
}