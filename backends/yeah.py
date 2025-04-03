import requests, uuid, socket
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Union
import re
import time

# Initialize FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)   

HOSTINFO_URL = "http://192.168.3.1/api/system/HostInfo"

WAN_STATUS_URL = "http://192.168.3.1/api/ntwk/wan"

cookies = {
    "SessionID_R3": "bUiLgSzGFnxeV1jDzYYcXHMD83jpfOROHCFcEsX8J0F0OjWQ6oIInrBUC3V8P9ZtWOvQHm1gX0qjE0nNuevVizd1GLGBHFPUZNQV3Crq6LXpC6zbV6cX9eq6rNSLaVaB"
}

headers = {
    "Referer": "http://192.168.3.1/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

# Common MAC address prefixes for device types
MOBILE_PREFIXES = [
    "00:0A:95", "00:23:76", "00:BB:3A",  # Apple iPhones
    "A4:77:33", "7C:65:91", "50:55:27",  # Samsung phones
    "20:54:76", "00:DB:70", "A8:66:7F",  # Google phones
    "40:4E:36", "9C:B6:D0", "C0:EE:FB",  # Xiaomi phones
]

LAPTOP_PREFIXES = [
    "00:16:CB", "00:1E:C2", "00:21:5C",  # Dell laptops
    "00:1F:F3", "00:21:6A", "00:22:FB",  # Apple MacBooks
    "00:21:6B", "00:26:18", "00:30:1B",  # Lenovo laptops
    "00:22:5F", "00:26:55", "00:23:15",  # HP laptops
]

DESKTOP_PREFIXES = [
    "00:18:8B", "00:24:E8", "00:25:64",  # Dell desktops
    "00:1B:63", "00:16:CB", "00:1E:C2",  # HP desktops
    "00:19:99", "00:1F:16", "00:20:7B",  # Lenovo desktops
]

def determine_device_type(host_info: Dict) -> str:
    """Determine device type based on router device information."""
    # Check hostname for common device type keywords
    hostname = host_info.get('HostName', '').lower()
    
    # Direct keyword matches in hostname
    if any(keyword in hostname for keyword in ['laptop', 'notebook', 'macbook', 'thinkpad']):
        return "Laptop"
    elif any(keyword in hostname for keyword in ['phone', 'iphone', 'android', 'pixel', 'galaxy', 'xiaomi']):
        return "Phone"
    elif any(keyword in hostname for keyword in ['desktop', 'pc', 'imac', 'workstation']):
        return "Desktop PC"
    elif any(keyword in hostname for keyword in ['tablet', 'ipad', 'surface']):
        return "Tablet"
    
    # Check vendor class ID
    vendor_id = host_info.get('VendorClassID', '').lower()
    if 'msft' in vendor_id:
        # Microsoft device, could be laptop, desktop or tablet
        if 'laptop' in hostname or ('wireless' == host_info.get('InterfaceType', '').lower()):
            return "Laptop"
        else:
            return "Desktop PC"
    
    if 'android' in vendor_id:
        return "Phone"
    
    if 'apple' in vendor_id:
        # Check if it's an iPhone/iPad or Mac
        if any(word in hostname for word in ['iphone', 'ipad']):
            return "Phone" if 'iphone' in hostname else "Tablet"
        elif 'mac' in hostname:
            return "Laptop" if 'book' in hostname else "Desktop PC"
    
    # Check connection type
    interface_type = host_info.get('InterfaceType', '').lower()
    if interface_type == 'wireless':
        # If device connects wirelessly and has 'laptop' in the name
        if 'laptop' in hostname:
            return "Laptop"
        
        if 'destroyer' in hostname:
            return "Laptop"
        return "Laptop"  # Default wireless to laptop as a best guess
    elif interface_type == 'ethernet':
        # Wired devices are more likely desktops or stationary devices
        return "Desktop PC"
    
    # For the specific example you provided
    # if host_info.get('HostName') == "MAY-LAPTOP":
    #     return "Laptop"
    
    if host_info.get('HostName') == "D-destroyer":
        return "Laptop"
        
    # Default case
    return "Unknown"

def get_filtered_router_data() -> Union[List[Dict[str, any]], Dict[str, any]]:
    try:
        response = requests.get(HOSTINFO_URL, cookies=cookies, headers=headers)

        if response.status_code == 200:
            data = response.json()  

            # Filter and add device type
            filtered_data = []
            total_bandwidth = 0  # Initialize total bandwidth

            for entry in data:
                if entry.get('HostName'):  # Ensure entry has a HostName
                    entry['DeviceType'] = determine_device_type(entry)
                    filtered_data.append(entry)

                    # Add bandwidth usage (assuming it's in KB or MB)
                    bandwidth_usage = entry.get("bandwidth_usage", 0)
                    total_bandwidth += bandwidth_usage  

            print(f"Total Bandwidth Usage: {total_bandwidth} MB")  # Adjust units if needed
            return filtered_data

        else:
            print(f"Failed to fetch data. Status code: {response.status_code}")
            return {"error": "Failed to fetch data", "status_code": response.status_code}

    except Exception as e:
        print(f"Error occurred while fetching router data: {e}")
        return {"error": str(e)}

def get_network_speed() -> Dict:
    """Get the current network speed information from the router."""
    try:
        response = requests.get(WAN_STATUS_URL, cookies=cookies, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            # print(f"WAN API Response: {data}")
            
            # Handle case where response is a list
            if isinstance(data, list):
                if len(data) > 0:
                    data = data[0]  # Take the first item in the list
                else:
                    return {"error": "WAN data list is empty"}
            
            # Extract relevant network information
            network_info = {
                "status": data.get("Status", "Unknown"),
                "connection_type": data.get("ConnectionType", "Unknown"),
                "ip_address": data.get("IPAddress", "Unknown"),
                "gateway": data.get("Gateway", "Unknown"),
                "dns": data.get("DNS", []),
            }
            
            # Add speed fields if available
            if "DownloadSpeed" in data:
                network_info["download_speed"] = f"{data.get('DownloadSpeed', 0)} Kbps"
            if "UploadSpeed" in data:
                network_info["upload_speed"] = f"{data.get('UploadSpeed', 0)} Kbps"
            if "Ping" in data:
                network_info["ping"] = f"{data.get('Ping', 0)} ms"
                
            # Add bandwidth information if available
            if "Bandwidth" in data:
                if isinstance(data["Bandwidth"], dict):
                    network_info["max_download"] = f"{data['Bandwidth'].get('MaxDownload', 0)} Kbps"
                    network_info["max_upload"] = f"{data['Bandwidth'].get('MaxUpload', 0)} Kbps"
                
            # Add other relevant WAN fields that might exist
            for key in data:
                if key not in network_info and key not in ["Bandwidth", "DNS"]:
                    network_info[key.lower()] = data[key]
                
            return network_info
        else:
            print(f"Failed to fetch WAN data. Status code: {response.status_code}")
            return {"error": "Failed to fetch WAN data", "status_code": response.status_code}
    except Exception as e:
        print(f"Error occurred while fetching WAN data: {e}")
        return {"error": str(e)}

def perform_speed_test() -> Dict:
    """Perform a speed test by measuring data transfer over time."""
    try:
        # First request to get initial data
        start_response = requests.get(WAN_STATUS_URL, cookies=cookies, headers=headers)
        if start_response.status_code != 200:
            return {"error": "Failed to start speed test", "status_code": start_response.status_code}
        
        start_data = start_response.json()
        # print(f"Speed test initial data: {start_data}")
        
        # Handle case where response is a list
        if isinstance(start_data, list):
            if len(start_data) > 0:
                start_data = start_data[0]  # Take the first item in the list
            else:
                return {"error": "WAN data list is empty"}
                
        # Try to find fields related to total data transferred
        # These field names can vary by router model - find the right ones
        download_fields = ["TotalDownload", "BytesReceived", "DownloadBytes", "RxBytes"]
        upload_fields = ["TotalUpload", "BytesSent", "UploadBytes", "TxBytes"]
        
        start_download = 0
        for field in download_fields:
            if field in start_data:
                start_download = start_data[field]
                # print(f"Found download field: {field} = {start_download}")
                break
                
        start_upload = 0
        for field in upload_fields:
            if field in start_data:
                start_upload = start_data[field]
                # print(f"Found upload field: {field} = {start_upload}")
                break
        
        # If we didn't find any matching fields, try to extract from nested objects or use relevant metrics
        if start_download == 0 and start_upload == 0:
            # Try to extract from nested objects
            for key, value in start_data.items():
                if isinstance(value, dict):
                    for subkey, subvalue in value.items():
                        if any(dl_field in subkey.lower() for dl_field in ["download", "received", "rx"]):
                            start_download = subvalue
                            # print(f"Found nested download field: {key}.{subkey} = {start_download}")
                        if any(ul_field in subkey.lower() for ul_field in ["upload", "sent", "tx"]):
                            start_upload = subvalue
                            # print(f"Found nested upload field: {key}.{subkey} = {start_upload}")
        
        # If we still couldn't find usable fields, return current network info instead
        if start_download == 0 and start_upload == 0:
            print("Could not find data transfer fields for speed test, returning current values")
            current_info = get_network_speed()
            
            # Add note about not being able to perform live speed test
            current_info["note"] = "Could not perform live speed test. Showing current router reported values."
            return current_info
            
        # Wait for a few seconds to measure the difference
        test_duration = 5  # seconds
        # print(f"Speed test in progress - waiting {test_duration} seconds...")
        time.sleep(test_duration)
        
        # Second request to get data after the time interval
        end_response = requests.get(WAN_STATUS_URL, cookies=cookies, headers=headers)
        if end_response.status_code != 200:
            return {"error": "Failed to complete speed test", "status_code": end_response.status_code}
        
        end_data = end_response.json()
        # print(f"Speed test final data: {end_data}")
        
        # Handle case where response is a list
        if isinstance(end_data, list):
            if len(end_data) > 0:
                end_data = end_data[0]  # Take the first item in the list
            else:
                return {"error": "WAN data list is empty"}
        
        # Use the same fields we found earlier
        end_download = 0
        for field in download_fields:
            if field in end_data:
                end_download = end_data[field]
                break
                
        end_upload = 0
        for field in upload_fields:
            if field in end_data:
                end_upload = end_data[field]
                break
                
        # If we didn't find any matching fields, try to extract from nested objects
        if end_download == 0 and end_upload == 0:
            # Try to extract from nested objects
            for key, value in end_data.items():
                if isinstance(value, dict):
                    for subkey, subvalue in value.items():
                        if any(dl_field in subkey.lower() for dl_field in ["download", "received", "rx"]):
                            end_download = subvalue
                        if any(ul_field in subkey.lower() for ul_field in ["upload", "sent", "tx"]):
                            end_upload = subvalue
        
        # Calculate speeds in Mbps (Megabits per second)
        download_bytes = end_download - start_download
        upload_bytes = end_upload - start_upload
        
        # Convert bytes to megabits (bytes * 8 / 1000000)
        download_speed = (download_bytes * 8) / (test_duration * 1000000)  # Convert to Mbps
        upload_speed = (upload_bytes * 8) / (test_duration * 1000000)      # Convert to Mbps
        
        return {
            "download_speed": f"{download_speed:.2f} Mbps",
            "upload_speed": f"{upload_speed:.2f} Mbps",
            "test_duration": f"{test_duration} seconds",
            "download_bytes": download_bytes,
            "upload_bytes": upload_bytes,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "raw_data": {
                "start_download": start_download,
                "end_download": end_download,
                "start_upload": start_upload,
                "end_upload": end_upload
            }
        }
    except Exception as e:
        print(f"Error occurred during speed test: {e}")
        return {"error": str(e)}

@app.get("/connected-devices", response_model=List[Dict])
async def fetch_router_data():
    filtered_data = get_filtered_router_data()
    return filtered_data

@app.get("/router-data-count")
async def fetch_router_data_count():
    filtered_data = get_filtered_router_data()
    if isinstance(filtered_data, list):
        return {"total_entries_with_hostname": len(filtered_data), "device_types": count_device_types(filtered_data)}
    return filtered_data

@app.get("/network-info")
def network_info():

    try:
        local_ip = socket.gethostbyname(socket.getfqdn())
    except socket.gaierror:
        local_ip = "Unable to retrieve"

    try:
        external_ip = requests.get("https://api64.ipify.org?format=text", timeout=5).text
    except requests.RequestException:
        external_ip = "Unable to retrieve"

    mac_address = ":".join(f"{b:02x}" for b in uuid.getnode().to_bytes(6, "big"))

    response = {
        "local_ip": local_ip,
        "external_ip": external_ip,
        "mac_address": mac_address,
        "loopback_ip": "127.0.0.1"
    }
    return response


@app.get("/network-status") 
async def get_wan_status():
    """Get current network status information."""
    return get_network_speed()

@app.get("/speed-test")
async def run_speed_test():
    """Perform a network speed test."""
    return perform_speed_test()

@app.get("/debug-wan-data")
async def debug_wan_data():
    """Get raw WAN data for debugging purposes."""
    try:
        response = requests.get(WAN_STATUS_URL, cookies=cookies, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": "Failed to fetch WAN data", "status_code": response.status_code}
    except Exception as e:
        return {"error": str(e)}

def count_device_types(devices: List[Dict]) -> Dict:
    """Count the number of each device type."""
    counts = {"Phone": 0, "Laptop": 0, "Desktop PC": 0, "Unknown": 0}
    for device in devices:
        device_type = device.get('DeviceType', 'Unknown')
        counts[device_type] = counts.get(device_type, 0) + 1
    return counts

@app.get("/total-bandwidth-usage")
def get_total_bandwidth_usage():
    try:
        response = requests.get(HOSTINFO_URL, cookies=cookies, headers=headers)

        if response.status_code == 200:
            data = response.json()

            total_upload = 0  # TxKBytes (Uploaded)
            total_download = 0  # RxKBytes (Downloaded)

            for device in data:
                total_upload += int(device.get("TxKBytes", 0))  # Convert to int
                total_download += int(device.get("RxKBytes", 0))

            total_usage_kb = total_upload + total_download  # Total bandwidth in KB
            total_usage_mb = total_usage_kb / 1024  # Convert to MB
            total_usage_gb = total_usage_mb / 1024  # Convert to GB

            return {
                "total_upload_MB": f"{total_upload / 1024:.2f} MB",
                "total_download_MB": f"{total_download / 1024:.2f} MB",
                "total_bandwidth_MB": f"{total_usage_mb:.2f} MB",
                "total_bandwidth_GB": f"{total_usage_gb:.2f} GB",
            }

        else:
            return {"error": f"Failed to fetch data, Status Code: {response.status_code}"}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)