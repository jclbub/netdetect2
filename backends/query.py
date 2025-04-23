import psutil
import subprocess
import re
import socket
import time
import mysql.connector


def get_connection():
    """Establish a connection to the MySQL database."""
    try:
        conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password="Techie@2024",
            database="netdetect"
        )
        return conn
    except mysql.connector.Error as err:
        print(f"Database Connection Error: {err}")
        return None

def create_record(data):
    """Insert or update a device in the database."""
    conn = get_connection()
    if conn:
        try:
            cursor = conn.cursor()
            query = """
            INSERT INTO networks (ip_address, mac_address, hostname, manufacturer, device_type, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE 
                mac_address = VALUES(mac_address),
                hostname = VALUES(hostname),
                manufacturer = VALUES(manufacturer),
                device_type = VALUES(device_type),
                status = VALUES(status),
                updated_at = CURRENT_TIMESTAMP;
            """
            cursor.execute(query, (
                data["ip_address"], 
                data["mac_address"], 
                data["hostname"], 
                data["manufacturer"], 
                data["device_type"], 
                data["status"]
            ))
            conn.commit()
            # print(f"Inserted/Updated device: {data['ip_address']}")
        except mysql.connector.Error as err:
            print(f"Database Error: {err}")
        finally:
            cursor.close()
            conn.close()


def fetch_connected_devices():
    try:
        # Get all network connections
        connections = psutil.net_connections(kind='inet')
        
        # Run ARP scan to get device info
        result = subprocess.run(["arp", "-a"], capture_output=True, text=True)
        if result.returncode != 0:
            print("Failed to retrieve connected devices")
            return

        # Parse ARP table to get IP and MAC mappings
        ip_mac_map = {}
        for line in result.stdout.split("\n"):
            match = re.search(r"(\d+\.\d+\.\d+\.\d+)\s+([a-fA-F0-9:-]+)", line)
            if match:
                ip_address = match.group(1)
                mac_address = match.group(2).replace("-", ":").upper()
                ip_mac_map[ip_address] = mac_address

        # Track active connections
        active_ips = set()
        connection_counts = {}
        
        for conn in connections:
            if conn.laddr and conn.raddr:  # Only count established connections
                remote_ip = conn.raddr.ip
                local_ip = conn.laddr.ip
                connection_counts[remote_ip] = connection_counts.get(remote_ip, 0) + 1
                connection_counts[local_ip] = connection_counts.get(local_ip, 0) + 1
                active_ips.update([remote_ip, local_ip])
        
        # Process detected devices
        for ip_address, mac_address in ip_mac_map.items():
            try:
                hostname = socket.gethostbyaddr(ip_address)[0] if socket.gethostbyaddr(ip_address) else "Unknown"
                device_data = {
                    "ip_address": ip_address,
                    "mac_address": mac_address,
                    "hostname": hostname,
                    "manufacturer": "Unknown",  # Placeholder, implement lookup if needed
                    "device_type": "unknown",  # Placeholder, implement classification if needed
                    "connections": connection_counts.get(ip_address, 0),
                    "bandwidth_received": 0,  # Placeholder, implement bandwidth tracking if needed
                    "bandwidth_sent": 0,
                    "connection_type": "unknown",  # Placeholder, implement wired/wireless detection
                    "status": "active" if ip_address in active_ips else "idle"
                }
                create_record(device_data)
            except Exception as e:
                print(f"Error processing device {ip_address}: {e}")
    except Exception as e:
        print(f"Error fetching connected devices: {e}")

def read_records(table):
    conn = get_connection()
    if conn:
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(f"SELECT * FROM {table}")
            records = cursor.fetchall()
            return records  
        except Exception as err:
            print(f"Error: {err}")
        finally:
            cursor.close()
            conn.close()

def update_record(table, column, new_value, condition):
    conn = get_connection()
    if conn:
        try:
            cursor = conn.cursor()
            query = f"UPDATE {table} SET {column} = %s WHERE {condition}"
            cursor.execute(query, (new_value,))
            conn.commit()
            print("Record updated successfully!")
        except Exception as err:
            print(f"Error: {err}")
        finally:
            cursor.close()
            conn.close()

def delete_record(table, condition):
    conn = get_connection()
    if conn:
        try:
            cursor = conn.cursor()
            query = f"DELETE FROM {table} WHERE {condition}"
            cursor.execute(query)
            conn.commit()
            print("Record deleted successfully!")
        except Exception as err:
            print(f"Error: {err}")
        finally:
            cursor.close()
            conn.close()

# Export the CRUD functions
__all__ = ["create_record", "read_records", "update_record", "delete_record", "fetch_connected_devices"]
