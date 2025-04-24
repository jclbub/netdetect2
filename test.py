import requests
import json
import time
from datetime import datetime

def get_high_priority_hostnames(api_url):
    """
    Fetches notifications from the API and returns hostnames with [HIGH] in remarks.
    
    Args:
        api_url (str): The URL of the notifications API endpoint
        
    Returns:
        list: List of hostnames that have [HIGH] in their remarks
    """
    try:
        # Make API request
        response = requests.get(api_url)
        
        # Check if request was successful
        if response.status_code == 200:
            # Parse JSON response
            notifications = json.loads(response.text)
            
            # Filter hostnames where remarks contain [HIGH]
            high_priority_hostnames = []
            
            for notification in notifications:
                if "[HIGH]" in notification.get("remarks", ""):
                    hostname = notification.get("hostname")
                    if hostname:
                        high_priority_hostnames.append(hostname)
            
            return high_priority_hostnames
        else:
            print(f"Error: API request failed with status code {response.status_code}")
            return []
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return []

def control_device_time(time_control_api, device_name="ICTD-PC", enable=True):
    """
    Controls a device's time settings via the time control API.
    
    Args:
        time_control_api (str): The URL of the time control API endpoint
        device_name (str): The name of the device to control (default: ICTD-PC)
        enable (bool): Whether to enable (True) or disable (False) the device
        
    Returns:
        bool: True if successful, False otherwise
    """
    print(f"Controlling device: {device_name}, enable: {enable}")
    try:
        # Prepare payload
        payload = {
            "device_name": device_name,
            "enable": enable
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # Make API request with proper URL formatting
        if not time_control_api.startswith("http://"):
            time_control_api = f"http://{time_control_api}"
        
        print(f"Sending request to: {time_control_api}")
        print(f"Payload: {json.dumps(payload)}")
        
        # Make API request
        response = requests.post(time_control_api, json=payload, headers=headers)
        
        # Check if request was successful
        if response.status_code == 200:
            print(f"Successfully {'enabled' if enable else 'disabled'} time control for device: {device_name}")
            print(f"Response: {response.text}")
            return True
        else:
            print(f"Error: Time control API request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    except Exception as e:
        print(f"Error controlling device time: {str(e)}")
        return False

def get_high_bandwidth_devices(api_url):
    """
    Fetches device information and identifies those with high bandwidth usage.
    
    Args:
        api_url (str): The URL of the device information API endpoint
        
    Returns:
        list: List of device names with high bandwidth usage
    """
    try:
        # Make API request to get device bandwidth information
        response = requests.get(api_url)
        
        if response.status_code == 200:
            devices = json.loads(response.text)
            
            # Filter devices with high bandwidth
            high_bandwidth_devices = []
            
            for device in devices:
                # Check if bandwidth exceeds threshold
                bandwidth = device.get("bandwidth", 0)
                threshold = device.get("bandwidth_threshold", 100)
                
                if bandwidth > threshold:
                    device_name = device.get("name")
                    if device_name:
                        high_bandwidth_devices.append(device_name)
                        print(f"Device {device_name} has high bandwidth: {bandwidth} > {threshold}")
            
            return high_bandwidth_devices
        else:
            print(f"Error: Device API request failed with status code {response.status_code}")
            return []
            
    except Exception as e:
        print(f"Error getting high bandwidth devices: {str(e)}")
        return []

def main():
    # API endpoints
    notification_api_url = "http://localhost:8005/api/notifications"
    time_control_api_url = "127.0.0.1:8001/time-control"  # Fixed to match provided example
    device_api_url = "http://localhost:8005/api/devices"
    
    # Set interval (in seconds)
    interval = 120  # 2 minutes
    
    print(f"Starting continuous monitoring for high priority hostnames and bandwidth control...")
    print(f"Checking every {interval} seconds (2 minutes)")
    print("-" * 50)
    
    # Track devices that have already been controlled to avoid duplicates
    controlled_devices = {}
    
    try:
        # Run continuously
        while True:
            # Get current timestamp
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            print(f"\n[{current_time}] Starting check...")
            
            # 1. Get hostnames with [HIGH] remarks
            high_priority_hostnames = get_high_priority_hostnames(notification_api_url)
            
            # Print hostname results
            print(f"[{current_time}] Priority check completed:")
            if high_priority_hostnames:
                print("Hostnames with [HIGH] priority remarks:")
                for hostname in high_priority_hostnames:
                    print(f"- {hostname}")
                    
                    # Control high priority hostnames
                    success = control_device_time(time_control_api_url, hostname, enable=True)
                    if success:
                        controlled_devices[hostname] = True
            else:
                print("No hostnames with [HIGH] priority remarks found.")
            
            # 2. Get devices with high bandwidth usage
            high_bandwidth_devices = get_high_bandwidth_devices(device_api_url)
            
            # Print bandwidth results and control devices
            print(f"[{current_time}] Bandwidth check completed:")
            if high_bandwidth_devices:
                print("Devices with high bandwidth usage:")
                for device_name in high_bandwidth_devices:
                    print(f"- {device_name}")
                    
                    # Apply time control to high bandwidth devices
                    if device_name not in controlled_devices or controlled_devices[device_name] == False:
                        success = control_device_time(time_control_api_url, device_name, enable=True)
                        if success:
                            controlled_devices[device_name] = True
            else:
                print("No devices with high bandwidth usage found.")
                
            # Always control ICTD-PC regardless of other conditions
            success = control_device_time(time_control_api_url, "ICTD-PC", enable=True)
            if success:
                controlled_devices["ICTD-PC"] = True
            
            # Wait for the specified interval
            print(f"Next check in {interval} seconds...")
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user.")
    except Exception as e:
        print(f"\nError in monitoring loop: {str(e)}")

if __name__ == "__main__":
    main()