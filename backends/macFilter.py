"""
Network Management and Time Control Automation Solution
For enabling/disabling device time access rules
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Union, Any
import mysql.connector
from mysql.connector import Error
from mysql.connector.pooling import MySQLConnectionPool
import functools
from datetime import datetime
import time
import os
import logging
import re

# Selenium imports for browser automation
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException, NoSuchElementException
import chromedriver_autoinstaller

# Setup logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Network Management and Time Control API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)   

# ===== STORED CREDENTIALS =====
# Store router configuration locally
ROUTER_CONFIG = {
    "url": "http://192.168.3.1",  # Change this to your router's IP address
    "password": "pass@AX3",       # Default password
    "timeout": 30                 # Default timeout in seconds
}

# Create a connection pool
try:
    cnxpool = MySQLConnectionPool(
        pool_name="netdetect_pool",
        pool_size=10,  # Adjust based on your expected load
        host="localhost",
        database="netdetect",
        user="root",
        password="goldfish123",
        buffered=True  # Enable buffered cursors by default
    )
except Exception as e:
    print(f"Error creating connection pool: {e}")
    # Still allow the app to start even if the pool fails (will retry connections later)
    cnxpool = None

def get_db_connection():
    """Get a connection from the pool, with auto-commit enabled."""
    try:
        if cnxpool:
            connection = cnxpool.get_connection()
            if connection.is_connected():
                return connection
    except Error as e:
        print(f"Error getting connection from pool: {e}")
    
    # Fallback to direct connection if pool fails
    try:
        connection = mysql.connector.connect(
            host="localhost",
            database="netdetect",
            user="root",
            password="goldfish123"
        )
        return connection
    except Error as e:
        print(f"Failed to connect to database: {e}")
        raise HTTPException(status_code=500, detail="Database connection error")

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
    
    # Default case
    return "Unknown"

def format_datetime(dt: Optional[datetime]) -> str:
    """Format datetime or return empty string"""
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else ""

# ===================== DEVICE MANAGEMENT API ENDPOINTS =====================

@app.get("/all-devices")
async def get_all_devices():
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Using a JOIN to fetch device data and bandwidth in a single query
        devices_query = """
            SELECT 
                n.id, n.mac_address, n.hostname, n.ip_address, n.status, 
                n.device_type, n.manufacturer, n.created_at, n.updated_at,
                COALESCE(SUM(b.download), 0) as total_download,
                COALESCE(SUM(b.upload), 0) as total_upload
            FROM 
                networks n
            LEFT JOIN 
                bandwidth b ON b.device_id = n.id AND DATE(b.created_at) = CURDATE()
            GROUP BY 
                n.id
        """
        
        cursor.execute(devices_query)
        all_devices = cursor.fetchall()
        
        # Prepare response in a more optimized way
        formatted_devices = []
        total_download = 0
        total_upload = 0
        active_count = 0
        
        for device in all_devices:
            is_active = device["status"] == "Active"
            if is_active:
                active_count += 1
                
            rx_bytes = float(device["total_download"]) if device["total_download"] else 0
            tx_bytes = float(device["total_upload"]) if device["total_upload"] else 0
            
            total_download += rx_bytes
            total_upload += tx_bytes
            
            formatted_device = {
                "id": device["id"],
                "MACAddress": device["mac_address"],
                "HostName": device["hostname"] or "Unknown Device",
                "IPAddress": device["ip_address"] or "Unknown",
                "Active": is_active,
                "DeviceType": device["device_type"] or "Unknown",
                "Manufacturer": device["manufacturer"] or "Unknown",
                "RxKBytes": rx_bytes,
                "TxKBytes": tx_bytes,
                "Status": device["status"],
                "AddedOn": format_datetime(device["created_at"]),
                "LastSeen": format_datetime(device["updated_at"])
            }
            formatted_devices.append(formatted_device)
        
        response = {
            "devices": formatted_devices,
            "total_devices": len(formatted_devices),
            "active_devices": active_count,
            "total_download": total_download,
            "total_upload": total_upload
        }
        
        return response
        
    except Exception as e:
        print(f"Error fetching all devices: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()

@app.get("/blocked-devices")
async def get_blocked_devices():
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Using JOIN instead of subqueries
        blocked_devices_query = """
            SELECT 
                n.id, n.mac_address, n.hostname, n.ip_address, n.status, 
                n.device_type, n.manufacturer, n.created_at, 
                COALESCE(SUM(b.download), 0) as total_download,
                COALESCE(SUM(b.upload), 0) as total_upload
            FROM 
                networks n
            LEFT JOIN 
                bandwidth b ON b.device_id = n.id AND DATE(b.created_at) = CURDATE()
            WHERE 
                n.status = 'Blocked'
            GROUP BY 
                n.id
        """
        
        cursor.execute(blocked_devices_query)
        blocked_devices = cursor.fetchall()
        
        formatted_blocked_devices = []
        for device in blocked_devices:
            formatted_device = {
                "MACAddress": device["mac_address"],
                "HostName": device["hostname"] or "Unknown Device",
                "IPAddress": device["ip_address"] or "Unknown",
                "Active": False,  # Blocked devices are not active
                "DeviceType": device["device_type"] or "Unknown",
                "Manufacturer": device["manufacturer"] or "Unknown",
                "RxKBytes": float(device["total_download"]) if device["total_download"] else 0,
                "TxKBytes": float(device["total_upload"]) if device["total_upload"] else 0,
                "AddedOn": format_datetime(device["created_at"]),
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
        
        return response
        
    except Exception as e:
        print(f"Error fetching blocked devices: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()

# ===================== BROWSER AUTOMATION SECTION =====================

# Global variable to track automation status
automation_status = {
    "is_running": False,
    "last_completed": None,
    "last_error": None,
    "current_step": None
}

# Request model for time control
class TimeControlRequest(BaseModel):
    device_name: str
    enable: bool

def run_time_control_automation(device_name: str, enable: bool):
    """Background task to run Chrome automation for time rule control"""
    global automation_status
    
    automation_status["is_running"] = True
    automation_status["current_step"] = "Initializing time control automation"
    automation_status["last_error"] = None
    
    try:
        # Install or update chromedriver
        chromedriver_autoinstaller.install()
        
        # Chrome options
        chrome_options = webdriver.ChromeOptions()
        # Uncomment if you want to run headless (no GUI)
        # chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        automation_status["current_step"] = "Starting Chrome"
        driver = webdriver.Chrome(options=chrome_options)
        wait = WebDriverWait(driver, ROUTER_CONFIG['timeout'])
        
        try:
            # Use the stored router URL with explicit path to login page
            login_url = f"{ROUTER_CONFIG['url']}/html/index.html#!/login"
            automation_status["current_step"] = f"Navigating to {login_url}"
            driver.get(login_url)
            
            # Wait for page to load
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # Input password
            automation_status["current_step"] = "Entering password"
            password_field = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
            )
            password_field.clear()
            password_field.send_keys(ROUTER_CONFIG['password'])
            
            # Click login button
            automation_status["current_step"] = "Clicking login button"
            login_button = wait.until(
                EC.element_to_be_clickable((By.ID, "loginbtn"))
            )
            login_button.click()
            
            # Wait for login to complete
            time.sleep(3)  # Allow time for authentication
            
            # Navigate to More Functions
            automation_status["current_step"] = "Clicking More Functions"
            more_button = wait.until(
                EC.element_to_be_clickable((By.ID, "more"))
            )
            more_button.click()
            
            # Wait for menu to expand
            time.sleep(1)
            
            # Click on "Security Settings"
            automation_status["current_step"] = "Clicking Security Settings"
            security_settings = wait.until(
                EC.element_to_be_clickable((By.ID, "safesettingsparent_menuId"))
            )
            security_settings.click()
            
            # Wait for submenu to appear
            time.sleep(1)
            
            # Click on "Parental Control"
            automation_status["current_step"] = "Clicking Parental Control"
            parental_control = wait.until(
                EC.element_to_be_clickable((By.ID, "parentcontrol_menuId"))
            )
            parental_control.click()
            
            # Wait for parental control page to load
            time.sleep(3)
            
            # Find the device by name and the corresponding toggle button
            automation_status["current_step"] = f"Looking for device: {device_name}"
            
            # JavaScript to find the device and get its rule ID
            find_device_script = f"""
                var foundId = null;
                // Find the device name in the list
                var deviceElements = document.querySelectorAll('.ellipsis');
                
                for (var i = 0; i < deviceElements.length; i++) {{
                    if (deviceElements[i].textContent.trim() === "{device_name}") {{
                        // Found the device, now get the ID of its rule
                        var deviceRow = deviceElements[i].closest('.listtable');
                        
                        // Find the toggle button in this row
                        var toggleButtons = deviceRow.querySelectorAll('.switch_button');
                        if (toggleButtons.length > 0) {{
                            // Extract rule ID from the button's ID
                            var buttonId = toggleButtons[0].id;
                            // Format is something like "InternetGatewayDevice_X_FireWall_TimeRule_1__on"
                            var match = buttonId.match(/TimeRule_(\\d+)__/);
                            if (match && match[1]) {{
                                foundId = match[1];
                                break;
                            }}
                        }}
                    }}
                }}
                
                return foundId;
            """
            
            rule_id = driver.execute_script(find_device_script)
            
            if not rule_id:
                raise Exception(f"Device '{device_name}' not found in time rules list")
            
            automation_status["current_step"] = f"Found device rule ID: {rule_id}"
            
            # Now toggle the appropriate button based on the enable flag
            if enable:
                # We want to enable the rule - look for the on/off button
                button_id = f"InternetGatewayDevice_X_FireWall_TimeRule_{rule_id}__"
                button_id += "on" if enable else "off"
                
                # Use JavaScript to check if the button already has the desired state
                check_state_script = f"""
                    var button = document.getElementById('{button_id}');
                    if (button) {{
                        return button.classList.contains('btn_on') ? 'already_on' : 'needs_toggle';
                    }} else {{
                        // Try to find the opposite button that needs to be clicked
                        var oppositeButton = document.getElementById('InternetGatewayDevice_X_FireWall_TimeRule_{rule_id}__off');
                        return oppositeButton ? 'found_opposite' : 'not_found';
                    }}
                """
                
                button_state = driver.execute_script(check_state_script)
                
                if button_state == 'already_on':
                    automation_status["current_step"] = f"Device {device_name} is already enabled"
                elif button_state == 'found_opposite':
                    # Click the off button to turn it on
                    automation_status["current_step"] = f"Clicking toggle button to enable {device_name}"
                    off_button = driver.find_element(By.ID, f"InternetGatewayDevice_X_FireWall_TimeRule_{rule_id}__off")
                    off_button.click()
                elif button_state == 'needs_toggle':
                    # Click the on button
                    automation_status["current_step"] = f"Clicking toggle button to enable {device_name}"
                    on_button = driver.find_element(By.ID, button_id)
                    on_button.click()
                else:
                    raise Exception(f"Could not find toggle button for device {device_name}")
            else:
                # We want to disable the rule
                button_id = f"InternetGatewayDevice_X_FireWall_TimeRule_{rule_id}__"
                button_id += "off" if not enable else "on"
                
                # Use JavaScript to check if the button already has the desired state
                check_state_script = f"""
                    var button = document.getElementById('{button_id}');
                    if (button) {{
                        return button.classList.contains('btn_off') ? 'already_off' : 'needs_toggle';
                    }} else {{
                        // Try to find the opposite button that needs to be clicked
                        var oppositeButton = document.getElementById('InternetGatewayDevice_X_FireWall_TimeRule_{rule_id}__on');
                        return oppositeButton ? 'found_opposite' : 'not_found';
                    }}
                """
                
                button_state = driver.execute_script(check_state_script)
                
                if button_state == 'already_off':
                    automation_status["current_step"] = f"Device {device_name} is already disabled"
                elif button_state == 'found_opposite':
                    # Click the on button to turn it off
                    automation_status["current_step"] = f"Clicking toggle button to disable {device_name}"
                    on_button = driver.find_element(By.ID, f"InternetGatewayDevice_X_FireWall_TimeRule_{rule_id}__on")
                    on_button.click()
                elif button_state == 'needs_toggle':
                    # Click the off button
                    automation_status["current_step"] = f"Clicking toggle button to disable {device_name}"
                    off_button = driver.find_element(By.ID, button_id)
                    off_button.click()
                else:
                    raise Exception(f"Could not find toggle button for device {device_name}")
            
            # Wait for the toggle to take effect
            time.sleep(2)
            
            # Check if we need to click an apply button
            try:
                automation_status["current_step"] = "Looking for apply button"
                apply_button = driver.find_element(By.ID, "apply")
                apply_button.click()
                automation_status["current_step"] = "Clicked apply button"
                time.sleep(2)  # Wait for changes to apply
            except NoSuchElementException:
                # No apply button found, continue
                automation_status["current_step"] = "No apply button found, changes should be applied automatically"
            
            # Successful completion
            automation_status["current_step"] = f"Completed - Device {device_name} time control {'enabled' if enable else 'disabled'}"
            automation_status["last_completed"] = time.strftime("%Y-%m-%d %H:%M:%S")
            
        except TimeoutException as e:
            automation_status["last_error"] = f"Timeout while {automation_status['current_step']}: {str(e)}"
            logger.error(f"Timeout error: {str(e)}")
        except Exception as e:
            automation_status["last_error"] = f"Error during {automation_status['current_step']}: {str(e)}"
            logger.error(f"Unexpected error: {str(e)}")
        finally:
            # Close browser
            driver.quit()
            
    except WebDriverException as e:
        automation_status["last_error"] = f"Chrome driver error: {str(e)}"
        logger.error(f"WebDriver error: {str(e)}")
    except Exception as e:
        automation_status["last_error"] = f"Setup error: {str(e)}"
        logger.error(f"Setup error: {str(e)}")
    finally:
        automation_status["is_running"] = False

@app.post("/time-control")
async def control_time_rule(request: TimeControlRequest, background_tasks: BackgroundTasks):
    """Endpoint to trigger Chrome automation for time rule control"""
    if automation_status["is_running"]:
        return {"status": "already_running", "message": "Automation is already in progress"}
    
    # Start automation in background
    background_tasks.add_task(run_time_control_automation, request.device_name, request.enable)
    
    return {
        "status": "started",
        "message": f"Chrome automation started to {'enable' if request.enable else 'disable'} time control for device: {request.device_name}",
        "using_url": ROUTER_CONFIG["url"]
    }

@app.get("/automation-status")
async def get_automation_status():
    """Get current status of automation"""
    return automation_status

@app.get("/router-config")
async def get_router_config():
    """Get current router configuration (without exposing the password)"""
    return {
        "url": ROUTER_CONFIG["url"],
        "timeout": ROUTER_CONFIG["timeout"],
        "password": "********"  # Hide actual password for security
    }

@app.post("/update-router-config")
async def update_router_config(url: Optional[str] = None, password: Optional[str] = None, timeout: Optional[int] = None):
    """Update router configuration"""
    if url:
        ROUTER_CONFIG["url"] = url
    if password:
        ROUTER_CONFIG["password"] = password
    if timeout:
        ROUTER_CONFIG["timeout"] = timeout
    
    return {
        "status": "success",
        "message": "Router configuration updated",
        "current_config": {
            "url": ROUTER_CONFIG["url"],
            "timeout": ROUTER_CONFIG["timeout"],
            "password": "********"  # Hide actual password for security
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)