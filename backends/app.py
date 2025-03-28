import subprocess
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socket, requests, uuid
import psutil
import time
import threading
import sys
import pkg_resources
import importlib.util

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache Storage
cache_store = {}
cache_expiry = {}

# Default cache durations (seconds)
CACHE_DURATION = {
    "network_info": 60,  # Cache for 1 minute
    "network_speed": 60,  # Cache for 1 minute
    "bandwidth_usage": 1,  # Cache for 1 second
}

# Real-time network monitoring data
realtime_speed = {
    "download_mbps": 0,
    "upload_mbps": 0,
    "timestamp": 0,
    "monitoring": False,
    "interval_seconds": 1
}

def get_cached_data(key):
    """Retrieve cached data if valid."""
    if key in cache_store and time.time() < cache_expiry.get(key, 0):
        return cache_store[key]
    return None

def set_cache_data(key, data, duration):
    """Store data in cache with an expiration time."""
    cache_store[key] = data
    cache_expiry[key] = time.time() + duration

@app.get("/network-info")
def network_info():
    cached_data = get_cached_data("network_info")
    if cached_data:
        return cached_data
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
    set_cache_data("network_info", response, CACHE_DURATION["network_info"])
    return response

# Create a basic mock speedtest for when the real one isn't available
class MockSpeedtest:
    def __init__(self):
        self.results = type('obj', (object,), {'ping': 20})

    def get_best_server(self):
        pass

    def download(self):
        return 50 * 1_000_000  # 50 Mbps

    def upload(self):
        return 25 * 1_000_000  # 25 Mbps

@app.get("/network-speed")
def network_speed(force_test: bool = False, mock: bool = False):
    """Run a network speed test or return cached results."""
    if not force_test:
        cached_data = get_cached_data("network_speed")
        if cached_data:
            return cached_data
    
    if mock:
        # Use mock data if requested
        st = MockSpeedtest()
        download_speed = st.download() / 1_000_000
        upload_speed = st.upload() / 1_000_000
        ping = st.results.ping
        
        response = {
            "download_mbps": round(download_speed, 2),
            "upload_mbps": round(upload_speed, 2),
            "ping_ms": round(ping, 2),
            "timestamp": time.time(),
            "status": "success (mocked data)"
        }
        set_cache_data("network_speed", response, CACHE_DURATION["network_speed"])
        return response
    
    # Try using the speedtest-cli package - loading it directly from the site-packages
    try:
        # Find the location of the speedtest_cli package
        spec = importlib.util.find_spec('speedtest_cli')
        if spec is not None:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            if hasattr(module, 'Speedtest'):
                st = module.Speedtest()
                st.get_best_server()
                download_speed = st.download() / 1_000_000
                upload_speed = st.upload() / 1_000_000
                ping = st.results.ping
                
                response = {
                    "download_mbps": round(download_speed, 2),
                    "upload_mbps": round(upload_speed, 2),
                    "ping_ms": round(ping, 2),
                    "timestamp": time.time(),
                    "status": "success"
                }
                set_cache_data("network_speed", response, CACHE_DURATION["network_speed"])
                return response
    except Exception as e:
        error_details = str(e)
    
    # As a fallback, try a very simple network test using requests
    try:
        # Measure time to fetch a standard test file
        start_time = time.time()
        # This is a test file commonly used for download speed tests
        r = requests.get("https://speed.cloudflare.com/__down?bytes=10000000", timeout=10)
        end_time = time.time()
        
        if r.status_code == 200:
            # Calculate download speed
            size_in_megabits = len(r.content) * 8 / 1_000_000
            time_in_seconds = end_time - start_time
            download_speed = size_in_megabits / time_in_seconds if time_in_seconds > 0 else 0
            
            # Get ping (round-trip time)
            ping_start = time.time()
            requests.get("https://www.google.com", timeout=5)
            ping_time = (time.time() - ping_start) * 1000  # Convert to ms
            
            # Simple upload test - send a post request with some data
            upload_data = "X" * 1000000  # 1MB of data
            upload_start = time.time()
            requests.post("https://httpbin.org/post", data=upload_data, timeout=10)
            upload_end = time.time()
            
            # Calculate upload speed
            upload_size_in_megabits = len(upload_data) * 8 / 1_000_000
            upload_time = upload_end - upload_start
            upload_speed = upload_size_in_megabits / upload_time if upload_time > 0 else 0
            
            response = {
                "download_mbps": round(download_speed, 2),
                "upload_mbps": round(upload_speed, 2),
                "ping_ms": round(ping_time, 2),
                "timestamp": time.time(),
                "status": "partial success",
                "note": "Measured with simplified method due to speedtest library issues"
            }
            set_cache_data("network_speed", response, CACHE_DURATION["network_speed"])
            return response
    except Exception as fallback_error:
        # Both primary and fallback methods failed
        return {
            "error": "All speed test methods failed",
            "status": "failed",
            "speedtest_error": error_details if 'error_details' in locals() else "Unknown error",
            "fallback_error": str(fallback_error) if 'fallback_error' in locals() else "Not attempted"
        }

previous_net_io = psutil.net_io_counters()
last_update_time = time.time()
monitor_thread = None
stop_monitoring = threading.Event()

def calculate_speed(bytes_diff, time_diff):
    """Calculate speed in Mbps from bytes difference and time difference"""
    if time_diff <= 0:
        return 0
    bits_per_second = (bytes_diff * 8) / time_diff
    return bits_per_second / 1_000_000  # Convert to Mbps

