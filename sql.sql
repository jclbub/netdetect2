CREATE TABLE networks(
    id INT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(20) UNIQUE,
    mac_address VARCHAR(20),
    hostname VARCHAR(255),
    manufacturer VARCHAR(255),
    device_type VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

create table bandwidth(
    bandwidth int primary key auto_increment,
    device_id int not null,
    upload float not null,
    download float not null,
    created_at datetime default current_timestamp
);

create table notification(
    noti_id int primary key auto_increment,
    device_id int not null,
    types varchar(20) not null,
    remarks varchar(100) not null,
    created_at datetime default current_timestamp
);