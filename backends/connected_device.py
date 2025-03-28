import subprocess
import socket
import re
import time
import psutil
import manuf
from typing import Dict, Tuple
import uvicorn
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from query import create_record, read_records, update_record, delete_record

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the manuf parser with error handling
try:
    parser = manuf.MacParser()
except Exception as e:
    print(f"Warning: Failed to initialize MAC parser: {e}")
    parser = None

# Cached devices and bandwidth tracking
cached_devices = []
bandwidth_stats: Dict[str, Dict] = {}

@app.get("/connected-devices")
async def get_connected_devices(background_tasks: BackgroundTasks):
    global cached_devices
    # Return existing cache immediately
    response = {"connected_devices": cached_devices}
    # Schedule background update without waiting
    background_tasks.add_task(fetch_connected_devices)
    return response

def fetch_connected_devices():
    global cached_devices, bandwidth_stats
    try:
        # Get all network connections
        connections = psutil.net_connections(kind='inet')
        
        # Get current network stats for interfaces
        net_io_counters = psutil.net_io_counters(pernic=True)
        
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
                if remote_ip not in connection_counts:
                    connection_counts[remote_ip] = 0
                connection_counts[remote_ip] += 1
                active_ips.add(remote_ip)
                
                # For local IPs, also add them
                local_ip = conn.laddr.ip
                if local_ip not in connection_counts:
                    connection_counts[local_ip] = 0
                connection_counts[local_ip] += 1
                active_ips.add(local_ip)
        # Update bandwidth stats
        current_time = time.time()
        update_bandwidth_stats(current_time)
        # Build device list
        devices = []
        # Add devices from ARP table (local network)
        for ip_address, mac_address in ip_mac_map.items():
            try:
                # Resolve hostname
                try:
                    hostname = socket.gethostbyaddr(ip_address)[0]
                except socket.herror:
                    hostname = "Unknown"
                
                # Get bandwidth usage (received, sent)
                received_rate, sent_rate = get_bandwidth_for_ip(ip_address)
                
                # Get manufacturer safely
                manufacturer = identify_manufacturer(mac_address)
                
                # Determine device type based on manufacturer and MAC
                device_type = determine_device_type(manufacturer, mac_address, hostname)
                
                # Determine connection type
                connection_type = "wireless" if is_wireless_device(mac_address) else "wired"
                
                devices.append({
                    "ip_address": ip_address,
                    "mac_address": mac_address,
                    "hostname": hostname,
                    "manufacturer": manufacturer,
                    "device_type": device_type, 
                    "connections": connection_counts.get(ip_address, 0),
                    "bandwidth_received": str(int(received_rate)),
                    "bandwidth_sent": str(int(sent_rate)), 
                    "connection_type": connection_type,
                    "status": "idle" if ip_address in active_ips else "active"
                })

                create_record({
                    "ip_address": ip_address,
                    "mac_address": mac_address,
                    "hostname": hostname,
                    "manufacturer": manufacturer,
                    "device_type": device_type,  
                    "status": "idle" if ip_address in active_ips else "active"
                })
            except Exception as e:
                print(f"Error processing device {ip_address}: {e}")
                devices.append({
                    "ip_address": ip_address,
                    "mac_address": mac_address,
                    "hostname": "Unknown",
                    "manufacturer": "Unknown",
                    "device_type": "unknown",  
                    "connection_type": "unknown",
                    "status": "active" if ip_address in active_ips else "idle"
                })

                create_record({
                    "ip_address": ip_address,
                    "mac_address": mac_address,
                    "hostname": "Unknown",
                    "manufacturer": "Unknown",
                    "device_type": "unknown",  
                    "status": "active" if ip_address in active_ips else "idle"
                })


        if devices:
            cached_devices = devices

    except Exception as e:
        print(f"Error fetching connected devices: {e}")

