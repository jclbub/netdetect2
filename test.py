import requests
import json
import time
from datetime import datetime, timedelta

class DeviceMonitor:
    """
    Intelligent monitoring system that applies a three-strike approach before
    taking action on devices with high priority or bandwidth issues.
    """
    
    def __init__(self):
        # API endpoints
        self.notification_api_url = "http://localhost:8005/api/notifications"
        self.time_control_api_url = "127.0.0.1:8001/time-control"
        self.device_api_url = "http://localhost:8005/api/devices"
        
        # Monitoring settings
        self.check_interval = 60  # Check every minute
        self.strike_waiting_period = 60  # Wait 1 minute between strikes
        self.strike_reset_threshold = 300  # Reset strikes after 5 minutes
        
        # Device tracking
        self.device_strikes = {}  # Format: {device_name: {"strikes": count, "last_strike_time": datetime, "next_check_time": datetime}}
        
        print(f"AI-based monitoring system initialized")
        print(f"Using three-strike approach with {self.strike_waiting_period}s between strikes")
        print(f"Strikes reset after {self.strike_reset_threshold}s of inactivity")
    
    def get_high_priority_hostnames(self):
        """
        Fetches notifications from the API and returns hostnames with [HIGH] in remarks.
        
        Returns:
            list: List of hostnames that have [HIGH] in their remarks
        """
        try:
            # Make API request
            response = requests.get(self.notification_api_url)
            
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

    def get_high_bandwidth_devices(self):
        """
        Fetches device information and identifies those with high bandwidth usage.
        
        Returns:
            list: List of device names with high bandwidth usage
        """
        try:
            # Make API request to get device bandwidth information
            response = requests.get(self.device_api_url)
            
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
                
                return high_bandwidth_devices
            else:
                print(f"Error: Device API request failed with status code {response.status_code}")
                return []
                
        except Exception as e:
            print(f"Error getting high bandwidth devices: {str(e)}")
            return []

    def control_device_time(self, device_name, enable=True):
        """
        Controls a device's time settings via the time control API.
        
        Args:
            device_name (str): The name of the device to control
            enable (bool): Whether to enable (True) or disable (False) the device
            
        Returns:
            bool: True if successful, False otherwise
        """
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
            api_url = self.time_control_api_url
            if not api_url.startswith("http://"):
                api_url = f"http://{api_url}"
            
            # Make API request
            response = requests.post(api_url, json=payload, headers=headers)
            
            # Check if request was successful
            if response.status_code == 200:
                action = "enabled" if enable else "disabled"
                print(f"✓ Successfully {action} time control for device: {device_name}")
                return True
            else:
                print(f"✗ Error: Time control API request failed with status code {response.status_code}")
                return False
        
        except Exception as e:
            print(f"✗ Error controlling device time: {str(e)}")
            return False

    def process_device(self, device_name, issue_type):
        """
        Processes a device using the three-strike system.
        
        Args:
            device_name (str): The name of the device to process
            issue_type (str): Type of issue (for logging purposes)
            
        Returns:
            bool: True if action was taken, False otherwise
        """
        current_time = datetime.now()
        
        # Initialize tracking for new devices
        if device_name not in self.device_strikes:
            self.device_strikes[device_name] = {
                "strikes": 0,
                "last_strike_time": None,
                "next_check_time": current_time,
                "issue_type": issue_type
            }
        
        device_data = self.device_strikes[device_name]
        
        # Check if we need to reset strikes due to time threshold
        if device_data["strikes"] > 0 and device_data["last_strike_time"]:
            time_since_first_strike = (current_time - device_data["last_strike_time"]).total_seconds()
            
            if time_since_first_strike > self.strike_reset_threshold:
                print(f"⟲ Resetting strikes for {device_name} ({time_since_first_strike:.1f}s since first strike > {self.strike_reset_threshold}s threshold)")
                device_data["strikes"] = 0
                device_data["last_strike_time"] = None
                device_data["issue_type"] = issue_type  # Update issue type in case it changed
        
        # Check if it's time to process this device
        if current_time < device_data["next_check_time"]:
            wait_time = (device_data["next_check_time"] - current_time).total_seconds()
            print(f"⏳ Waiting {wait_time:.1f}s before next check for {device_name} (Strike {device_data['strikes'] + 1})")
            return False
            
        # Increment strike count
        device_data["strikes"] += 1
        
        # Set last strike time if this is the first strike
        if device_data["strikes"] == 1:
            device_data["last_strike_time"] = current_time
            
        # Log the strike
        print(f"❗ Strike {device_data['strikes']} for {device_name} - {issue_type}")
            
        # Take action if three strikes reached
        if device_data["strikes"] >= 3:
            print(f"⚠️ Three strikes reached for {device_name} - Blocking device")
            success = self.control_device_time(device_name, enable=True)
            
            # Reset strikes after taking action
            if success:
                print(f"✅ Action taken for {device_name} - Resetting strikes")
                device_data["strikes"] = 0
                device_data["last_strike_time"] = None
            
            return success
        else:
            # Set next check time
            device_data["next_check_time"] = current_time + timedelta(seconds=self.strike_waiting_period)
            print(f"⏰ Next check for {device_name} at {device_data['next_check_time'].strftime('%H:%M:%S')}")
            return False

    def run(self):
        """
        Main monitoring loop with intelligent strike system.
        """
        print(f"Starting AI-based monitoring system...")
        print("-" * 60)
        
        try:
            while True:
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                print(f"\n[{current_time}] Running system check...")
                
                # Process devices with high priority notifications
                high_priority_hostnames = self.get_high_priority_hostnames()
                if high_priority_hostnames:
                    print(f"Found {len(high_priority_hostnames)} hostnames with [HIGH] priority remarks")
                    for hostname in high_priority_hostnames:
                        self.process_device(hostname, "High Priority Notification")
                else:
                    print("No hostnames with [HIGH] priority remarks found")
                
                # Process devices with high bandwidth usage
                high_bandwidth_devices = self.get_high_bandwidth_devices()
                if high_bandwidth_devices:
                    print(f"Found {len(high_bandwidth_devices)} devices with high bandwidth usage")
                    for device_name in high_bandwidth_devices:
                        self.process_device(device_name, "High Bandwidth Usage")
                else:
                    print("No devices with high bandwidth usage found")
                
                # Only process ICTD-PC if it's found in the high priority or high bandwidth lists
                # Don't automatically check ICTD-PC if it has no issues
                # This code is removed to fix the unnecessary strikes
                
                # Print current strike status for all devices
                self.print_strike_status()
                
                # Wait for the next check interval
                print(f"\nNext full system check in {self.check_interval} seconds...")
                time.sleep(self.check_interval)
                
        except KeyboardInterrupt:
            print("\nMonitoring stopped by user")
        except Exception as e:
            print(f"\nError in monitoring loop: {str(e)}")
    
    def print_strike_status(self):
        """
        Prints the current strike status for all tracked devices.
        """
        if not self.device_strikes:
            return
            
        current_time = datetime.now()
        print("\n----- Current Device Strike Status -----")
        print(f"{'Device Name':<20} {'Strikes':<10} {'Issue Type':<25} {'Next Check':<15}")
        print("-" * 70)
        
        for device_name, data in self.device_strikes.items():
            next_check = "N/A"
            if data["next_check_time"] > current_time:
                next_check = data["next_check_time"].strftime("%H:%M:%S")
            elif data["strikes"] > 0 and data["strikes"] < 3:
                next_check = "Due now"
                
            print(f"{device_name:<20} {data['strikes']:<10} {data.get('issue_type', 'Unknown'):<25} {next_check:<15}")
        print("-" * 70)

if __name__ == "__main__":
    monitor = DeviceMonitor()
    monitor.run()