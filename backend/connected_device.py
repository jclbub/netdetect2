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
                    "device_type": device_type,  # Added device type
                    "connections": connection_counts.get(ip_address, 0),
                    # Match frontend format - remove "/s" and units for frontend processing
                    "bandwidth_received": str(int(received_rate)),  # Just the number as string
                    "bandwidth_sent": str(int(sent_rate)),  # Just the number as string
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
        # Don't update the cache if there was an error

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
    # Safely handle any format issues with MAC addresses
    try:
        # This is a simplified approach - in real implementations, 
        # you might want to use a more sophisticated detection method
        wireless_prefixes = [
            "00:1A:2B", "00:17:FA",  
            "F0:1F:AF", "00:22:6B",  
            "00:0D:93", "5C:F3:70",  
            "E8:2A:EA",              
            "00:26:AB", "04:18:D6"   
        ]
        
        for prefix in wireless_prefixes:
            if mac_address and mac_address.upper().startswith(prefix):
                return True
        
        # Default to 50/50 chance for demonstration purposes
        return bool(hash(mac_address) % 2)
    except Exception:
        # Default to wired if we can't determine
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