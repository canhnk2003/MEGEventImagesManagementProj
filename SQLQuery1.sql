IF EXISTS (SELECT name FROM sys.databases WHERE name = 'ImageManagement')
BEGIN
    --ALTER DATABASE ImageManagement SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE ImageManagement;
END

--USE master;
--GO
--DROP DATABASE ImageManagement;

CREATE DATABASE ImageManagement;
GO
USE ImageManagement;
GO

CREATE TABLE Event (
    Id NVARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(500),
    TimeOccurs DATETIME NOT NULL,
    Status INT
);

CREATE TABLE Image (
    Id INT PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(500),
    TimeOccurs DATETIME NOT NULL,
    Path NVARCHAR(500),
    EventId NVARCHAR(50) NOT NULL,
    FOREIGN KEY (EventId) REFERENCES Event(Id)
);

CREATE TABLE UserAdmin (
    Id NVARCHAR(20) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    Password NVARCHAR(255) NOT NULL
);

CREATE TABLE DeletedImages (
    Id INT PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(500),
    TimeOccurs DATETIME NOT NULL,
    Path NVARCHAR(500),
    EventId NVARCHAR(50) NOT NULL,
    DeletedAt DATETIME DEFAULT GETDATE()
);


-- Thêm dữ liệu vào bảng Event
INSERT INTO Event (Id, Name, Description, TimeOccurs, Status)
VALUES 
('SK1', N'Sinh nhật', N'Kỷ niệm sinh nhật công ty', '2024-06-10', 0 ),
('SK2', N'Kỷ niệm 20 năm', N'Kỷ niệm 20 năm thành lập công ty', '2024-09-15', 0);

-- Thêm dữ liệu vào bảng Image
INSERT INTO Image (Name, Description, TimeOccurs, Path, EventId)
VALUES 
('anh1.jpg', N'Ảnh sinh nhật', '2024-06-10', '/sinhnhat/2024_SK1_anh1.jpg', 'SK1'),
('anh2.jpg', N'Ảnh sinh nhật', '2024-06-10', '/sinhnhat/2024_1_anh2.jpg', 'SK1'),
('anh3.jpg', N'Ảnh kỷ niệm 20 năm', '2024-09-15', '/ky-niem-20-nam/2024_2_anh3.jpg', 'SK2');

-- Thêm dữ liệu vào bảng UserAdmin
INSERT INTO UserAdmin (Id, Name, Username, Password)
VALUES 
('U01', 'Admin', 'admin', 'jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI='),
('U02','Manager', 'manager', '');
-- password admin là: 123456, manager: manager123
SELECT * FROM Event;

SELECT * FROM Image ;
select * from UserAdmin;

select * from DeletedImages;
