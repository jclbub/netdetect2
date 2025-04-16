import requests, uuid, socket
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Union, Any
import re
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import chromedriver_autoinstaller

# Install chromedriver automatically if it's not installed
chromedriver_autoinstaller.install()

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

# Router configuration
DEFAULT_ROUTER_URL = "http://192.168.3.1"
DEFAULT_PASSWORD = "pass@AX3"

# API URLs
HOSTINFO_URL = f"{DEFAULT_ROUTER_URL}/api/system/HostInfo"
WAN_STATUS_URL = f"{DEFAULT_ROUTER_URL}/api/ntwk/wan"
MAC_FILTER_URL = f"{DEFAULT_ROUTER_URL}/api/ntwk/wlanmacfilter"
MAC_FILTER_STATUS_URL = f"{DEFAULT_ROUTER_URL}/api/ntwk/wlanmacfilter/status"
WLAN_FILTER_ENHANCE_URL = f"{DEFAULT_ROUTER_URL}/api/ntwk/wlanfilterenhance"

# Global cookies variable to store session
cookies = {}
headers = {
    "Referer": DEFAULT_ROUTER_URL,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Content-Type": "application/json"
}

# Function to automatically log in and get cookies
def get_router_session():
    """
    Opens a Chrome browser window in minimized state, logs into the router,
    extracts session cookies for API requests, and keeps the browser open.
    """
    global cookies
    global headers
    global driver  # Make driver global so it stays open
    
    # Check if we already have valid cookies
    if cookies and "SessionID_R3" in cookies:
        try:
            test_response = requests.get(HOSTINFO_URL, cookies=cookies, headers=headers, timeout=5)
            if test_response.status_code == 200:
                print("Using existing session cookies")
                return cookies
        except Exception as e:
            print(f"Existing cookies failed: {e}")
    
    print("Opening Chrome (minimized) to get new session cookies...")
    
    try:
        options = webdriver.ChromeOptions()
        # Add start-minimized to open Chrome in minimized state
        options.add_argument('--start-minimized')
        driver = webdriver.Chrome(options=options)
        wait = WebDriverWait(driver, 15)

        # Open the router login page
        driver.get(f"{DEFAULT_ROUTER_URL}/html/index.html#!/login")
        
        # Step 1: Enter password
        password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
        password_input.clear()
        password_input.send_keys(DEFAULT_PASSWORD)

        # Step 2: Click the login button
        login_button = wait.until(EC.element_to_be_clickable((By.ID, "loginbtn")))
        login_button.click()
        
        # Wait for login to complete
        try:
            wait.until(EC.url_contains("index.html#!/home"))
        except:
            # Give it some time to redirect
            time.sleep(5)
        
        # Extract cookies from the browser
        selenium_cookies = driver.get_cookies()
        
        # Get current URL for referer
        current_url = driver.current_url
        
        # Process cookies into the format needed for requests
        session_cookies = {}
        for cookie in selenium_cookies:
            session_cookies[cookie['name']] = cookie['value']
            print(f"Cookie found: {cookie['name']} = {cookie['value']}")
        
        # Update global cookies and headers
        cookies = session_cookies
        
        # Set basic headers
        headers = {
            "Referer": current_url,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Content-Type": "application/json"
        }
        
        print("Login successful, cookies obtained")
        print("Chrome browser remains open (minimized)")
        
        # DON'T close the browser - leave it open
        # driver.quit() is removed
        
        return session_cookies
        
    except Exception as e:
        print(f"Error during login process: {e}")
        return {}

# def close_browser():
#     """
#     Function to manually close the Chrome browser when needed.
#     """
#     global driver
#     if 'driver' in globals() and driver:
#         driver.quit()
#         print("Chrome browser closed")

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

class DeviceRequest(BaseModel):
    device_name: Optional[str] = None
    mac_address: Optional[str] = None
    list_type: str  # "blocklist", "trustlist", or "unblocked"

class DeviceRequests(BaseModel):
    device_name: Optional[str] = None
    mac_address: Optional[str] = None
    list_type: str  # "blocklist", "trustlist", or "unblocked"
    order: int

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
    if host_info.get('HostName') == "D-destroyer":
        return "Laptop"
        
    # Default case
    return "Unknown"