def determine_device_type(manufacturer, mac_address, hostname):
    """
    Determine device type based on manufacturer, MAC address, and hostname patterns
    """
    # Convert to uppercase for consistent matching
    manufacturer = manufacturer.upper() if manufacturer else "UNKNOWN"
    mac_address = mac_address.upper() if mac_address else ""
    hostname = hostname.upper() if hostname else ""
    
    # Network equipment
    if any(name in manufacturer for name in ["CISCO", "UBIQUITI", "NETGEAR", "TP-LINK", "D-LINK", "ZYXEL"]):
        if any(name in manufacturer for name in ["ROUTER", "GATEWAY"]):
            return "Router"
        elif "SWITCH" in manufacturer:
            return "Switch"
        elif any(keyword in manufacturer.upper() for keyword in ["ACCESS POINT", "AP"]):
            return "Access Point"
        else:
            return "Network Device"
    
    # Specific manufacturer conditions
    elif "HUAWEIDE" in manufacturer:
        return "Router"
    elif "IPV4MCAST" in manufacturer:
        return "Access Point"
    elif "GIGA" in manufacturer or "GIGA-BYTE" in manufacturer:
        return "Desktop"
    elif "LCFCHEFE" in manufacturer:
        return "Laptop"
    elif "ASIXELEC" in manufacturer:
        return "Laptop"
    elif "PEGATRON" in manufacturer:
        return "PC"
    
    # Apple devices - more specific identification
    elif any(name in manufacturer for name in ["APPLE"]):
        if any(name in hostname for name in ["IPHONE", "IPAD"]):
            return "iPhone/iPad"
        elif any(name in hostname for name in ["MACBOOK"]):
            return "MacBook"
        elif any(name in hostname for name in ["IMAC"]):
            return "iMac"
        elif any(name in hostname for name in ["MACMINI"]):
            return "Mac Mini"
        else:
            return "Apple Device"
    
    # Mobile devices (Android)
    elif any(name in manufacturer for name in ["SAMSUNG", "XIAOMI", "HUAWEI", "LG", "MOTOROLA"]):
        # Try to differentiate between phones and tablets
        if "TABLET" in hostname or "TAB" in hostname:
            return "Tablet"
        else:
            return "Smartphone"
    
    # Computer manufacturers - try to differentiate between desktops and laptops
    elif any(name in manufacturer for name in ["DELL", "HP", "LENOVO", "ASUS", "ACER", "TOSHIBA"]):
        # Check for laptop-specific indicators in hostname or model names
        if any(keyword in hostname for keyword in ["LAPTOP", "NOTEBOOK", "THINKPAD", "IDEAPAD", "ENVY", "PAVILION", 
                                               "INSPIRON", "XPS", "VOSTRO", "LATITUDE", "PROBOOK", "ELITEBOOK",
                                               "ZBOOK", "VIVOBOOK", "ZENBOOK"]):
            return "Laptop"
        elif any(keyword in hostname for keyword in ["DESKTOP", "WORKSTATION", "TOWER", "OPTIPLEX", 
                                                 "PRECISION", "PRODESK", "ELITEDESK", "COMPAQ"]):
            return "Desktop"
        else:
            return "PC"
    
    # Microsoft devices
    elif "MICROSOFT" in manufacturer:
        if "XBOX" in hostname:
            return "Xbox"
        elif "SURFACE" in hostname:
            return "Surface"
        else:
            return "Microsoft Device"
    
    # IoT and smart home devices
    elif any(name in manufacturer for name in ["NEST", "RING", "PHILIPS", "HUE", "ECOBEE", "AMAZON"]):
        if "ALEXA" in hostname or "ECHO" in hostname:
            return "Smart Speaker"
        elif "THERMOSTAT" in hostname:
            return "Smart Thermostat"
        elif "CAMERA" in hostname:
            return "Smart Camera"
        else:
            return "Smart Home Device"
    
    # Gaming consoles
    elif "SONY" in manufacturer:
        if "PLAYSTATION" in hostname or "PS" in hostname:
            return "PlayStation"
        else:
            return "Sony Device"
    elif "NINTENDO" in manufacturer:
        return "Nintendo Switch"
    
    # Raspberry Pi and similar
    elif "RASPBERRY" in manufacturer:
        return "Raspberry Pi"
    
    # Virtual machines
    elif "VMWARE" in manufacturer or "VIRTUAL" in manufacturer:
        return "Virtual Machine"
    
    # Default fallback - use hostname indicators without relying on connection type
    else:
        # Try to determine based on hostname patterns
        if any(keyword in hostname for keyword in ["PHONE", "MOBILE"]):
            return "Smartphone"
        elif any(keyword in hostname for keyword in ["TABLET", "PAD"]):
            return "Tablet"
        elif any(keyword in hostname for keyword in ["LAPTOP", "NOTEBOOK"]):
            return "Laptop"
        elif any(keyword in hostname for keyword in ["SERVER", "NAS"]):
            return "Server"
        elif any(keyword in hostname for keyword in ["DESKTOP", "PC", "TOWER"]):
            return "Desktop"
        else:
            return "Device"

