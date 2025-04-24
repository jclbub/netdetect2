from fastapi import FastAPI, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import mysql.connector
from mysql.connector import Error
from mysql.connector.pooling import MySQLConnectionPool
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import time
import json
from functools import lru_cache

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Network Monitoring API", 
              description="API to fetch network and bandwidth data",
              version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Warning: Use only in development!
    allow_credentials=False,  # Must be False with allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app default URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "goldfish123",
    "database": "netdetect",
    "pool_name": "mypool",
    "pool_size": 5  # Adjust based on your expected concurrent connections
}

# Create a connection pool
try:
    connection_pool = MySQLConnectionPool(**DB_CONFIG)
    print("Connection pool created successfully")
except Error as e:
    print(f"Error creating connection pool: {e}")
    raise

# Cache settings
CACHE_TTL = 30  # seconds
cache_data = {}

# Class to manage in-memory cache
class Cache:
    def __init__(self):
        self.data: Dict[str, Dict[str, Any]] = {}
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        if key in self.data:
            item = self.data[key]
            if item["expires"] > time.time():
                return item["data"]
            else:
                del self.data[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = CACHE_TTL) -> None:
        self.data[key] = {
            "data": value,
            "expires": time.time() + ttl
        }
    
    def clear(self) -> None:
        self.data.clear()

cache = Cache()

# Pydantic models for data validation and response serialization
class Bandwidth(BaseModel):
    upload: float
    download: float
    created_at: Optional[datetime] = None

class Network(BaseModel):
    id: int
    ip_address: str
    mac_address: str
    hostname: str
    manufacturer: Optional[str] = None
    device_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    total_upload: float = 0
    total_download: float = 0
    violation_count: int = 0  # Add default value for violation_count

class NetworkResponse(BaseModel):
    networks: List[Network]
    total_count: int

class Notification(BaseModel):
    noti_id: int
    device_id: int
    types: str
    remarks: str
    created_at: datetime
    hostname: Optional[str] = None
    ip_address: Optional[str] = None

# Function to get connection from pool
def get_connection():
    try:
        connection = connection_pool.get_connection()
        return connection
    except Error as e:
        print(f"Error getting connection from pool: {e}")
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

# Function to handle IP address duplicates
def handle_ip_conflict(ip_address: str, connection):
    """
    Handle duplicate IP address conflicts by checking if the IP already exists
    and updating the existing record instead of inserting a new one.
    """
    cursor = connection.cursor(dictionary=True)
    cursor.execute("SELECT id FROM networks WHERE ip_address = %s", (ip_address,))
    result = cursor.fetchone()
    cursor.close()
    return result["id"] if result else None

