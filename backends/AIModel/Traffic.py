# AI Network Monitor
# Enhanced, automated network anomaly detection system

import requests
import mysql.connector
from mysql.connector import Error
import time
import logging
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import joblib
import os
from collections import defaultdict
import threading
import schedule
import warnings
from sklearn.exceptions import ConvergenceWarning

# Suppress sklearn warnings
warnings.filterwarnings("ignore", category=ConvergenceWarning)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ai_network_monitor.log"),
        logging.StreamHandler()
    ]
)

# Global Configuration
CONFIG = {
    # Database Configuration
    'db': {
        'host': 'localhost',
        'database': 'netdetect',
        'user': 'root',
        'password': 'goldfish123',
        'autocommit': False
    },
    
    # API Configuration
    'api': {
        'endpoint': "http://127.0.0.1:8000/connected-devices",
        'timeout': 3
    },
    
    # ML Model Configuration
    'ml': {
        'model_dir': "models",
        'retrain_interval': 86400,  # 24 hours in seconds
        'min_samples': 100,
        'features': [
            'upload', 'download', 'upload_change', 'download_change', 
            'hour_of_day', 'day_of_week', 'upload_rolling_mean', 
            'download_rolling_mean', 'upload_rolling_std', 'download_rolling_std',
            'active_time', 'connection_count'
        ],
        'anomaly_threshold': -0.5,  # Isolation Forest threshold
        'contamination': 0.05  # Expected percentage of anomalies
    },
    
    # Monitoring Configuration
    'monitor': {
        'poll_interval': 2,  # seconds
        'max_history_per_device': 100,
        'cooldown_period': 300,  # 5 minutes between duplicate notifications
        'max_consecutive_errors': 3,
        'connection_retry_interval': 5,  # seconds
        'alert_levels': {
            'low': 1,
            'medium': 2,
            'high': 3
        }
    }
}

class DatabaseManager:
    """Handle all database operations"""
    
    def __init__(self, db_config):
        self.db_config = db_config
        self.connection = None
        self.cursor = None
        self.last_connection_attempt = 0
        self.connection_retry_interval = CONFIG['monitor']['connection_retry_interval']
    
    def connect(self):
        """Establish connection to the MySQL database"""
        current_time = time.time()
        
        # Don't attempt to reconnect too frequently
        if (self.connection and self.connection.is_connected()) or \
           (current_time - self.last_connection_attempt < self.connection_retry_interval):
            return self.connection is not None and self.connection.is_connected()
        
        self.last_connection_attempt = current_time
        
        try:
            if self.connection and self.connection.is_connected():
                return True
                
            self.connection = mysql.connector.connect(**self.db_config)
            if self.connection.is_connected():
                self.cursor = self.connection.cursor(buffered=True)
                logging.info("Successfully connected to MySQL database")
                return True
        except Error as e:
            logging.error(f"Error connecting to MySQL database: {e}")
            return False
    
    def close(self):
        """Close the database connection"""
        try:
            if self.cursor:
                self.cursor.close()
                self.cursor = None
            
            if self.connection and self.connection.is_connected():
                self.connection.close()
                self.connection = None
                logging.info("Database connection closed")
        except Error as e:
            logging.error(f"Error closing database connection: {e}")
    
    def execute_query(self, query, params=None, commit=False):
        """Execute a database query with exception handling"""
        if not self.connect():
            return False, None
        
        try:
            if params:
                self.cursor.execute(query, params)
            else:
                self.cursor.execute(query)
            
            if commit:
                self.connection.commit()
            
            return True, self.cursor
        except Error as e:
            logging.error(f"Database query error: {e}")
            self.handle_error()
            return False, None
    
    def fetch_one(self, query, params=None):
        """Execute query and fetch one result"""
        success, cursor = self.execute_query(query, params)
        if success and cursor:
            return cursor.fetchone()
        return None
    
    def fetch_all(self, query, params=None):
        """Execute query and fetch all results"""
        success, cursor = self.execute_query(query, params)
        if success and cursor:
            return cursor.fetchall()
        return None
    
    def execute_and_commit(self, query, params=None):
        """Execute query and commit changes"""
        success, cursor = self.execute_query(query, params, commit=True)
        if success and cursor:
            return cursor.lastrowid if cursor.lastrowid else True
        return False
    
    def handle_error(self):
        """Handle database errors with proper rollback"""
        try:
            if self.connection and self.connection.is_connected():
                logging.info("Rolling back transaction due to error")
                self.connection.rollback()
        except Error as e:
            logging.error(f"Error during rollback: {e}")
    
    def commit(self):
        """Commit pending transactions"""
        if self.connection and self.connection.is_connected():
            self.connection.commit()
            return True
        return False