def hostname_contains(hostname, keywords):
    """
    Helper function to check if hostname contains any of the keywords
    """
    if not hostname:
        return False
        
    hostname = hostname.upper()
    for keyword in keywords:
        if keyword.upper() in hostname:
            return True
    return False

def is_wireless_device(mac_address):
    """
    Determine if a device is wireless or wired based on MAC address, OUI prefixes,
    and additional heuristics.
    
    Args:
        mac_address (str): The MAC address of the device
        
    Returns:
        bool: True if the device is likely wireless, False if likely wired
    """
    if not mac_address or len(mac_address) < 8:
        return False
        
    try:
        # Normalize MAC address format
        mac = mac_address.upper().replace("-", ":")
        
        # Common wireless device manufacturer OUI prefixes
        wireless_prefixes = [
            # Common WiFi adapters and mobile devices
            "00:1A:2B", "00:17:FA", "F0:1F:AF", "00:22:6B", "00:0D:93", "5C:F3:70", "E8:2A:EA", 
            "00:26:AB", "04:18:D6", "78:31:C1", "3C:71:BF", "D0:E1:40", "70:56:81", "28:CF:DA",
            
            # Apple wireless devices (iPhones, iPads, MacBooks)
            "34:AB:37", "A8:BB:CF", "00:DB:70", "A4:B1:97", "A8:5C:2C", "70:DE:E2", "90:B0:ED",
            "20:A2:E4", "28:6A:B8", "98:9E:63", "88:19:08", "38:F9:D3", "BC:92:6B", "68:96:7B",
            
            # Samsung mobile devices
            "8C:F5:A3", "B4:3A:28", "78:BD:BC", "A0:21:95", "84:38:35", "50:01:BB", "C8:14:79", 
            "14:49:E0", "94:35:0A", "F8:3F:51", "18:89:5B", "2C:AE:2B", "C4:57:6E", "68:27:37",
            
            # Google devices (Pixel phones, Chromebooks)
            "00:1A:11", "AC:67:B2", "3C:5A:B4", "48:D6:D5", "54:60:09", "94:EB:2C", "A4:77:33",
            
            # Intel wireless adapters
            "00:08:9F", "00:13:E8", "00:13:02", "00:15:00", "00:16:EA", "00:1C:BF", "00:1D:E1",
            "00:1E:64", "00:1E:65", "00:1F:3B", "00:21:5C", "00:21:5D", "00:22:FB", "00:24:D7",
            
            # Broadcom wireless 
            "00:10:18", "00:0A:F7", "00:1A:73", "00:25:00", "D4:01:29", "B0:26:28", "20:76:8F",
            
            # Qualcomm Atheros
            "00:03:7F", "00:13:74", "00:1D:6A", "00:24:33", "00:26:5E", "28:80:23", "D8:C7:C8",
            
            # Xiaomi, OnePlus, and other Android devices
            "64:A2:F9", "8C:BE:BE", "F8:A4:5F", "28:6C:07", "C4:0B:CB", "C0:EE:FB", "50:64:2B",
            
            # Laptop manufacturers' common wireless interfaces
            "18:4F:32", "70:1C:E7", "68:A3:C4", "94:B8:6D", "54:35:30", "D4:25:8B", "04:0E:3C"
        ]
        
        for prefix in wireless_prefixes:
            if mac.startswith(prefix):
                return True
        
        wired_prefixes = [
            # Common network equipment
            "00:01:42", "00:04:00", "00:0D:88", "00:0E:08", "00:11:11", "00:14:BF", "00:15:E8",
            "00:18:AE", "00:1A:4D", "00:1B:78", "00:21:19", "00:21:A0", "00:26:99", "00:E0:4C",
            
            # Cisco switches and routers
            "00:16:C7", "00:17:0E", "00:18:18", "00:1A:2F", "00:1A:A1", "00:1B:53", "00:1B:D4",
            "00:1C:57", "00:1C:58", "00:1D:E5", "00:1E:BD", "00:1F:C9", "00:1F:CA", "00:21:29",
            
            # Server NICs
            "00:15:17", "00:17:A4", "00:1A:92", "00:1B:21", "00:1D:09", "00:1E:0B", "00:1E:C9",
            "00:21:5A", "00:25:64", "00:26:55", "00:1B:21", "00:14:2A", "00:21:9B", "00:25:90",
            
            # Dell, HP, IBM and other servers
            "00:12:3F", "00:14:4F", "00:18:8B", "00:19:B9", "00:21:9B", "00:21:F6", "00:22:19",
            "00:24:E8", "00:26:6C", "00:30:48", "00:15:C5", "00:17:A4", "00:21:5A", "00:0D:56"
        ]
        
        for prefix in wired_prefixes:
            if mac.startswith(prefix):
                return False
                
        if "intel" in mac.lower() and any(x in mac.lower() for x in ["wifi", "wireless", "centrino"]):
            return True

        second_digit = mac[1]
        if second_digit in "26AE":
            return True
            
        iot_patterns = ["esp", "nest", "ring", "xiaomi", "tuya", "sonoff", "tplink"]
        if any(pattern in mac.lower() for pattern in iot_patterns):
            return True

        if "vmware" in mac.lower() or "virtual" in mac.lower():
            # 
            return True

        mac_value = int(mac.replace(":", ""), 16)
        return mac_value % 10 < 7 
        
    except Exception as e:
        print(f"Error determining wireless status for {mac_address}: {e}")
        return False

