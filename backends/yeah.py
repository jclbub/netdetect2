import requests, uuid, socket
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Union, Any
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

# API URLs
HOSTINFO_URL = "http://192.168.3.1/api/system/HostInfo"
WAN_STATUS_URL = "http://192.168.3.1/api/ntwk/wan"
MAC_FILTER_URL = "http://192.168.3.1/api/ntwk/wlanmacfilter"
MAC_FILTER_STATUS_URL = "http://192.168.3.1/api/ntwk/wlanmacfilter/status"

# Router authentication
cookies = {
    "SessionID_R3": "8kpgCdtPAChsrNKQxBXx8Pa0JSA8Fnx24AHWH6N5LR65cD6PdM0vg2UrIFn9PhzcMYmHV672gh7Pctp2BebLnwHxP7qAMvPBgVg7CAIARBqC0aFCCeKotesmpdW9FapA"
}

headers = {
    "Referer": "http://192.168.3.1/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Content-Type": "application/json"
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

# MAC filtering request models
class SingleDeviceRequest(BaseModel):
    band: str  # "2.4GHz" or "5GHz"
    mac_address: str
    host_name: Optional[str] = None
    policy: int = 1  # 1 for blocklist, 0 for allowlist

class RemoveDeviceRequest(BaseModel):
    band: str  # "2.4GHz" or "5GHz"
    mac_address: str
    policy: int = 1  # 1 for blocklist, 0 for allowlist

class UpdateMacFilterRequest(BaseModel):
    frequency_band: str  # "2.4GHz" or "5GHz"
    policy: int = 1  # 1 for blocklist, 0 for allowlist
    enabled: bool = True
    mac_addresses: List[str]
    operation: str = "add"  # "add" or "remove"

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

def count_device_types(devices: List[Dict]) -> Dict:
    """Count the number of each device type."""
    counts = {"Phone": 0, "Laptop": 0, "Desktop PC": 0, "Unknown": 0}
    for device in devices:
        device_type = device.get('DeviceType', 'Unknown')
        counts[device_type] = counts.get(device_type, 0) + 1
    return counts

# Original endpoints
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

@app.get("/wireless-devices")
async def get_wireless_devices():
    """
    Get a list of all wireless devices connected to the router.
    Filters and processes data from the HostInfo API.
    """
    try:
        # Get data directly from the router API
        response = requests.get(HOSTINFO_URL, cookies=cookies, headers=headers)
        
        if response.status_code != 200:
            return {"error": f"Failed to fetch data, Status Code: {response.status_code}"}
        
        all_devices = response.json()
        
        # Create a list to hold wireless devices
        wireless_devices = []
        
        # Check each device and filter for wireless ones
        for device in all_devices:
            is_wireless = (
                device.get("InterfaceType", "").lower() == "wireless" or
                device.get("WlanActive", False) == True or
                "wlan" in device.get("Layer2Interface", "").lower()
            )
            
            # If this is a wireless device, add it to our list
            if is_wireless:
                # Create a copy to avoid modifying the original
                wireless_device = device.copy()
                
                # Set the device type
                wireless_device["DeviceType"] = determine_device_type(device)
                
                # Use the actual Active field directly from the data
                # Don't try to derive it from a non-existent Status field
                wireless_device["Active"] = bool(device.get("Active", False))
                
                # Add signal strength information if not already present
                if "SignalStrength" not in wireless_device:
                    # Default signal strength based on active status
                    wireless_device["signal_strength"] = 70 if wireless_device["Active"] else 30
                
                # Try to determine manufacturer from MAC address
                if not wireless_device.get("Manufacturer") and not wireless_device.get("ActualManu"):
                    mac_address = wireless_device.get("MACAddress", "")
                    if mac_address:
                        # First, check against known prefixes
                        mac_prefix = mac_address[:8].upper()
                        manufacturers = {
                            "00:0A:95": "Apple",
                            "A4:77:33": "Samsung", 
                            "20:54:76": "Google",
                            "00:16:CB": "Dell",
                            "00:1F:F3": "Apple",
                            "00:21:6B": "Lenovo",
                            "F4:4D:30": "Xiaomi",
                            "FA:10:AF": "Unknown"  # Add the specific one you're seeing
                        }
                        
                        for prefix, manu in manufacturers.items():
                            if mac_address.upper().startswith(prefix.replace(":", "")):
                                wireless_device["ActualManu"] = manu
                                break
                        
                        # If we didn't find a match, set to Unknown
                        if not wireless_device.get("ActualManu"):
                            wireless_device["ActualManu"] = "Unknown"
                
                wireless_devices.append(wireless_device)
        
        # If we didn't find any explicitly marked wireless devices,
        # check for probable wireless devices based on device type
        if not wireless_devices:
            for device in all_devices:
                hostname = device.get("HostName", "").lower()
                device_type = determine_device_type(device)
                
                # These devices are likely to be wireless
                if (device_type in ["Phone", "Tablet", "Laptop"] or
                    any(keyword in hostname for keyword in ["phone", "tablet", "ipad", "android", "iphone"])):
                    
                    wireless_device = device.copy()
                    wireless_device["DeviceType"] = device_type
                    wireless_device["Active"] = bool(device.get("Active", False))
                    
                    # Set interface type to wireless if not set
                    if not wireless_device.get("InterfaceType"):
                        wireless_device["InterfaceType"] = "Wireless"
                    
                    # Add signal strength if not present
                    if "SignalStrength" not in wireless_device:
                        wireless_device["signal_strength"] = 70 if wireless_device["Active"] else 30
                    
                    # Try to determine manufacturer
                    if not wireless_device.get("Manufacturer") and not wireless_device.get("ActualManu"):
                        mac_address = wireless_device.get("MACAddress", "")
                        if mac_address:
                            manufacturers = {
                                "00:0A:95": "Apple",
                                "A4:77:33": "Samsung", 
                                "20:54:76": "Google",
                                "00:16:CB": "Dell",
                                "00:1F:F3": "Apple",
                                "00:21:6B": "Lenovo",
                                "F4:4D:30": "Xiaomi",
                                "FA:10:AF": "Unknown"
                            }
                            for prefix, manu in manufacturers.items():
                                if mac_address.upper().startswith(prefix.replace(":", "")):
                                    wireless_device["ActualManu"] = manu
                                    break
                    
                    wireless_devices.append(wireless_device)
        
        return wireless_devices
        
    except Exception as e:
        print(f"Error fetching wireless devices: {e}")
        return {"error": str(e)}

# ===== MAC FILTERING ENDPOINTS =====

# Get MAC filter status (including blocked devices)
@app.get("/api/mac-filter/status")
async def get_mac_filter_status() -> Dict[str, Any]:
    """
    Get the current MAC filtering status for both 2.4GHz and 5GHz bands.
    Returns policy type (blocklist/allowlist) and whether filtering is enabled.
    """
    try:
        response = requests.get(MAC_FILTER_STATUS_URL, cookies=cookies, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch MAC filter status: {response.status_code}"
            )
        
        status_data = response.json()
        
        # Process the data into a more usable format
        result = {}
        
        for band_data in status_data:
            band = band_data.get("Band")
            if band in ["2.4GHz", "5GHz"]:
                result[band] = {
                    "enabled": band_data.get("Enable", False),
                    "policy_value": band_data.get("Policy", 1),  # 0=allowlist, 1=blocklist
                    "policy_name": "blocklist" if band_data.get("Policy", 1) == 1 else "allowlist"
                }
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting MAC filter status: {str(e)}")

# Get blocked devices
@app.get("/api/mac-filter/blocked-devices")
async def get_blocked_devices() -> Dict[str, Any]:
    """
    Get a list of all blocked devices for both 2.4GHz and 5GHz bands.
    """
    try:
        response = requests.get(MAC_FILTER_URL, cookies=cookies, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch blocked devices: {response.status_code}"
            )
        
        data = response.json()
        
        # Process the data into a more usable format by band
        blocked_devices = {
            "2.4GHz": [],
            "5GHz": []
        }
        
        for device in data:
            band = device.get("Band")
            if band in ["2.4GHz", "5GHz"]:
                policy = device.get("Policy", 1)
                
                # Only include devices in the blocklist policy (1)
                if policy == 1:
                    blocked_devices[band].append(device)
        
        return blocked_devices
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting blocked devices: {str(e)}")

# Add a single device to the blocklist
@app.post("/api/mac-filter/add-single-device")
async def add_device_to_blocklist(request: SingleDeviceRequest):
    """
    Add a single device to the MAC filtering blocklist.
    """
    try:
        # Validate band
        if request.band not in ["2.4GHz", "5GHz"]:
            raise HTTPException(status_code=400, detail="Invalid band - must be '2.4GHz' or '5GHz'")
        
        # Prepare payload for the router API
        payload = {
            "Band": request.band,
            "MACAddress": request.mac_address,
            "HostName": request.host_name or request.mac_address.replace(":", "-"),
            "Policy": request.policy  # 1 for blocklist
        }
        
        # Send request to router
        response = requests.post(MAC_FILTER_URL, 
                                json=payload, 
                                cookies=cookies, 
                                headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to add device to blocklist: {response.status_code}"
            )
        
        return {"success": True, "message": "Device added to blocklist"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding device to blocklist: {str(e)}")

# Remove a single device from the blocklist
@app.post("/api/mac-filter/remove-single-device")
async def remove_device_from_blocklist(request: RemoveDeviceRequest):
    """
    Remove a single device from the MAC filtering blocklist.
    """
    try:
        # Validate band
        if request.band not in ["2.4GHz", "5GHz"]:
            raise HTTPException(status_code=400, detail="Invalid band - must be '2.4GHz' or '5GHz'")
        
        # First, get the current list of blocked devices
        blocked_devices_response = await get_blocked_devices()
        band_devices = blocked_devices_response[request.band]
        
        # Find the device to remove
        device_to_remove = None
        for device in band_devices:
            if device["MACAddress"].lower() == request.mac_address.lower():
                device_to_remove = device
                break
        
        if not device_to_remove:
            # Device not found in blocklist
            return {"success": True, "message": "Device not found in blocklist"}
        
        # Send delete request to router
       # Send delete request to router
        delete_url = f"{MAC_FILTER_URL}/{device_to_remove.get('ID', '')}"
        response = requests.delete(delete_url, cookies=cookies, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to remove device from blocklist: {response.status_code}"
            )
        
        return {"success": True, "message": "Device removed from blocklist"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing device from blocklist: {str(e)}")

# Update multiple devices at once
@app.post("/api/mac-filter/update")
async def update_mac_filter(request: UpdateMacFilterRequest):
    """
    Add or remove multiple devices from the MAC filter list at once.
    """
    try:
        # Validate band
        if request.frequency_band not in ["2.4GHz", "5GHz"]:
            raise HTTPException(status_code=400, detail="Invalid band - must be '2.4GHz' or '5GHz'")
        
        # First, ensure MAC filtering is enabled with the correct policy
        status_response = requests.get(MAC_FILTER_STATUS_URL, cookies=cookies, headers=headers)
        
        if status_response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch MAC filter status: {status_response.status_code}"
            )
        
        status_data = status_response.json()
        
        # Find the current band settings
        band_settings = None
        for band_data in status_data:
            if band_data.get("Band") == request.frequency_band:
                band_settings = band_data
                break
        
        if not band_settings:
            raise HTTPException(status_code=404, detail=f"Band {request.frequency_band} not found")
        
        # Update policy if needed
        if band_settings.get("Policy") != request.policy or band_settings.get("Enable") != request.enabled:
            update_payload = {
                "Band": request.frequency_band,
                "Enable": request.enabled,
                "Policy": request.policy
            }
            
            policy_response = requests.put(
                f"{MAC_FILTER_STATUS_URL}/{band_settings.get('ID', '')}",
                json=update_payload,
                cookies=cookies,
                headers=headers
            )
            
            if policy_response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to update MAC filter policy: {policy_response.status_code}"
                )
        
        # Now handle the MAC addresses
        if request.operation == "add":
            # Add each MAC address
            for mac in request.mac_addresses:
                payload = {
                    "Band": request.frequency_band,
                    "MACAddress": mac,
                    "HostName": mac.replace(":", "-"),
                    "Policy": request.policy
                }
                
                response = requests.post(MAC_FILTER_URL, 
                                      json=payload, 
                                      cookies=cookies, 
                                      headers=headers)
                
                if response.status_code != 200:
                    # Log error but continue with other devices
                    print(f"Failed to add MAC {mac}: {response.status_code}")
            
            return {"success": True, "message": f"Added {len(request.mac_addresses)} devices to {request.frequency_band}"}
            
        elif request.operation == "remove":
            # First, get current devices
            blocked_devices_response = await get_blocked_devices()
            band_devices = blocked_devices_response[request.frequency_band]
            
            # Remove each MAC address
            removed_count = 0
            for mac in request.mac_addresses:
                # Find the device to remove
                for device in band_devices:
                    if device["MACAddress"].lower() == mac.lower():
                        # Send delete request
                        delete_url = f"{MAC_FILTER_URL}/{device.get('ID', '')}"
                        response = requests.delete(delete_url, cookies=cookies, headers=headers)
                        
                        if response.status_code == 200:
                            removed_count += 1
                        else:
                            # Log error but continue with other devices
                            print(f"Failed to remove MAC {mac}: {response.status_code}")
                        
                        break
            
            return {"success": True, "message": f"Removed {removed_count} devices from {request.frequency_band}"}
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid operation: {request.operation}")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating MAC filter: {str(e)}")

# Debug endpoint for MAC filtering
@app.get("/api/mac-filter/debug")
async def debug_mac_filter():
    """
    Debug endpoint for MAC filtering.
    Shows all MAC filter data from the router.
    """
    try:
        # Get status
        status_response = requests.get(MAC_FILTER_STATUS_URL, cookies=cookies, headers=headers)
        
        # Get devices
        devices_response = requests.get(MAC_FILTER_URL, cookies=cookies, headers=headers)
        
        return {
            "status_code": {
                "status": status_response.status_code,
                "devices": devices_response.status_code
            },
            "status_data": status_response.json() if status_response.status_code == 200 else None,
            "devices_data": devices_response.json() if devices_response.status_code == 200 else None
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)