# Get all networks with bandwidth totals
@app.get("/api/networks", response_model=NetworkResponse)
def get_networks(response: Response):
    cache_key = "networks"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        # Add cache header for transparency
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Optimized query: Added index hints and limited columns
        query = """
        SELECT n.id, n.ip_address, n.mac_address, n.hostname, 
               n.manufacturer, n.device_type, n.status, 
               n.created_at, n.updated_at, 
               COALESCE(n.violation_count, 0) as violation_count,
               COALESCE(b.total_upload, 0) as total_upload, 
               COALESCE(b.total_download, 0) as total_download
        FROM networks n
        LEFT JOIN (
            SELECT device_id, 
                   SUM(upload) as total_upload, 
                   SUM(download) as total_download
            FROM bandwidth
            GROUP BY device_id
        ) b ON n.id = b.device_id
        """
        
        start_time = time.time()
        cursor.execute(query)
        networks = cursor.fetchall()
        
        # Get total count more efficiently
        cursor.execute("SELECT COUNT(*) as count FROM networks")
        total_count = cursor.fetchone()["count"]
        
        cursor.close()
        connection.close()
        
        result = {
            "networks": networks,
            "total_count": total_count
        }
        
        # Store in cache
        cache.set(cache_key, result)
        
        # Add timing header for monitoring
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return result
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Get a specific network by ID with bandwidth totals
@app.get("/api/networks/{network_id}", response_model=Network)
def get_network(network_id: int, response: Response):
    cache_key = f"network_{network_id}"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Optimized query with subquery
        query = """
        SELECT n.id, n.ip_address, n.mac_address, n.hostname, 
               n.manufacturer, n.device_type, n.status, 
               n.created_at, n.updated_at, 
               COALESCE(n.violation_count, 0) as violation_count,
               COALESCE(b.total_upload, 0) as total_upload, 
               COALESCE(b.total_download, 0) as total_download
        FROM networks n
        LEFT JOIN (
            SELECT device_id, 
                   SUM(upload) as total_upload, 
                   SUM(download) as total_download
            FROM bandwidth
            WHERE device_id = %s
            GROUP BY device_id
        ) b ON n.id = b.device_id
        WHERE n.id = %s
        """
        
        start_time = time.time()
        cursor.execute(query, (network_id, network_id))
        network = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not network:
            raise HTTPException(status_code=404, detail=f"Network with ID {network_id} not found")
        
        # Store in cache
        cache.set(cache_key, network)
        
        # Add timing header
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return network
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Get bandwidth data for a specific network
@app.get("/api/networks/{network_id}/bandwidth", response_model=List[Bandwidth])
def get_network_bandwidth(network_id: int, response: Response, limit: int = 100):
    cache_key = f"network_bandwidth_{network_id}_{limit}"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # First check if network exists using indexed lookup
        cursor.execute("SELECT 1 FROM networks WHERE id = %s LIMIT 1", (network_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail=f"Network with ID {network_id} not found")
        
        # Get bandwidth data with limit for better performance
        start_time = time.time()
        cursor.execute(
            "SELECT upload, download, created_at FROM bandwidth WHERE device_id = %s ORDER BY created_at DESC LIMIT %s",
            (network_id, limit)
        )
        bandwidth_data = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Store in cache
        cache.set(cache_key, bandwidth_data)
        
        # Add timing header
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return bandwidth_data
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Get summary of all network bandwidth usage
@app.get("/api/bandwidth/summary")
def get_bandwidth_summary(response: Response):
    cache_key = "bandwidth_summary"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Optimized query for device summary
        start_time = time.time()
        query = """
        SELECT 
            n.id,
            n.hostname,
            n.ip_address,
            COALESCE(n.violation_count, 0) as violation_count,
            COALESCE(SUM(b.upload), 0) as total_upload,
            COALESCE(SUM(b.download), 0) as total_download,
            COALESCE(SUM(b.upload), 0) + COALESCE(SUM(b.download), 0) as total_bandwidth
        FROM networks n
        LEFT JOIN bandwidth b ON n.id = b.device_id
        GROUP BY n.id
        ORDER BY total_bandwidth DESC
        """
        
        cursor.execute(query)
        summary = cursor.fetchall()
        
        # Optimized system-wide totals query
        cursor.execute("""
            SELECT 
                COALESCE(SUM(upload), 0) as total_system_upload,
                COALESCE(SUM(download), 0) as total_system_download,
                COALESCE(SUM(upload), 0) + COALESCE(SUM(download), 0) as total_system_bandwidth
            FROM bandwidth
        """)
        
        system_totals = cursor.fetchone()
        cursor.close()
        connection.close()
        
        result = {
            "device_summary": summary,
            "system_totals": system_totals
        }
        
        # Store in cache with longer TTL for summary data
        cache.set(cache_key, result, ttl=60)  # 60 seconds cache for summary
        
        # Add timing header
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return result
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Search networks by hostname, IP, or MAC address
@app.get("/api/networks/search/{search_term}", response_model=NetworkResponse)
def search_networks(search_term: str, response: Response):
    cache_key = f"search_{search_term}"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Optimized search query with subquery for bandwidth aggregation
        search_param = f"%{search_term}%"
        start_time = time.time()
        query = """
        SELECT n.*, 
               COALESCE(n.violation_count, 0) as violation_count,
               COALESCE(b.total_upload, 0) as total_upload, 
               COALESCE(b.total_download, 0) as total_download
        FROM networks n
        LEFT JOIN (
            SELECT device_id, 
                   SUM(upload) as total_upload, 
                   SUM(download) as total_download
            FROM bandwidth
            GROUP BY device_id
        ) b ON n.id = b.device_id
        WHERE n.hostname LIKE %s OR n.ip_address LIKE %s OR n.mac_address LIKE %s
        """
        
        cursor.execute(query, (search_param, search_param, search_param))
        networks = cursor.fetchall()
        
        # Get count more efficiently
        count_query = """
        SELECT COUNT(*) as count 
        FROM networks 
        WHERE hostname LIKE %s OR ip_address LIKE %s OR mac_address LIKE %s
        """
        
        cursor.execute(count_query, (search_param, search_param, search_param))
        total_count = cursor.fetchone()["count"]
        
        cursor.close()
        connection.close()
        
        result = {
            "networks": networks,
            "total_count": total_count
        }
        
        # Store in cache - shorter TTL for search results
        cache.set(cache_key, result, ttl=15)
        
        # Add timing header
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return result
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Helper function for upsert operation (handles duplicate IP addresses)
@app.post("/api/networks", response_model=Network)
def create_network(network: Network):
    """
    Create a new network device with duplicate IP handling
    """
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Check if IP already exists
        existing_id = handle_ip_conflict(network.ip_address, connection)
        
        if existing_id:
            # Update existing record
            update_query = """
            UPDATE networks 
            SET mac_address = %s, hostname = %s, manufacturer = %s,
                device_type = %s, status = %s, updated_at = NOW()
            WHERE id = %s
            """
            cursor.execute(
                update_query, 
                (network.mac_address, network.hostname, network.manufacturer,
                 network.device_type, network.status, existing_id)
            )
            network_id = existing_id
        else:
            # Insert new record with default violation_count
            insert_query = """
            INSERT INTO networks 
            (ip_address, mac_address, hostname, manufacturer, device_type, status, violation_count, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """
            cursor.execute(
                insert_query, 
                (network.ip_address, network.mac_address, network.hostname, 
                 network.manufacturer, network.device_type, network.status, 
                 network.violation_count or 0)  # Use provided violation_count or default to 0
            )
            network_id = cursor.lastrowid
        
        connection.commit()
        
        # Fetch the created/updated network
        cursor.execute(
            "SELECT * FROM networks WHERE id = %s", 
            (network_id,)
        )
        created_network = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return created_network
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Endpoint to clear cache (admin use)
@app.post("/api/admin/clear-cache")
def clear_cache():
    cache.clear()
    return {"status": "success", "message": "Cache cleared successfully"}

# Healthcheck endpoint
@app.get("/api/health")
def health_check():
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        connection.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")
    
@app.get("/api/notifications", response_model=List[Dict[str, Any]])
def get_notifications(response: Response, limit: int = 100, device_id: Optional[int] = None):
    """
    Get notifications with optional filtering by device_id.
    
    Parameters:
    - limit: Maximum number of notifications to return (default: 100)
    - device_id: Optional filter to get notifications for a specific device
    
    Returns:
    - List of notification objects with metadata
    """
    # Create a unique cache key based on parameters
    cache_key = f"notifications_{device_id}_{limit}" if device_id else f"notifications_{limit}"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        start_time = time.time()
        
        # Base query
        query = """
        SELECT n.noti_id, n.device_id, n.types, n.remarks, n.created_at,
               net.hostname, net.ip_address
        FROM notification n
        LEFT JOIN networks net ON n.device_id = net.id
        """
        
        params = []
        
        # Add device_id filter if specified
        if device_id is not None:
            query += " WHERE n.device_id = %s"
            params.append(device_id)
        
        # Add order and limit
        query += " ORDER BY n.created_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        notifications = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Store in cache
        cache.set(cache_key, notifications, ttl=30)  # 30 seconds TTL
        
        # Add timing header
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return notifications
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/notifications/{notification_id}", response_model=Dict[str, Any])
def get_notification_by_id(notification_id: int, response: Response):
    """
    Get a specific notification by ID
    
    Parameters:
    - notification_id: The ID of the notification to retrieve
    
    Returns:
    - Notification object with metadata
    """
    cache_key = f"notification_{notification_id}"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        start_time = time.time()
        
        query = """
        SELECT n.noti_id, n.device_id, n.types, n.remarks, n.created_at,
               net.hostname, net.ip_address
        FROM notification n
        LEFT JOIN networks net ON n.device_id = net.id
        WHERE n.noti_id = %s
        """
        
        cursor.execute(query, (notification_id,))
        notification = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if not notification:
            raise HTTPException(status_code=404, detail=f"Notification with ID {notification_id} not found")
        
        # Store in cache
        cache.set(cache_key, notification)
        
        # Add timing header
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return notification
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/notifications/types/{notification_type}", response_model=List[Dict[str, Any]])
def get_notifications_by_type(notification_type: str, response: Response, limit: int = 100):
    """
    Get notifications filtered by type (e.g., upload_spike, download_spike)
    
    Parameters:
    - notification_type: Type of notification to filter by
    - limit: Maximum number of notifications to return (default: 100)
    
    Returns:
    - List of notification objects matching the specified type
    """
    cache_key = f"notifications_type_{notification_type}_{limit}"
    cached_result = cache.get(cache_key)
    
    if cached_result:
        response.headers["X-Cache"] = "HIT"
        return cached_result
    
    response.headers["X-Cache"] = "MISS"
    
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        start_time = time.time()
        
        query = """
        SELECT n.noti_id, n.device_id, n.types, n.remarks, n.created_at,
               net.hostname, net.ip_address
        FROM notification n
        LEFT JOIN networks net ON n.device_id = net.id
        WHERE n.types = %s
        ORDER BY n.created_at DESC
        LIMIT %s
        """
        
        cursor.execute(query, (notification_type, limit))
        notifications = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Store in cache
        cache.set(cache_key, notifications, ttl=30)
        
        # Add timing header
        execution_time = time.time() - start_time
        response.headers["X-Execution-Time"] = f"{execution_time:.4f}s"
        
        return notifications
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Add an endpoint to create notifications with proper violation_count handling
@app.post("/api/notifications", response_model=Dict[str, Any])
def create_notification(notification: Notification):
    """
    Create a new notification with proper error handling
    """
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # First check if device exists
        cursor.execute("SELECT 1 FROM networks WHERE id = %s LIMIT 1", (notification.device_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise HTTPException(status_code=404, detail=f"Device with ID {notification.device_id} not found")
        
        # Insert notification with explicit fields
        insert_query = """
        INSERT INTO notification 
        (device_id, types, remarks, created_at)
        VALUES (%s, %s, %s, NOW())
        """
        cursor.execute(
            insert_query, 
            (notification.device_id, notification.types, notification.remarks)
        )
        
        # Update violation count for the device
        cursor.execute(
            "UPDATE networks SET violation_count = COALESCE(violation_count, 0) + 1 WHERE id = %s",
            (notification.device_id,)
        )
        
        connection.commit()
        
        # Get the created notification
        cursor.execute(
            "SELECT * FROM notification WHERE noti_id = %s", 
            (cursor.lastrowid,)
        )
        created_notification = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return created_notification
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Ensure the database schema has the correct structure
@app.post("/api/admin/check-schema")
def check_database_schema():
    """
    Check if the database schema has the required fields and defaults.
    This endpoint can be used to verify and fix schema issues.
    """
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Check if violation_count column exists in networks table
        cursor.execute("SHOW COLUMNS FROM networks LIKE 'violation_count'")
        violation_count_exists = cursor.fetchone()
        
        if not violation_count_exists:
            # Add violation_count column if it doesn't exist
            cursor.execute("ALTER TABLE networks ADD COLUMN violation_count INT NOT NULL DEFAULT 0")
            connection.commit()
            schema_changes = ["Added violation_count column to networks table"]
        else:
            # Ensure violation_count has a default value
            cursor.execute("ALTER TABLE networks MODIFY COLUMN violation_count INT NOT NULL DEFAULT 0")
            connection.commit()
            schema_changes = ["Updated violation_count column to have DEFAULT 0"]
        
        cursor.close()
        connection.close()
        
        return {
            "status": "success", 
            "message": "Database schema checked and updated if needed",
            "changes": schema_changes
        }
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database schema check error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)