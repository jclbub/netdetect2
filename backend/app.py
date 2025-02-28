import subprocess
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socket, requests, uuid, speedtest
import psutil
import time
import threading

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
    "network_speed": 60,  # Cache for 5 minutes
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


def _run_speedtest():
    try:
        st = speedtest.Speedtest()
        st.get_best_server()
        download_speed = st.download() / 1_000_000  # Convert to Mbps
        upload_speed = st.upload() / 1_000_000  # Convert to Mbps
        ping = st.results.ping
        return download_speed, upload_speed, ping
    except Exception as e:
        print(f"Speedtest error: {e}")
        return None, None, None


@app.get("/network-speed")
def network_speed(force_test: bool = False):
    """
    Run a network speed test or return cached results.
    Set force_test=true to bypass cache and run a new test.
    """
    if not force_test:
        cached_data = get_cached_data("network_speed")
        if cached_data:
            return cached_data

    download, upload, ping = _run_speedtest()
    
    if download is None:
        return {"error": "Failed to run speed test"}
    
    response = {
        "download_mbps": round(download, 2),
        "upload_mbps": round(upload, 2),
        "ping_ms": round(ping, 2),
        "timestamp": time.time()
    }
    
    set_cache_data("network_speed", response, CACHE_DURATION["network_speed"])
    return response


# Network monitoring variables
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)