def update_bandwidth_stats(current_time):
    """Update bandwidth statistics for all network interfaces"""
    global bandwidth_stats
    
    try:
        # Get current network IO counters
        net_io = psutil.net_io_counters(pernic=True)
        
        # Update stats for each interface
        for interface, counters in net_io.items():
            if interface not in bandwidth_stats:
                bandwidth_stats[interface] = {
                    "time": current_time,
                    "bytes_sent": counters.bytes_sent,
                    "bytes_recv": counters.bytes_recv
                }
                continue
                
            # Calculate rates
            prev_stats = bandwidth_stats[interface]
            time_diff = current_time - prev_stats["time"]
            
            if time_diff > 0:
                sent_rate = (counters.bytes_sent - prev_stats["bytes_sent"]) / time_diff
                recv_rate = (counters.bytes_recv - prev_stats["bytes_recv"]) / time_diff
                
                # Store rates
                bandwidth_stats[interface]["sent_rate"] = sent_rate
                bandwidth_stats[interface]["recv_rate"] = recv_rate
            
            # Update current values
            bandwidth_stats[interface]["time"] = current_time
            bandwidth_stats[interface]["bytes_sent"] = counters.bytes_sent
            bandwidth_stats[interface]["bytes_recv"] = counters.bytes_recv
    except Exception as e:
        print(f"Error updating bandwidth stats: {e}")

def get_bandwidth_for_ip(ip_address):
    """
    Estimate bandwidth for a specific IP by distributing interface bandwidth
    across connected devices.
    """
    try:
        global bandwidth_stats, cached_devices
        
        # Find primary interface (the one with the most traffic)
        max_interface = None
        max_rate = 0
        
        for interface, stats in bandwidth_stats.items():
            if "sent_rate" not in stats:
                continue
            
            total_rate = stats.get("sent_rate", 0) + stats.get("recv_rate", 0)
            if total_rate > max_rate:
                max_rate = total_rate
                max_interface = interface
        
        if not max_interface:
            return 0, 0
        
        # Get device count (excluding special IPs)
        device_count = len([d for d in cached_devices 
                        if not (d["ip_address"].startswith("224.") or 
                              d["ip_address"].endswith(".255"))])
        
        if device_count == 0:
            device_count = 1  # Avoid division by zero
        
        # Get interface stats
        stats = bandwidth_stats[max_interface]
        
        # Distribute bandwidth evenly as an estimation
        # In a real-world scenario, you'd use a more sophisticated method
        recv_rate = stats.get("recv_rate", 0) / device_count
        sent_rate = stats.get("sent_rate", 0) / device_count
        
        # Adjust for special IPs (multicast, broadcast)
        if ip_address.startswith("224.") or ip_address.endswith(".255"):
            recv_rate *= 0.1  # Reduce for special addresses
            sent_rate *= 0.1
        
        return recv_rate, sent_rate
    except Exception as e:
        print(f"Error calculating bandwidth for {ip_address}: {e}")
        return 0, 0