def get_filtered_router_data() -> Union[List[Dict[str, any]], Dict[str, any]]:
    try:
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        response = requests.get(HOSTINFO_URL, cookies=session_cookies, headers=headers)

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

@app.post("/macfilter")
async def configure_wifi(request: DeviceRequest):
    print("pressed")
    print(request)
    try:
        # Call the function to perform the selenium actions
        perform_selenium_actions(
            device_name=request.device_name,
            mac_address=request.mac_address,
            list_type=request.list_type
        )
        return {"status": "success", "message": f"Device {request.device_name} added successfully to {request.list_type}!"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An error occurred while configuring the router.")
    
@app.post("/unblock")
async def unblock_connection(request: DeviceRequests):
    print("pressed")
    print(request)
    try:
        # Call the function to perform the selenium actions
        unblock_device(
            device_name=request.device_name,
            mac_address=request.mac_address,
            list_type=request.list_type,
            order=request.order
        )
        return {"status": "success", "message": f"Device {request.device_name} added successfully to {request.list_type}!"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An error occurred while configuring the router.")

# Get router login session status
@app.get("/session-status")
async def check_session_status():
    """Check if the current session with the router is valid."""
    try:
        global cookies
        
        # If we don't have cookies yet, try to get them
        if not cookies or "SessionID_R3" not in cookies:
            new_cookies = get_router_session()
            return {
                "status": "new_session" if new_cookies else "failed",
                "message": "Successfully created new session" if new_cookies else "Failed to create session",
                "has_session": bool(new_cookies)
            }
            
        # Test the existing cookies with a simple API call
        test_response = requests.get(HOSTINFO_URL, cookies=cookies, headers=headers, timeout=5)
        
        return {
            "status": "valid" if test_response.status_code == 200 else "invalid",
            "message": "Session is valid" if test_response.status_code == 200 else "Session is invalid",
            "has_session": test_response.status_code == 200,
            "status_code": test_response.status_code
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error checking session: {str(e)}",
            "has_session": False
        }

if __name__ == "__main__":
    import uvicorn
    
    # Initialize a session at startup
    print("Initializing router session...")
    init_cookies = get_router_session()
    if init_cookies:
        print("Successfully initialized router session")
    else:
        print("Failed to initialize router session, will try again when endpoints are accessed")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

def get_network_speed() -> Dict:
    """Get the current network speed information from the router."""
    try:
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        response = requests.get(WAN_STATUS_URL, cookies=session_cookies, headers=headers)
        
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
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        # First request to get initial data
        start_response = requests.get(WAN_STATUS_URL, cookies=session_cookies, headers=headers)
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
        end_response = requests.get(WAN_STATUS_URL, cookies=session_cookies, headers=headers)
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

def perform_selenium_actions(device_name, mac_address, list_type):
    # Set up Chrome WebDriver
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    # Open the router login page
    driver.get(f"{DEFAULT_ROUTER_URL}/html/index.html#!/login")

    # Step 1: Enter password
    password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
    password_input.send_keys(DEFAULT_PASSWORD)

    # Step 2: Click the login button
    login_button = wait.until(EC.element_to_be_clickable((By.ID, "loginbtn")))
    login_button.click()

    # Step 3: Click "More" icon
    want_more_icon = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "div.want_more")))
    want_more_icon.click()

    # Step 4: Click "Wi-Fi Settings"
    wifi_settings_btn = wait.until(EC.element_to_be_clickable((By.ID, "wifisettingsparent_menuId")))
    wifi_settings_btn.click()

    # Step 5: Click "Wi-Fi Access Control"
    wifi_access_control_btn = wait.until(EC.element_to_be_clickable((By.ID, "wlanaccess_menuId")))
    wifi_access_control_btn.click()

    # Step 6: Perform actions based on list_type (blocklist, trustlist, or unblock)
    if list_type == "block":
        add_button = wait.until(EC.element_to_be_clickable((By.ID, "wlanaccess_btn")))
        add_button.click()
        device_name_input = wait.until(EC.presence_of_element_located((By.ID, "wlanaccess_host_ctrl")))
        mac_address_input = wait.until(EC.presence_of_element_located((By.ID, "wlanaccess_adddevice_ctrl")))
        device_name_input.send_keys(device_name)
        mac_address_input.send_keys(mac_address)
        ok_button = wait.until(EC.element_to_be_clickable((By.ID, "submit")))
        ok_button.click()
    elif list_type == "unblocked":
        try:
            delete_buttons = driver.find_elements(By.CSS_SELECTOR, "div.ic-del")
            
            if len(delete_buttons) > 0:
                target_button = driver.find_element(By.ID, f"wlan_access_{mac_address}_id_delid")
                target_button.click()
                time.sleep(1)
                
                # Click the save button
                save_button = wait.until(EC.element_to_be_clickable((By.ID, "pwrmode_btn")))
                save_button.click()
                
                print(f"Attempted to unblock device")
            else:
                print("No delete buttons found")
                
        except Exception as e:
            print(f"Error unblocking device: {e}")
            raise
    
    # Step 10: Click the "Save" button
    save_button = wait.until(EC.element_to_be_clickable((By.ID, "pwrmode_btn")))
    save_button.click()

    # Close the browser
    # driver.quit()



