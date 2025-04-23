import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Union
import requests
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import chromedriver_autoinstaller
import mysql.connector
from mysql.connector import Error

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

# Request models for MAC filtering
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

# Selenium actions for MAC filtering
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

# API endpoints for MAC filtering
@app.post("/macfilter")
async def configure_wifi(request: DeviceRequest):
    print("MAC filter request received")
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
        raise HTTPException(status_code=500, detail=f"An error occurred while configuring the router: {str(e)}")
    
@app.post("/unblock")
async def unblock_connection(request: DeviceRequests):
    print("Unblock request received")
    print(request)
    try:
        # Call the function to perform the selenium actions
        unblock_device(
            device_name=request.device_name,
            mac_address=request.mac_address,
            list_type=request.list_type,
            order=request.order
        )
        return {"status": "success", "message": f"Device {request.device_name} successfully unblocked!"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while unblocking the device: {str(e)}")
    
@app.get("/all-devices")
async def get_all_devices():
    try:
        connection = mysql.connector.connect(
            host="localhost",
            database="netdetect",
            user="root",
            password="goldfish123"
        )
        
        if not connection.is_connected():
            return {"error": "Failed to connect to database"}
        
        cursor = connection.cursor(dictionary=True)
        
        devices_query = """
            SELECT n.*, 
                   COALESCE((SELECT SUM(download) FROM bandwidth b WHERE b.device_id = n.id AND DATE(b.created_at) = CURDATE()), 0) as total_download,
                   COALESCE((SELECT SUM(upload) FROM bandwidth b WHERE b.device_id = n.id AND DATE(b.created_at) = CURDATE()), 0) as total_upload
            FROM networks n
        """
        cursor.execute(devices_query)
        all_devices = cursor.fetchall()
        
        formatted_devices = []
        for device in all_devices:
            formatted_device = {
                "id": device["id"],
                "MACAddress": device["mac_address"],
                "HostName": device["hostname"] or "Unknown Device",
                "IPAddress": device["ip_address"] or "Unknown",
                "Active": device["status"] == "Active",
                "DeviceType": device["device_type"] or "Unknown",
                "Manufacturer": device["manufacturer"] or "Unknown",
                "RxKBytes": float(device["total_download"]) if device["total_download"] else 0,
                "TxKBytes": float(device["total_upload"]) if device["total_upload"] else 0,
                "Status": device["status"],
                "AddedOn": device["created_at"].strftime("%Y-%m-%d %H:%M:%S") if device["created_at"] else "",
                "LastSeen": device["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if device["updated_at"] else ""
            }
            formatted_devices.append(formatted_device)
        
        response = {
            "devices": formatted_devices,
            "total_devices": len(formatted_devices),
            "active_devices": sum(1 for device in formatted_devices if device["Active"]),
            "total_download": sum(device["RxKBytes"] for device in formatted_devices),
            "total_upload": sum(device["TxKBytes"] for device in formatted_devices)
        }
        
        cursor.close()
        connection.close()
        
        return response
        
    except Exception as e:
        print(f"Error fetching all devices: {e}")
        return {"error": str(e)}

@app.get("/blocked-devices")
async def get_blocked_devices():
    try:
        connection = mysql.connector.connect(
            host="localhost",
            database="netdetect",
            user="root",
            password="goldfish123"
        )
        
        if not connection.is_connected():
            return {"error": "Failed to connect to database"}
        
        cursor = connection.cursor(dictionary=True)
        
        blocked_devices_query = """
            SELECT n.*, 
                   COALESCE((SELECT SUM(download) FROM bandwidth b WHERE b.device_id = n.id AND DATE(b.created_at) = CURDATE()), 0) as total_download,
                   COALESCE((SELECT SUM(upload) FROM bandwidth b WHERE b.device_id = n.id AND DATE(b.created_at) = CURDATE()), 0) as total_upload
            FROM networks n 
            WHERE n.status = 'Blocked'
        """
        cursor.execute(blocked_devices_query)
        blocked_devices = cursor.fetchall()
        
        formatted_blocked_devices = []
        for device in blocked_devices:
            formatted_device = {
                "MACAddress": device["mac_address"],
                "HostName": device["hostname"] or "Unknown Device",
                "IPAddress": device["ip_address"] or "Unknown",
                "Active": device["status"] == "Active",
                "DeviceType": device["device_type"] or "Unknown",
                "Manufacturer": device["manufacturer"] or "Unknown",
                "RxKBytes": float(device["total_download"]) if device["total_download"] else 0,
                "TxKBytes": float(device["total_upload"]) if device["total_upload"] else 0,
                "AddedOn": device["created_at"].strftime("%Y-%m-%d %H:%M:%S") if device["created_at"] else "",
                "BlockMethod": "MAC Filter"
            }
            formatted_blocked_devices.append(formatted_device)
        
        response = {
            "blocked_devices": formatted_blocked_devices,
            "total_blocked": len(formatted_blocked_devices),
            "mac_filter": {
                "total_blocked_by_mac": len(formatted_blocked_devices),
                "details": {}
            }
        }
        
        cursor.close()
        connection.close()
        
        return response
        
    except Exception as e:
        print(f"Error fetching blocked devices: {e}")
        return {"error": str(e)}
    

@app.get("/mac-filter-status")
async def get_mac_filter_status():
    """Get the current status of MAC filtering on the router."""
    try:
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        # Get MAC filter status
        response = requests.get(MAC_FILTER_STATUS_URL, cookies=session_cookies, headers=headers)
        
        if response.status_code != 200:
            return {"error": f"Failed to fetch MAC filter status, Status Code: {response.status_code}"}
        
        return response.json()
    except Exception as e:
        print(f"Error fetching MAC filter status: {e}")
        return {"error": str(e)}

@app.post("/update-mac-filter")
async def update_mac_filter(request: UpdateMacFilterRequest):
    """Update the MAC filter configuration (add or remove devices)."""
    try:
        # Ensure we have a valid session
        session_cookies = get_router_session()
        
        # Get current filter data
        response = requests.get(WLAN_FILTER_ENHANCE_URL, cookies=session_cookies, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, 
                               detail=f"Failed to fetch current MAC filter data: {response.status_code}")
        
        filter_data = response.json()
        
        # Find the configuration for the specified frequency band
        target_band = None
        for band_config in filter_data:
            if band_config.get("FrequencyBand") == request.frequency_band:
                target_band = band_config
                break
        
        if not target_band:
            raise HTTPException(status_code=404, 
                               detail=f"Frequency band {request.frequency_band} not found")
        
        # Update the configuration based on the request
        target_band["MACAddressControlEnabled"] = request.enabled
        target_band["MacFilterPolicy"] = request.policy
        
        # Handle MAC address operations
        if request.operation == "add":
            # Add MAC addresses to the appropriate list
            if request.policy == 1:  # Blocklist
                for mac in request.mac_addresses:
                    # Check if it's already in the list
                    if not any(device.get("MACAddress") == mac for device in target_band["BMACAddresses"]):
                        target_band["BMACAddresses"].append({
                            "MACAddress": mac,
                            "HostName": f"Device_{mac[-6:]}",
                            "AddedOn": time.strftime("%Y-%m-%d %H:%M:%S")
                        })
            else:  # Allowlist
                for mac in request.mac_addresses:
                    # Check if it's already in the list
                    if not any(device.get("MACAddress") == mac for device in target_band["WMACAddresses"]):
                        target_band["WMACAddresses"].append({
                            "MACAddress": mac,
                            "HostName": f"Device_{mac[-6:]}",
                            "AddedOn": time.strftime("%Y-%m-%d %H:%M:%S")
                        })
        elif request.operation == "remove":
            # Remove MAC addresses from the appropriate list
            if request.policy == 1:  # Blocklist
                target_band["BMACAddresses"] = [
                    device for device in target_band["BMACAddresses"] 
                    if device.get("MACAddress") not in request.mac_addresses
                ]
            else:  # Allowlist
                target_band["WMACAddresses"] = [
                    device for device in target_band["WMACAddresses"]
                    if device.get("MACAddress") not in request.mac_addresses
                ]
        
        # Send updated configuration back to the router
        update_response = requests.post(
            WLAN_FILTER_ENHANCE_URL, 
            cookies=session_cookies, 
            headers=headers,
            json=filter_data
        )
        
        if update_response.status_code not in (200, 201, 204):
            raise HTTPException(status_code=update_response.status_code,
                               detail=f"Failed to update MAC filter: {update_response.status_code}")
        
        return {
            "status": "success",
            "message": f"MAC filter {request.operation} operation completed successfully",
            "updated_config": update_response.json() if update_response.status_code == 200 else None
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error updating MAC filter: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating MAC filter: {str(e)}")

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
    
    uvicorn.run(app, host="0.0.0.0", port=8001)  # Using port 8001 to avoid conflict with main API