def identify_manufacturer(mac_address):
    """
    Identify the manufacturer based on MAC address.
    Falls back to hardcoded list if manuf package fails.
    """
    try:
        # First try using manuf if available
        if parser:
            manufacturer = parser.get_manuf(mac_address)
            if manufacturer:
                return manufacturer
        
        # Fallback to hardcoded lookup
        oui = mac_address[:8].upper()
        manufacturers = {
            "48:21:0B": "TP-Link",
            "74:56:3C": "Lenovo",
            "D4:BB:E6": "Cisco",
            "B4:A9:FC": "Dell",
            "04:92:26": "HP",
            "00:D8:61": "Acer",
            "9C:6B:00": "Toshiba",
            "00:1A:2B": "Apple",
            "00:17:FA": "Apple",
            "B8:27:EB": "Raspberry Pi Foundation",
            "00:1E:58": "Sony",
            "3C:D9:2B": "Sony",
            "00:0C:29": "VMware",
            "00:50:56": "VMware",
            "F0:1F:AF": "Netgear",
            "00:22:6B": "Netgear",
            "00:23:69": "Netgear",
            "00:04:96": "Cisco",
            "00:1B:63": "Cisco",
            "00:0D:93": "Samsung",
            "5C:F3:70": "Samsung",
            "C8:3A:35": "Samsung",
            "00:14:BF": "Intel",
            "00:1C:C0": "Intel",
            "00:21:6A": "Intel",
            "F8:1A:67": "Huawei",
            "D8:3C:69": "Huawei",
            "00:26:4D": "Huawei",
            "00:1E:C2": "Xiaomi",
            "FC:19:10": "Xiaomi",
            "78:02:B7": "Xiaomi",
            "00:1A:73": "ASUS",
            "D8:50:E6": "ASUS",
            "00:23:CD": "ASUS",
            "E8:2A:EA": "LG Electronics",
            "00:24:32": "LG Electronics",
            "00:09:0F": "D-Link",
            "00:1D:0F": "D-Link",
            "50:46:5D": "D-Link",
            "00:0E:C6": "Zyxel",
            "00:1B:2F": "Zyxel",
            "00:90:A2": "Zyxel",
            "00:23:20": "Microsoft",
            "00:15:5D": "Microsoft",
            "10:60:4B": "Microsoft",
            "00:16:EA": "Motorola",
            "00:04:5A": "Motorola",
            "00:0C:E5": "Motorola",
            "00:26:AB": "Ubiquiti Networks",
            "04:18:D6": "Ubiquiti Networks",
            "24:A4:3C": "Ubiquiti Networks"
        }
        
        return manufacturers.get(oui, "Unknown")
    except Exception as e:
        print(f"Error identifying manufacturer for {mac_address}: {e}")
        return "Unknown"

def format_bytes(bytes_value, decimals=2):
    """
    Convert bytes to a human-readable format.
    """
    try:
        if not isinstance(bytes_value, (int, float)) or bytes_value < 0:
            bytes_value = 0
            
        if bytes_value == 0:
            return "0 B"
            
        k = 1024
        sizes = ["B", "KB", "MB", "GB", "TB"]
        
        i = 0
        while bytes_value >= k and i < len(sizes) - 1:
            bytes_value /= k
            i += 1
            
        return f"{round(bytes_value, decimals)} {sizes[i]}/s"
    except Exception:
        return "0 B/s"

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)