def monitor_network_speed():
    """Background thread to continuously monitor network speed"""
    global previous_net_io, last_update_time
    
    previous_net_io = psutil.net_io_counters()
    last_update_time = time.time()
    
    while not stop_monitoring.is_set():
        try:
            time.sleep(realtime_speed["interval_seconds"])
            
            current_time = time.time()
            time_diff = current_time - last_update_time
            
            current_net_io = psutil.net_io_counters()
            bytes_sent = current_net_io.bytes_sent - previous_net_io.bytes_sent
            bytes_recv = current_net_io.bytes_recv - previous_net_io.bytes_recv
            
            # Calculate speeds in Mbps
            download_speed = calculate_speed(bytes_recv, time_diff)
            upload_speed = calculate_speed(bytes_sent, time_diff)
            
            # Update global values
            realtime_speed["download_mbps"] = round(download_speed, 2)
            realtime_speed["upload_mbps"] = round(upload_speed, 2)
            realtime_speed["timestamp"] = current_time
            
            # Update previous values for next calculation
            previous_net_io = current_net_io
            last_update_time = current_time
            
        except Exception as e:
            print(f"Error in monitoring thread: {e}")
            time.sleep(1)  # Avoid CPU spinning if there's an error

@app.get("/realtime-speed")
def get_realtime_speed():
    """Get the latest real-time network speed readings"""
    return {
        "download_mbps": realtime_speed["download_mbps"],
        "upload_mbps": realtime_speed["upload_mbps"],
        "timestamp": realtime_speed["timestamp"],
        "monitoring": realtime_speed["monitoring"],
        "interval_seconds": realtime_speed["interval_seconds"]
    }

@app.post("/realtime-speed/start")
def start_realtime_monitoring(interval: float = 1.0):
    global monitor_thread, stop_monitoring
    
    if interval < 0.1:
        return {"error": "Interval must be at least 0.1 seconds"}
    
    if realtime_speed["monitoring"]:
        stop_monitoring.set()
        if monitor_thread:
            monitor_thread.join(timeout=2)
    
    # Reset stop flag
    stop_monitoring.clear()
    
    # Update interval
    realtime_speed["interval_seconds"] = interval
    realtime_speed["monitoring"] = True
    
    # Start monitoring thread
    monitor_thread = threading.Thread(target=monitor_network_speed, daemon=True)
    monitor_thread.start()
    
    return {"status": "Monitoring started", "interval_seconds": interval}

@app.post("/realtime-speed/stop")
def stop_realtime_monitoring():
    """Stop real-time network speed monitoring"""
    global stop_monitoring
    
    if realtime_speed["monitoring"]:
        stop_monitoring.set()
        realtime_speed["monitoring"] = False
        return {"status": "Monitoring stopped"}
    else:
        return {"status": "Monitoring was not running"}

@app.get("/bandwidth-usage")
def bandwidth_usage(interval: int = 1):
    global previous_net_io
    global last_update_time

    cached_data = get_cached_data("bandwidth_usage")
    if cached_data:
        return cached_data

    try:
        current_time = time.time()
        if current_time - last_update_time < interval:
            return {"error": "Interval too short"}

        current_net_io = psutil.net_io_counters()
        bytes_sent = current_net_io.bytes_sent - previous_net_io.bytes_sent
        bytes_recv = current_net_io.bytes_recv - previous_net_io.bytes_recv
        packets_sent = current_net_io.packets_sent - previous_net_io.packets_sent
        packets_recv = current_net_io.packets_recv - previous_net_io.packets_recv

        previous_net_io = current_net_io  
        last_update_time = current_time

        response = {
            "bytes_sent": bytes_sent,
            "bytes_recv": bytes_recv,
            "packets_sent": packets_sent,
            "packets_recv": packets_recv,
        }

        set_cache_data("bandwidth_usage", response, CACHE_DURATION["bandwidth_usage"])
        return response
    except Exception as e:
        return {"error": str(e)}

@app.get("/total-bandwidth-usage")
def total_bandwidth_usage():
    """Get the total bandwidth usage of all network devices combined."""
    try:
        devices = psutil.net_io_counters(pernic=True)  # Get stats per network interface
        
        total_bytes_sent = sum(device.bytes_sent for device in devices.values())
        total_bytes_recv = sum(device.bytes_recv for device in devices.values())

        response = {
            "total_bytes_sent": total_bytes_sent,
            "total_bytes_recv": total_bytes_recv,
            "total_mbps_sent": round((total_bytes_sent * 8) / 1_000_000, 2),  # Convert to Mbps
            "total_mbps_recv": round((total_bytes_recv * 8) / 1_000_000, 2),  # Convert to Mbps
        }

        return response
    except Exception as e:
        return {"error": str(e)}

def identify_manufacturer(mac_address):
    # This function is not implemented in the provided code
    # It should return the manufacturer of the device with the given MAC address
    pass

@app.get("/scan-devices")
def scan_devices():
    devices = []  # This should be replaced with the actual list of devices
    failed_attempts = 0
    for device in devices:
        manufacturer = identify_manufacturer(device.mac_address)
        if manufacturer is None:
            failed_attempts += 1
            if failed_attempts >= 3:
                print(f'Could not identify manufacturer for {device.mac_address}. Resuming scan.')
                failed_attempts = 0  # Reset the counter
                continue  # Resume scanning for other devices
        else:
            print(f'Manufacturer identified for {device.mac_address}: {manufacturer}')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)