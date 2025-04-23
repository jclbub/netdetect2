import requests
import time
import json
from datetime import datetime

# API base URL
BASE_URL = "http://localhost:8005/api"

def get_all_devices():
    """Get all network devices from the API"""
    try:
        response = requests.get(f"{BASE_URL}/networks")
        response.raise_for_status()
        return response.json().get("networks", [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching devices: {e}")
        return []

def get_device_bandwidth(device_id):
    """Get the latest bandwidth usage for a specific device"""
    try:
        response = requests.get(f"{BASE_URL}/networks/{device_id}/bandwidth")
        response.raise_for_status()
        # Get the first (most recent) bandwidth entry
        bandwidth_data = response.json()
        if bandwidth_data and isinstance(bandwidth_data, list) and len(bandwidth_data) > 0:
            return bandwidth_data[0]
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching bandwidth for device {device_id}: {e}")
        return None

def bytes_to_kb(bytes_value):
    """Convert bytes to kilobytes"""
    return bytes_value / 1024

def monitor_bandwidth(threshold_kb=5):
    """Monitor bandwidth usage of all devices and alert when threshold is exceeded"""
    print(f"Starting bandwidth monitoring. Threshold: {threshold_kb}KB")
    print("-" * 70)
    
    while True:
        devices = get_all_devices()
        
        # Current timestamp for reporting
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\nChecking bandwidth at {current_time}")
        
        for device in devices:
            device_id = device.get("id")
            hostname = device.get("hostname", "Unknown")
            ip_address = device.get("ip_address", "Unknown")
            
            bandwidth = get_device_bandwidth(device_id)
            if bandwidth:
                upload_bytes = bandwidth.get("upload", 0)
                download_bytes = bandwidth.get("download", 0)
                
                # Convert bytes to KB for comparison and display
                upload_kb = bytes_to_kb(upload_bytes)
                download_kb = bytes_to_kb(download_bytes)
                
                # Check if either upload or download exceeds threshold in KB
                if upload_kb >= threshold_kb or download_kb >= threshold_kb:
                    print(f"ALERT! Device {hostname} ({ip_address}) exceeded threshold:")
                    print(f"  - Upload: {upload_bytes} bytes ({upload_kb:.2f}KB), Download: {download_bytes} bytes ({download_kb:.2f}KB)")
                else:
                    print(f"Device {hostname} ({ip_address}): Upload {upload_bytes} bytes ({upload_kb:.2f}KB), Download {download_bytes} bytes ({download_kb:.2f}KB)")
        
        # Wait for 1 second before checking again
        time.sleep(1)

if __name__ == "__main__":
    try:
        monitor_bandwidth(threshold_kb=5)
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user.")
    except Exception as e:
        print(f"Error: {e}")