class DeviceManager:
    """Manages device data and operations"""
    
    def __init__(self, db_manager):
        self.db = db_manager
    
    def get_device_id(self, ip_address, mac_address):
        """Get device ID from networks table or insert if not exists"""
        query = "SELECT id FROM networks WHERE ip_address = %s OR mac_address = %s"
        result = self.db.fetch_one(query, (ip_address, mac_address))
        
        if result:
            return result[0]
        return None
    
    def insert_or_update_device(self, device_data):
        """Insert or update device in networks table"""
        # Extract relevant data
        ip_address = device_data.get('IPAddress', '')
        mac_address = device_data.get('MACAddress', '')
        hostname = device_data.get('HostName', '')
        manufacturer = device_data.get('ActualManu', '')
        device_type = device_data.get('DeviceType', '')
        status = 'Active' if device_data.get('Active', False) else 'Offline'
        
        # Check if device exists
        device_id = self.get_device_id(ip_address, mac_address)
        
        if device_id:
            # Update existing device
            query = """
            UPDATE networks 
            SET ip_address = %s, mac_address = %s, hostname = %s, 
                manufacturer = %s, device_type = %s, status = %s
            WHERE id = %s
            """
            self.db.execute_and_commit(query, (ip_address, mac_address, hostname, manufacturer, device_type, status, device_id))
        else:
            # Insert new device
            query = """
            INSERT INTO networks 
            (ip_address, mac_address, hostname, manufacturer, device_type, status) 
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            device_id = self.db.execute_and_commit(query, (ip_address, mac_address, hostname, manufacturer, device_type, status))
            logging.info(f"Inserted new device with ID: {device_id}")
        
        return device_id
    
    def update_bandwidth(self, device_id, upload, download):
        """Update bandwidth information in the database"""
        query = """
        INSERT INTO bandwidth (device_id, upload, download) 
        VALUES (%s, %s, %s)
        """
        return self.db.execute_and_commit(query, (device_id, upload, download))
    
    def fetch_historical_data(self, device_id, limit=1000):
        """Fetch historical bandwidth data from database for model training"""
        query = """
        SELECT bandwidth, device_id, upload, download, created_at
        FROM bandwidth
        WHERE device_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """
        
        results = self.db.fetch_all(query, (device_id, limit))
        
        if not results:
            return None
        
        # Create dataset
        data = []
        prev_upload, prev_download = 0, 0
        
        for i, (bandwidth_id, device_id, upload, download, timestamp) in enumerate(results):
            # Calculate changes
            if i > 0:
                upload_change = upload - prev_upload
                download_change = download - prev_download
            else:
                upload_change = 0
                download_change = 0
            
            # Store for next iteration
            prev_upload, prev_download = upload, download
            
            # Default values for fields not in the schema
            connection_count = 0
            active_time = 0
            
            # Store data point
            data.append({
                'upload': upload,
                'download': download,
                'upload_change': upload_change,
                'download_change': download_change,
                'hour_of_day': timestamp.hour,
                'day_of_week': timestamp.weekday(),
                'timestamp': timestamp,
                'connection_count': connection_count,
                'active_time': active_time
            })
        
        # Reverse to get chronological order
        data.reverse()
        
        # Calculate rolling statistics
        df = pd.DataFrame(data)
        df['upload_rolling_mean'] = df['upload'].rolling(window=5, min_periods=1).mean()
        df['download_rolling_mean'] = df['download'].rolling(window=5, min_periods=1).mean()
        df['upload_rolling_std'] = df['upload'].rolling(window=5, min_periods=2).std().fillna(0)
        df['download_rolling_std'] = df['download'].rolling(window=5, min_periods=2).std().fillna(0)
        
        return df.to_dict('records')
    
    def add_notification(self, device_id, notification_type, severity, remarks=None):
        """Add a notification to the notification table"""
        query = """
        INSERT INTO notification (device_id, types, remarks) 
        VALUES (%s, %s, %s)
        """
        # Severity is included in remarks since there's no severity column
        severity_text = ""
        if severity == 3:
            severity_text = "[HIGH] "
        elif severity == 2:
            severity_text = "[MEDIUM] "
        elif severity == 1:
            severity_text = "[LOW] "
            
        full_remarks = f"{severity_text}{remarks}"
        
        result = self.db.execute_and_commit(query, (device_id, notification_type, full_remarks))
        
        if result:
            logging.info(f"NOTIFICATION SAVED: {notification_type} (severity: {severity}) for device {device_id}: {remarks}")
        
        return result is not False


class APIManager:
    """Manages API interactions"""
    
    def __init__(self, api_config):
        self.api_endpoint = api_config['endpoint']
        self.timeout = api_config['timeout']
        self.consecutive_errors = 0
        self.max_consecutive_errors = CONFIG['monitor']['max_consecutive_errors']
    
    def fetch_device_data(self):
        """Fetch data from the API endpoint"""
        try:
            response = requests.get(self.api_endpoint, timeout=self.timeout)
            self.consecutive_errors = 0  # Reset error counter on success
            
            if response.status_code == 200:
                return response.json()
            else:
                logging.error(f"Failed to fetch data: Status code {response.status_code}")
                self.consecutive_errors += 1
                return None
        except requests.exceptions.RequestException as e:
            self.consecutive_errors += 1
            if self.consecutive_errors >= self.max_consecutive_errors:
                logging.error(f"Multiple consecutive request errors ({self.consecutive_errors}). Consider checking API endpoint.")
            else:
                logging.warning(f"Request error: {e}")
            return None


class MLManager:
    """Manages machine learning models for anomaly detection"""
    
    def __init__(self, ml_config, device_manager):
        self.ml_config = ml_config
        self.device_manager = device_manager
        self.models = {}  # Dictionary to store model per device {device_id: model_data}
        self.last_model_train_time = {}  # Track when models were last trained
        self.anomaly_threshold = ml_config['anomaly_threshold']
        self.model_dir = ml_config['model_dir']
        self.retrain_interval = ml_config['retrain_interval']
        self.min_samples = ml_config['min_samples']
        self.features = ml_config['features']
        self.contamination = ml_config['contamination']
        
        # Create model directory if it doesn't exist
        if not os.path.exists(self.model_dir):
            os.makedirs(self.model_dir)
    
    def prepare_feature_vector(self, data_point):
        """Extract features from data point for anomaly detection"""
        # Create feature vector array
        feature_values = []
        for feature in self.features:
            value = data_point.get(feature, 0)
            # Handle potential missing features
            if value is None:
                value = 0
            feature_values.append(value)
        
        return np.array([feature_values])
    
    def load_model(self, device_id):
        """Load model from disk if available"""
        model_path = os.path.join(self.model_dir, f"device_{device_id}_model.joblib")
        
        if os.path.exists(model_path):
            try:
                model_data = joblib.load(model_path)
                self.models[device_id] = model_data
                self.last_model_train_time[device_id] = time.time()
                logging.info(f"Loaded model for device {device_id} from disk")
                return True
            except Exception as e:
                logging.error(f"Error loading model for device {device_id}: {e}")
        
        return False
    
    def train_model(self, device_id, device_history=None):
        """Train an anomaly detection model for a specific device"""
        # If device history not provided, fetch from database
        if not device_history:
            device_history = self.device_manager.fetch_historical_data(device_id)
        
        # Check if we have enough data points
        if not device_history or len(device_history) < self.min_samples:
            logging.warning(f"Not enough data to train model for device {device_id}")
            return False
        
        try:
            # Create dataframe from device history
            df = pd.DataFrame(device_history)
            
            # Make sure all required features exist or add with default values
            for feature in self.features:
                if feature not in df.columns:
                    df[feature] = 0
            
            # Extract features for training
            X = df[self.features].fillna(0).values
            
            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # Train Isolation Forest model for anomaly detection
            if_model = IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=100
            )
            if_model.fit(X_scaled)
            
            # Also train a classifier for potential anomaly classification
            # (Creating synthetic labels based on isolation forest)
            y_pred = if_model.predict(X_scaled)
            synthetic_labels = np.where(y_pred == -1, 1, 0)  # Convert to binary classification
            
            # If we have anomalies, train a classifier
            if np.sum(synthetic_labels) >= 5:  # Need some anomalies for training
                rf_classifier = RandomForestClassifier(
                    n_estimators=50,
                    max_depth=5,
                    random_state=42
                )
                rf_classifier.fit(X_scaled, synthetic_labels)
            else:
                rf_classifier = None
            
            # Save model and scaler
            model_data = {
                'if_model': if_model,  # Isolation Forest for anomaly detection
                'rf_model': rf_classifier,  # Random Forest for additional classification
                'scaler': scaler,
                'feature_names': self.features,
                'updated_at': datetime.now()
            }
            
            # Store in memory
            self.models[device_id] = model_data
            self.last_model_train_time[device_id] = time.time()
            
            # Save to disk
            try:
                model_path = os.path.join(self.model_dir, f"device_{device_id}_model.joblib")
                joblib.dump(model_data, model_path)
                logging.info(f"Trained and saved model for device {device_id}")
            except Exception as e:
                logging.error(f"Error saving model to disk: {e}")
            
            return True
        
        except Exception as e:
            logging.error(f"Error training model for device {device_id}: {e}")
            return False
    
    def detect_anomaly(self, device_id, data_point):
        """Detect anomalies in network behavior using ML models"""
        # Check if we need to train or load a model
        if device_id not in self.models:
            # Try to load from disk first
            if not self.load_model(device_id):
                # If we can't load, use fallback threshold detection
                return self.fallback_anomaly_detection(data_point)
        
        # Check if model needs retraining
        current_time = time.time()
        last_train_time = self.last_model_train_time.get(device_id, 0)
        
        if current_time - last_train_time > self.retrain_interval:
            logging.info(f"Model for device {device_id} needs retraining")
            # Schedule retraining in a background thread (don't block current detection)
            threading.Thread(target=self.train_model, args=(device_id,)).start()
        
        # If we have a model, use it for prediction
        if device_id in self.models:
            try:
                model_data = self.models[device_id]
                if_model = model_data['if_model']
                scaler = model_data['scaler']
                
                # Prepare feature vector
                features = self.prepare_feature_vector(data_point)
                
                # Scale features
                features_scaled = scaler.transform(features)
                
                # Get anomaly score (-1 for anomalies, 1 for normal)
                score = if_model.decision_function(features_scaled)[0]
                prediction = if_model.predict(features_scaled)[0]
                
                is_anomaly = score < self.anomaly_threshold
                
                if is_anomaly:
                    # Use the RF classifier for additional details if available
                    anomaly_info = self.classify_anomaly(data_point, score, model_data.get('rf_model'))
                    return True, anomaly_info
                
                return False, None
            
            except Exception as e:
                logging.error(f"Error using ML model for anomaly detection: {e}")
                # Fall back to simpler detection method
                return self.fallback_anomaly_detection(data_point)
        else:
            # No model available, use fallback
            return self.fallback_anomaly_detection(data_point)
    
    def classify_anomaly(self, data_point, anomaly_score, rf_model=None):
        """Classify the type of anomaly based on features"""
        # Get feature values
        upload = data_point.get('upload', 0)
        download = data_point.get('download', 0)
        upload_change = data_point.get('upload_change', 0)
        download_change = data_point.get('download_change', 0)
        
        # Format values for display with appropriate units
        def format_bandwidth(value):
            if value >= 1024 * 1024:
                return f"{value / (1024 * 1024):.2f} MB/s"
            elif value >= 1024:
                return f"{value / 1024:.2f} KB/s"
            else:
                return f"{value:.2f} B/s"
        
        # Determine anomaly severity based on score
        if anomaly_score < -0.8:
            severity = 'high'
        elif anomaly_score < -0.65:
            severity = 'medium'
        else:
            severity = 'low'
            
        # Determine most significant deviation
        if upload_change > download_change and upload > 100:
            if upload > 1000:
                return {
                    'type': 'high_upload_anomaly',
                    'description': f"Unusual high upload traffic detected ({format_bandwidth(upload)})",
                    'severity': severity
                }
            else:
                return {
                    'type': 'upload_anomaly',
                    'description': f"Unusual upload pattern detected ({format_bandwidth(upload)})",
                    'severity': severity
                }
        elif download_change > upload_change and download > 200:
            if download > 2000:
                return {
                    'type': 'high_download_anomaly',
                    'description': f"Unusual high download traffic detected ({format_bandwidth(download)})",
                    'severity': severity
                }
            else:
                return {
                    'type': 'download_anomaly',
                    'description': f"Unusual download pattern detected ({format_bandwidth(download)})",
                    'severity': severity
                }
        elif upload > 50 and download > 50:
            return {
                'type': 'bidirectional_anomaly',
                'description': f"Unusual bidirectional traffic pattern (Up: {format_bandwidth(upload)}, Down: {format_bandwidth(download)})",
                'severity': severity
            }
        else:
            return {
                'type': 'pattern_anomaly',
                'description': "Unusual network traffic pattern detected",
                'severity': severity
            }
    
    def fallback_anomaly_detection(self, data_point):
        """Simple threshold-based anomaly detection as fallback when ML is not available"""
        # Extract values
        upload = data_point.get('upload', 0)
        download = data_point.get('download', 0)
        upload_change = data_point.get('upload_change', 0)
        download_change = data_point.get('download_change', 0)
        
        # Format values for display with appropriate units
        def format_bandwidth(value):
            if value >= 1024 * 1024:
                return f"{value / (1024 * 1024):.2f} MB/s"
            elif value >= 1024:
                return f"{value / 1024:.2f} KB/s"
            else:
                return f"{value:.2f} B/s"
        
        is_anomaly = False
        anomaly_info = None
        
        # Check for significant spikes
        if upload_change > 200 and upload > 500:
            is_anomaly = True
            anomaly_info = {
                'type': "upload_spike",
                'description': f"Sudden upload spike detected ({format_bandwidth(upload)})",
                'severity': 'medium'
            }
        elif download_change > 500 and download > 1000:
            is_anomaly = True
            anomaly_info = {
                'type': "download_spike",
                'description': f"Sudden download spike detected ({format_bandwidth(download)})",
                'severity': 'medium'
            }
        elif upload > 1000 and download > 1000:
            is_anomaly = True
            anomaly_info = {
                'type': "high_bandwidth_usage",
                'description': f"High bandwidth usage detected (Up: {format_bandwidth(upload)}, Down: {format_bandwidth(download)})",
                'severity': 'high' if upload + download > 5000 else 'medium'
            }
        
        return is_anomaly, anomaly_info


class AINetworkMonitor:
    """Main class that coordinates all components for network monitoring"""
    
    def __init__(self, config):
        self.config = config
        self.poll_interval = config['monitor']['poll_interval']
        self.max_history_per_device = config['monitor']['max_history_per_device']
        self.cooldown_period = config['monitor']['cooldown_period']
        
        # Initialize managers
        self.db_manager = DatabaseManager(config['db'])
        self.device_manager = DeviceManager(self.db_manager)
        self.api_manager = APIManager(config['api'])
        self.ml_manager = MLManager(config['ml'], self.device_manager)
        
        # Device data tracking
        self.device_data = defaultdict(list)  # Store recent data for each device
        self.previous_bandwidth = {}          # Store previous readings
        self.notification_cooldown = {}       # Prevent duplicate notifications
        self.consecutive_errors = 0
        self.max_consecutive_errors = config['monitor']['max_consecutive_errors']
        
        # Alert levels
        self.alert_levels = config['monitor']['alert_levels']
    
    def update_device_history(self, device_id, device_info, upload, download, timestamp=None):
        """Update device data history for ML analysis"""
        if timestamp is None:
            timestamp = datetime.now()
        
        # Get previous values
        prev_upload, prev_download = self.previous_bandwidth.get(device_id, (0.0, 0.0))
        
        # Calculate changes
        upload_change = upload - prev_upload
        download_change = download - prev_download
        
        # Store current values for next comparison
        self.previous_bandwidth[device_id] = (upload, download)
        
        # Extract additional metrics if available
        connection_count = device_info.get('ConnectionCount', 0)
        active_time = device_info.get('ActiveTime', 0)
        
        # Create feature dict
        data_point = {
            'upload': upload,
            'download': download,
            'upload_change': upload_change,
            'download_change': download_change,
            'hour_of_day': timestamp.hour,
            'day_of_week': timestamp.weekday(),
            'timestamp': timestamp,
            'connection_count': connection_count,
            'active_time': active_time
        }
        
        # Add to device history
        self.device_data[device_id].append(data_point)
        
        # Limit history size to prevent memory issues
        if len(self.device_data[device_id]) > self.max_history_per_device:
            self.device_data[device_id] = self.device_data[device_id][-self.max_history_per_device:]
        
        # Calculate rolling statistics if we have enough data
        if len(self.device_data[device_id]) >= 5:
            recent_data = pd.DataFrame(self.device_data[device_id][-5:])
            data_point['upload_rolling_mean'] = recent_data['upload'].mean()
            data_point['download_rolling_mean'] = recent_data['download'].mean()
            data_point['upload_rolling_std'] = recent_data['upload'].std() if len(recent_data) > 1 else 0
            data_point['download_rolling_std'] = recent_data['download'].std() if len(recent_data) > 1 else 0
        else:
            data_point['upload_rolling_mean'] = upload
            data_point['download_rolling_mean'] = download
            data_point['upload_rolling_std'] = 0
            data_point['download_rolling_std'] = 0
        
        return data_point
    
    def check_notification_cooldown(self, device_id, anomaly_type):
        """Check if notification is in cooldown period"""
        cooldown_key = f"{device_id}_{anomaly_type}"
        current_time = time.time()
        
        if cooldown_key in self.notification_cooldown:
            last_notification = self.notification_cooldown[cooldown_key]
            if current_time - last_notification < self.cooldown_period:
                return False  # Still in cooldown
        
        # Update cooldown timestamp
        self.notification_cooldown[cooldown_key] = current_time
        return True  # Not in cooldown
    
    def process_data(self, devices_data):
        """Process the fetched data and update the database"""
        if not devices_data:
            return False
        
        try:
            successful_updates = 0
            notification_sent = False
            
            for device in devices_data:
                device_id = self.device_manager.insert_or_update_device(device)
                
                if not device_id:
                    continue
                
                # Convert string values to float, handling possible conversion errors
                try:
                    upload = float(device.get('UpRate', 0))
                    download = float(device.get('DownRate', 0))
                except (ValueError, TypeError) as e:
                    logging.warning(f"Error converting bandwidth values for device {device_id}: {e}")
                    upload, download = 0.0, 0.0
                
                # Update device history with current data point
                data_point = self.update_device_history(device_id, device, upload, download)
                
                # AI-based anomaly detection
                is_anomaly, anomaly_info = self.ml_manager.detect_anomaly(device_id, data_point)
                
                # If anomaly detected, add notification
                if is_anomaly and anomaly_info:
                    anomaly_type = anomaly_info['type']
                    description = anomaly_info['description']
                    severity = anomaly_info['severity']
                    
                    # Check if notification is in cooldown
                    if self.check_notification_cooldown(device_id, anomaly_type):
                        device_info = f"{device.get('HostName', 'Unknown')} ({device.get('IPAddress', 'Unknown IP')})"
                        remarks = f"{description} for {device_info}"
                        
                        # Map severity string to numeric level
                        severity_level = self.alert_levels.get(severity, 1)
                        
                        notification_result = self.device_manager.add_notification(
                            device_id, anomaly_type, severity_level, remarks
                        )
                        if notification_result:
                            notification_sent = True
                            
                # Update bandwidth in database
                if self.device_manager.update_bandwidth(device_id, upload, download):
                    successful_updates += 1
            
            # Commit all changes
            self.db_manager.commit()
            
            if successful_updates > 0:
                logging.info(f"Successfully processed data for {successful_updates} devices")
            if notification_sent:
                logging.info("One or more anomaly notifications were sent")
            
            return True
            
        except Exception as e:
            logging.error(f"Unexpected error during processing: {e}")
            return False
    
    def run(self):
        """Run the AI network monitor with adaptive polling interval"""
        logging.info(f"Starting AI Network Monitor ({self.poll_interval}-second interval)")
        
        try:
            while True:
                start_time = time.time()
                
                try:
                    devices_data = self.api_manager.fetch_device_data()
                    
                    if devices_data:
                        self.process_data(devices_data)
                    else:
                        logging.warning("No device data received from API")
                    
                    # Calculate time spent and sleep for the remaining time
                    elapsed_time = time.time() - start_time
                    sleep_time = max(0, self.poll_interval - elapsed_time)
                    
                    if sleep_time > 0:
                        time.sleep(sleep_time)
                    elif elapsed_time > self.poll_interval * 1.5:
                        # If processing consistently takes longer than poll interval, adjust it
                        self.poll_interval = min(5, self.poll_interval + 0.5)
                        logging.warning(f"Processing took {elapsed_time:.3f} seconds, exceeding poll interval. Adjusted to {self.poll_interval}s")
                
                except Exception as e:
                    logging.error(f"Error in monitoring cycle: {e}")
                    time.sleep(1)
                    self.consecutive_errors += 1
                    
                # If too many consecutive errors, increase poll interval
                if self.consecutive_errors >= self.max_consecutive_errors:
                    old_interval = self.poll_interval
                    self.poll_interval = min(10, self.poll_interval * 1.5)
                    logging.warning(f"Too many consecutive errors. Increasing poll interval from {old_interval:.1f}s to {self.poll_interval:.1f}s")
                    self.consecutive_errors = 0

        except Exception as e:
            logging.error(f"Naunsa naman ka")
            time.sleep(1)
            self.consecutive_errors += 1
        
# Scheduler for automated tasks
class ScheduleManager:
    """Manages scheduled tasks for the monitoring system"""
    
    def __init__(self, network_monitor):
        self.monitor = network_monitor
        self.ml_manager = network_monitor.ml_manager
    
    def setup_schedules(self):
        """Set up all scheduled tasks"""
        # Retrain all models daily at 3 AM
        schedule.every().day.at("03:00").do(self.retrain_all_models)
        
        # Clean up old data weekly
        schedule.every().sunday.at("04:00").do(self.cleanup_old_data)
        
        # Generate weekly reports
        schedule.every().monday.at("07:00").do(self.generate_weekly_report)
        
        # Check system health hourly
        schedule.every().hour.do(self.health_check)
        
        logging.info("Schedule manager initialized with all tasks")
    
    def retrain_all_models(self):
        """Retrain all device models"""
        try:
            logging.info("Starting scheduled retraining of all models")
            # Get all devices from database
            query = "SELECT id FROM networks WHERE status = 'Active'"
            devices = self.monitor.db_manager.fetch_all(query)
            
            if not devices:
                logging.info("No active devices found for model retraining")
                return
            
            for device_id, in devices:
                threading.Thread(
                    target=self.ml_manager.train_model,
                    args=(device_id,),
                    name=f"retrain_model_{device_id}"
                ).start()
                
            logging.info(f"Scheduled retraining initiated for {len(devices)} devices")
            return True
        except Exception as e:
            logging.error(f"Error in scheduled model retraining: {e}")
            return False
    
    def cleanup_old_data(self):
        """Clean up old data to prevent database bloat"""
        try:
            logging.info("Starting scheduled cleanup of old data")
            
            # Delete bandwidth data older than 90 days
            query = "DELETE FROM bandwidth WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
            result = self.monitor.db_manager.execute_and_commit(query)
            
            # Delete notifications older than 180 days
            query = "DELETE FROM notification WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)"
            result2 = self.monitor.db_manager.execute_and_commit(query)
            
            logging.info("Database cleanup completed")
            return True
        except Exception as e:
            logging.error(f"Error in scheduled data cleanup: {e}")
            return False
    
    def generate_weekly_report(self):
        """Generate weekly network usage and anomaly report"""
        try:
            logging.info("Generating weekly network report")
            
            end_date = datetime.now()
            start_date = end_date - pd.Timedelta(days=7)
            
            # Get total bandwidth usage per device
            query = """
            SELECT n.hostname, n.ip_address, 
                   SUM(b.upload) as total_upload,
                   SUM(b.download) as total_download,
                   COUNT(*) as data_points
            FROM networks n
            JOIN bandwidth b ON n.id = b.device_id
            WHERE b.created_at BETWEEN %s AND %s
            GROUP BY n.id
            ORDER BY total_download DESC
            """
            
            bandwidth_results = self.monitor.db_manager.fetch_all(
                query, (start_date, end_date)
            )
            
            # Get anomaly counts
            query = """
            SELECT n.hostname, n.ip_address,
                   COUNT(*) as anomaly_count,
                   MAX(nt.created_at) as last_anomaly
            FROM networks n
            JOIN notification nt ON n.id = nt.device_id
            WHERE nt.created_at BETWEEN %s AND %s
            GROUP BY n.id
            ORDER BY anomaly_count DESC
            """
            
            anomaly_results = self.monitor.db_manager.fetch_all(
                query, (start_date, end_date)
            )
            
            # Format and save report
            report_file = f"network_report_{start_date.strftime('%Y%m%d')}.txt"
            
            with open(report_file, 'w') as f:
                f.write(f"Network Traffic Report: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}\n")
                f.write("="*80 + "\n\n")
                
                f.write("BANDWIDTH USAGE SUMMARY\n")
                f.write("-"*80 + "\n")
                if bandwidth_results:
                    for hostname, ip, upload, download, points in bandwidth_results:
                        f.write(f"{hostname} ({ip}):\n")
                        f.write(f"  Upload: {upload/1024/1024:.2f} MB\n")
                        f.write(f"  Download: {download/1024/1024:.2f} MB\n")
                        f.write(f"  Total: {(upload+download)/1024/1024:.2f} MB\n")
                        f.write("\n")
                else:
                    f.write("No bandwidth data available for this period\n\n")
                
                f.write("\nANOMALY SUMMARY\n")
                f.write("-"*80 + "\n")
                if anomaly_results:
                    for hostname, ip, count, last_date in anomaly_results:
                        f.write(f"{hostname} ({ip}):\n")
                        f.write(f"  Anomalies detected: {count}\n")
                        f.write(f"  Last anomaly: {last_date}\n")
                        f.write("\n")
                else:
                    f.write("No anomalies detected in this period\n\n")
            
            logging.info(f"Weekly report generated and saved to {report_file}")
            return True
        except Exception as e:
            logging.error(f"Error generating weekly report: {e}")
            return False
    
    def health_check(self):
        """Check system health and log status"""
        try:
            logging.info("Performing system health check")
            
            # Check database connection
            db_status = self.monitor.db_manager.connect()
            
            # Check API connection
            api_data = self.monitor.api_manager.fetch_device_data()
            api_status = api_data is not None
            
            # Check model status
            models_count = len(self.ml_manager.models)
            
            # Log system status
            logging.info(f"Health Check: Database {'✓' if db_status else '✗'}, " +
                         f"API {'✓' if api_status else '✗'}, " +
                         f"Active Models: {models_count}")
            
            # If any critical service is down, send alert
            if not db_status or not api_status:
                self.alert_system_issue(db_status, api_status)
            
            return True
        except Exception as e:
            logging.error(f"Error in system health check: {e}")
            return False
    
    def alert_system_issue(self, db_status, api_status):
        """Send alert about system issues"""
        issues = []
        if not db_status:
            issues.append("Database connection failure")
        if not api_status:
            issues.append("API endpoint unreachable")
        
        message = "SYSTEM ALERT: " + ", ".join(issues)
        logging.critical(message)
        
        # Log critical alert to notification table
        try:
            if self.monitor.db_manager.connect():
                query = """
                INSERT INTO notification (device_id, types, remarks) 
                VALUES (%s, %s, %s)
                """
                # Use device_id 0 for system alerts (adjust if needed)
                self.monitor.db_manager.execute_and_commit(
                    query, (0, "system_alert", f"[HIGH] {message}")
                )
        except Exception as e:
            logging.error(f"Failed to log system alert to database: {e}")


# Main execution functions
def run_scheduler():
    """Run the scheduler in a background thread"""
    logging.info("Starting scheduler thread")
    while True:
        schedule.run_pending()
        time.sleep(1)


def start_monitoring(config=None):
    """Start the monitoring system with the given configuration"""
    # Use provided config or default
    monitoring_config = config or CONFIG
    
    # Initialize the monitor
    monitor = AINetworkMonitor(monitoring_config)
    
    # Initialize scheduler
    scheduler = ScheduleManager(monitor)
    scheduler.setup_schedules()
    
    # Start scheduler in background thread
    scheduler_thread = threading.Thread(
        target=run_scheduler,
        daemon=True,
        name="scheduler_thread"
    )
    scheduler_thread.start()
    
    # Start the main monitoring
    try:
        logging.info("Starting AI Network Monitor")
        monitor.run()
    except KeyboardInterrupt:
        logging.info("Shutting down AI Network Monitor")
    finally:
        logging.info("AI Network Monitor stopped")


if __name__ == "__main__":
    start_monitoring()