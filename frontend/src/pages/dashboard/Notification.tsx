import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../../components/Sidebar';
import { Bell, AlertTriangle, DownloadCloud, UploadCloud, RefreshCw, Filter, Info } from 'lucide-react';

// Main Notification component
const Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total_count: 0,
    upload_count: 0,
    download_count: 0
  });

  // Function to fetch notifications data
  const fetchNotifications = async (filter = 'all') => {
    setRefreshing(true);
    setLoading(true);
    try {
      let response;
      
      if (filter === 'all') {
        response = await axios.get('http://localhost:8005/api/notifications', {
          params: { limit: 100 }
        });
        setNotifications(response.data);
        
        // Calculate stats from the data
        const uploadCount = response.data.filter(n => n.types === 'upload_spike').length;
        const downloadCount = response.data.filter(n => n.types === 'download_spike').length;
        
        setStats({
          total_count: response.data.length,
          upload_count: uploadCount,
          download_count: downloadCount
        });
      } else {
        response = await axios.get(`http://localhost:8005/api/notifications/types/${filter}`, {
          params: { limit: 100 }
        });
        setNotifications(response.data);
      }
      
      setActiveFilter(filter);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications. Please try again later.");
    } finally {
      setLoading(false);
      // Add a slight delay before removing the refresh animation
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Function to fetch notification details
  const fetchNotificationDetails = async (id) => {
    try {
      const response = await axios.get(`http://localhost:8005/api/notifications/${id}`);
      setSelectedNotification(response.data);
    } catch (err) {
      console.error("Error fetching notification details:", err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchNotifications('all');
  }, []);

  // Function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Function to determine notification icon
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'upload_spike':
        return <UploadCloud className="text-orange-500" size={20} />;
      case 'download_spike':
        return <DownloadCloud className="text-blue-500" size={20} />;
      default:
        return <AlertTriangle className="text-yellow-500" size={20} />;
    }
  };

  // Function to get notification type label with styling
  const getTypeLabel = (type) => {
    switch (type) {
      case 'upload_spike':
        return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium">Upload Spike</span>;
      case 'download_spike':
        return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">Download Spike</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">{type}</span>;
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="w-full overflow-hidden">
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800 flex items-center">
                <Bell className="mr-2" size={24} /> Notification Center
              </h1>
              <p className="text-gray-600">Monitor network alerts and activity notifications</p>
            </div>
            <button 
              onClick={() => fetchNotifications(activeFilter)}
              className="flex items-center bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} size={16} />
              Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <h3 className="text-gray-500 text-sm font-medium">Total Notifications</h3>
              <p className="text-2xl font-semibold">{stats.total_count}</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <h3 className="text-gray-500 text-sm font-medium flex items-center">
                <UploadCloud size={16} className="mr-1 text-orange-500" />
                Upload Spikes
              </h3>
              <p className="text-2xl font-semibold">{stats.upload_count}</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <h3 className="text-gray-500 text-sm font-medium flex items-center">
                <DownloadCloud size={16} className="mr-1 text-blue-500" />
                Download Spikes
              </h3>
              <p className="text-2xl font-semibold">{stats.download_count}</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm mb-6 border border-gray-200 inline-flex">
            <button 
              className={`px-4 py-2 rounded-md flex items-center ${activeFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              onClick={() => fetchNotifications('all')}
            >
              <Filter size={16} className="mr-1" /> All
            </button>
            <button 
              className={`px-4 py-2 rounded-md flex items-center ${activeFilter === 'upload_spike' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              onClick={() => fetchNotifications('upload_spike')}
            >
              <UploadCloud size={16} className="mr-1" /> Upload Spikes
            </button>
            <button 
              className={`px-4 py-2 rounded-md flex items-center ${activeFilter === 'download_spike' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              onClick={() => fetchNotifications('download_spike')}
            >
              <DownloadCloud size={16} className="mr-1" /> Download Spikes
            </button>
          </div>

          {/* Main content area - split into two columns when there's a selected notification */}
          <div className="flex flex-1 gap-6 overflow-hidden">
            {/* Notifications List */}
            <div className={`${selectedNotification ? 'w-1/2' : 'w-full'} bg-white rounded-lg shadow overflow-hidden border border-gray-200`}>
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 className="font-medium text-gray-700">
                  {activeFilter === 'all' ? 'All Notifications' : 
                   activeFilter === 'upload_spike' ? 'Upload Spike Notifications' : 
                   'Download Spike Notifications'}
                </h2>
                <span className="text-sm text-gray-500">{notifications.length} results</span>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  <AlertTriangle className="mx-auto mb-2" size={24} />
                  {error}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="mx-auto mb-2" size={24} />
                  No notifications found
                </div>
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  {notifications.map((notification) => (
                    <div 
                      key={notification.noti_id}
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${selectedNotification?.noti_id === notification.noti_id ? 'bg-blue-50' : ''}`}
                      onClick={() => fetchNotificationDetails(notification.noti_id)}
                    >
                      <div className="flex items-start">
                        <div className="mr-3 mt-1">
                          {getNotificationIcon(notification.types)}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h3 className="font-medium text-gray-800 mb-1">
                              {notification.hostname || `Device ID: ${notification.device_id}`}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {formatDate(notification.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notification.remarks}</p>
                          <div className="flex justify-between items-center">
                            {getTypeLabel(notification.types)}
                            <span className="text-xs text-gray-500">{notification.ip_address}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Details */}
            {selectedNotification && (
              <div className="w-1/2 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h2 className="font-medium text-gray-700">Notification Details</h2>
                  <button 
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => setSelectedNotification(null)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6">
                  <div className="mb-6 flex items-center">
                    <div className="h-12 w-12 flex items-center justify-center rounded-full bg-gray-100 mr-4">
                      {selectedNotification.types === 'upload_spike' ? 
                        <UploadCloud size={24} className="text-orange-500" /> : 
                        <DownloadCloud size={24} className="text-blue-500" />
                      }
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-800">
                        {selectedNotification.hostname || `Device ID: ${selectedNotification.device_id}`}
                      </h3>
                      <p className="text-sm text-gray-600">{selectedNotification.ip_address}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                      <Info size={16} className="mr-1" /> Alert Information
                    </h4>
                    <p className="text-gray-800">{selectedNotification.remarks}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Alert Type</h4>
                      <div>{getTypeLabel(selectedNotification.types)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Device ID</h4>
                      <p className="font-medium">{selectedNotification.device_id}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Created At</h4>
                      <p className="font-medium">{formatDate(selectedNotification.created_at)}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Notification ID</h4>
                      <p className="font-medium">{selectedNotification.noti_id}</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <button 
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-md"
                      onClick={() => window.location.href = `/devices/${selectedNotification.device_id}`}
                    >
                      View Device Details
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notification;