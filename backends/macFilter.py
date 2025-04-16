from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import chromedriver_autoinstaller
from fastapi.middleware.cors import CORSMiddleware

# Install chromedriver automatically if it's not installed
chromedriver_autoinstaller.install()

# FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)   

# Default router configuration
DEFAULT_ROUTER_URL = "http://192.168.3.1"
DEFAULT_PASSWORD = "pass@AX3"



# Request Body Model
class DeviceRequest(BaseModel):
    device_name: str
    mac_address: str
    list_type: str  # either 'blocklist' or 'trustlist'

# Helper function to perform actions with Selenium
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
    if list_type == "blocklist":
        blocklist_radio_button = wait.until(EC.element_to_be_clickable((By.ID, "wlan_access_blankctrl_checkbox_ctrl_checkbox_ctrl")))
        blocklist_radio_button.click()
    elif list_type == "trustlist":
        trustlist_radio_button = wait.until(EC.element_to_be_clickable((By.ID, "wlan_access_whitectrl_checkbox_ctrl_checkbox_ctrl")))
        trustlist_radio_button.click()
    elif list_type == "unblocked":
        # Perform the deletion for unblocked list type
        delete_button = wait.until(EC.element_to_be_clickable((By.ID, "wlan_access_1_id_delid")))
        delete_button.click()
    else:
        driver.quit()
        raise ValueError("Invalid list type. Please choose 'blocklist', 'trustlist', or 'unblocked'.")

    # Step 7: Click the "Add" button (for blocklist and trustlist)
    if list_type != "unblocked":
        add_button = wait.until(EC.element_to_be_clickable((By.ID, "wlanaccess_btn")))
        add_button.click()

        # Step 8: Enter Device Name and MAC Address
        device_name_input = wait.until(EC.presence_of_element_located((By.ID, "wlanaccess_host_ctrl")))
        mac_address_input = wait.until(EC.presence_of_element_located((By.ID, "wlanaccess_adddevice_ctrl")))

        device_name_input.send_keys(device_name)
        mac_address_input.send_keys(mac_address)

        # Step 9: Click the "OK" button
        ok_button = wait.until(EC.element_to_be_clickable((By.ID, "submit")))
        ok_button.click()

    # Step 10: Click the "Save" button
    save_button = wait.until(EC.element_to_be_clickable((By.ID, "pwrmode_btn")))
    save_button.click()

    # Close the browser
    # driver.quit()


# API Endpoint to trigger the Selenium logic
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
