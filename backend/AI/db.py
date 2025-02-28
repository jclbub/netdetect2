import sqlite3

conn = sqlite3.connect("network_devices.db")
cursor = conn.cursor()

devices = [
    ("1C:1B:0D:46:67:C3", "192.168.3.3", "CRMCTECHNICAL", "ACER", "Laptop"),
    ("70:4D:7B:70:02:B8", "192.168.3.51", "DYVLFM", "Dell", "Desktop"),
    ("F0:2F:74:1E:05:F7", "192.168.3.53", "CRMC-COCPC", "TP-Link", "Router"),
    ("34:97:F6:8F:65:D6", "192.168.3.68", "CRMC-GUIDANCE", "Samsung", "Mobile"),
    ("D8:5E:D3:D2:36:B4", "192.168.3.108", "CCS-PC303", "LG", "Smart TV")
]

for device in devices:
    cursor.execute("INSERT OR IGNORE INTO devices (mac_address, ip_address, hostname, manufacturer, device_type) VALUES (?, ?, ?, ?, ?)", device)

conn.commit()
conn.close()

print("✅ More sample data inserted successfully!")