def unblock_device(device_name, mac_address, list_type, order):
    # Set up Chrome WebDriver
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    # Open the router login page
    driver.get(f"{DEFAULT_ROUTER_URL}/html/index.html#!/login")

    # Step 1: Enter password
    password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
    password_input.send_keys(DEFAULT_PASSWORD)

    # Step 2: Click the login button
    login_button = wait.until(EC.element_to_be_clickable((By.ID, "loginbtn")))
    login_button.click()

    # Step 3: Click "More" icon
    want_more_icon = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "div.want_more")))
    want_more_icon.click()

    wifi_settings_btn = wait.until(EC.element_to_be_clickable((By.ID, "wifisettingsparent_menuId")))
    wifi_settings_btn.click()

    wifi_access_control_btn = wait.until(EC.element_to_be_clickable((By.ID, "wlanaccess_menuId")))
    wifi_access_control_btn.click()

    try:
        # Let's add a pause to make sure the page is fully loaded
        time.sleep(3)
        
        # Print all IDs on the page to debug what's actually available
        print("All elements with IDs on page:")
        elements_with_id = driver.find_elements(By.XPATH, "//*[@id]")
        for element in elements_with_id:
            print(f"ID: {element.get_attribute('id')}")
        
        # Try finding by class instead of ID
        delete_buttons = driver.find_elements(By.CLASS_NAME, "ic-del")
        print(f"Found {len(delete_buttons)} elements with class 'ic-del'")
        
        if len(delete_buttons) > 0:
            # Click the first delete button (or whichever one you need)
            delete_buttons[0].click()
            print("Clicked delete button using class name")
            
            # Wait a moment and click save
            time.sleep(1)
            save_button = wait.until(EC.element_to_be_clickable((By.ID, "pwrmode_btn")))
            save_button.click()
            
            print(f"Attempted to unblock device")
        else:
            print("No delete buttons found with class 'ic-del'")
            
    except Exception as e:
        print(f"Error unblocking device: {e}")
        # Get page source for debugging
        print("Page source snippet:")
        try:
            print(driver.page_source[:1000])  # First 1000 chars
        except:
            pass
        raise
    
    # Step 10: Click the "Save" button
    save_button = wait.until(EC.element_to_be_clickable((By.ID, "pwrmode_btn")))
    save_button.click()

    # Close the browser
    # driver.quit()



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
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        response = requests.get(WAN_STATUS_URL, cookies=session_cookies, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": "Failed to fetch WAN data", "status_code": response.status_code}
    except Exception as e:
        return {"error": str(e)}

@app.get("/total-bandwidth-usage")
def get_total_bandwidth_usage():
    try:
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        response = requests.get(HOSTINFO_URL, cookies=session_cookies, headers=headers)

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
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        # Get data directly from the router API
        response = requests.get(HOSTINFO_URL, cookies=session_cookies, headers=headers)
        
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

@app.get("/blocked-devices")
async def get_blocked_devices():
    """
    Get a list of all devices that are currently blocked by the router's MAC filter.
    Retrieves data from the wlanfilterenhance API.
    """
    try:
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        # Get data directly from the router's MAC filter API
        response = requests.get(WLAN_FILTER_ENHANCE_URL, cookies=session_cookies, headers=headers)
        
        if response.status_code != 200:
            return {"error": f"Failed to fetch blocked devices, Status Code: {response.status_code}"}
        
        filter_data = response.json()
        
        # If the response is a list (as shown in your example)
        if isinstance(filter_data, list):
            # Process data for both frequency bands
            formatted_response = {}
            
            # Process each band configuration
            for band_config in filter_data:
                # Extract frequency band information
                frequency_band = band_config.get("FrequencyBand")
                if not frequency_band:
                    continue
                
                # Extract blocked MAC addresses
                blocked_devices = band_config.get("BMACAddresses", [])
                
                # Extract allowed MAC addresses (white-listed)
                allowed_devices = band_config.get("WMACAddresses", [])
                
                # Get MAC filter policy and enabled status
                mac_filter_enabled = band_config.get("MACAddressControlEnabled", True)
                # 0 means allowlist (only allow listed MACs), 1 means blocklist (block listed MACs)
                mac_filter_policy = band_config.get("MacFilterPolicy", 1)
                
                # Get all devices information to enhance the data
                all_devices_response = requests.get(HOSTINFO_URL, cookies=session_cookies, headers=headers)
                all_devices = []
                if all_devices_response.status_code == 200:
                    all_devices = all_devices_response.json()
                
                # Create a lookup dictionary for MAC address matching
                device_lookup = {device.get("MACAddress", "").upper(): device for device in all_devices if "MACAddress" in device}
                
                # Enhance blocked and allowed devices with additional information
                enhanced_blocked_devices = []
                for device in blocked_devices:
                    mac_address = device.get("MACAddress", "").upper()
                    enhanced_device = {
                        "MACAddress": device.get("MACAddress", ""),
                        "HostName": device.get("HostName", "Unknown Device"),
                        "AddedOn": device.get("AddedOn", time.strftime("%Y-%m-%d %H:%M:%S"))
                    }
                    
                    # Add additional info if this device is in our lookup
                    if mac_address in device_lookup:
                        device_info = device_lookup[mac_address]
                        enhanced_device["IPAddress"] = device_info.get("IPAddress", "Unknown")
                        enhanced_device["Active"] = bool(device_info.get("Active", False))
                        enhanced_device["DeviceType"] = determine_device_type(device_info)
                        enhanced_device["Manufacturer"] = device_info.get("Manufacturer", device_info.get("ActualManu", "Unknown"))
                        enhanced_device["RxKBytes"] = device_info.get("RxKBytes", 0)
                        enhanced_device["TxKBytes"] = device_info.get("TxKBytes", 0)
                    
                    enhanced_blocked_devices.append(enhanced_device)
                
                # Similarly enhance allowed devices
                enhanced_allowed_devices = []
                for device in allowed_devices:
                    mac_address = device.get("MACAddress", "").upper()
                    enhanced_device = {
                        "MACAddress": device.get("MACAddress", ""),
                        "HostName": device.get("HostName", "Unknown Device"),
                        "AddedOn": device.get("AddedOn", time.strftime("%Y-%m-%d %H:%M:%S"))
                    }
                    
                    # Add additional info if this device is in our lookup
                    if mac_address in device_lookup:
                        device_info = device_lookup[mac_address]
                        enhanced_device["IPAddress"] = device_info.get("IPAddress", "Unknown")
                        enhanced_device["Active"] = bool(device_info.get("Active", False))
                        enhanced_device["DeviceType"] = determine_device_type(device_info)
                        enhanced_device["Manufacturer"] = device_info.get("Manufacturer", device_info.get("ActualManu", "Unknown"))
                        enhanced_device["RxKBytes"] = device_info.get("RxKBytes", 0)
                        enhanced_device["TxKBytes"] = device_info.get("TxKBytes", 0)
                    
                    enhanced_allowed_devices.append(enhanced_device)
                
                # Add to the formatted response
                formatted_response[frequency_band] = {
                    "enabled": mac_filter_enabled,
                    "policy": mac_filter_policy,
                    "blocked_devices": enhanced_blocked_devices,
                    "allowed_devices": enhanced_allowed_devices
                }
            
            # Calculate total blocked devices
            total_blocked = sum(len(band["blocked_devices"]) for band in formatted_response.values())
            formatted_response["total_blocked_devices"] = total_blocked
            
            return formatted_response
        else:
            # Handle unexpected response format
            return {
                "error": "Unexpected response format",
                "data": filter_data
            }
        
    except Exception as e:
        print(f"Error fetching blocked devices: {e}")
        return {"error": str(e)}