import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../../components/Sidebar';
import { 
  Bell, 
  AlertTriangle, 
  DownloadCloud, 
  UploadCloud, 
  RefreshCw, 
  Filter, 
  Info, 
  Activity,
  Clock,
  Zap,
  AlertCircle,
  Cpu,
  Check,
  Search,
  ChevronDown,
  Calendar,
  X
} from 'lucide-react';

// Severity Badge component for visual classification
const SeverityBadge = ({ remarks }) => {
  // Extract severity from remarks based on bandwidth thresholds
  const getSeverity = () => {
    // Extract bandwidth value if present
    const extractBandwidth = () => {
      const kbMatch = remarks.match(/(\d+(\.\d+)?)\s*KB\/s/);
      if (kbMatch) return parseFloat(kbMatch[1]);
      
      const bMatch = remarks.match(/(\d+(\.\d+)?)\s*B\/s/);
      if (bMatch) return parseFloat(bMatch[1]) / 1024;
      
      return null;
    };
    
    const bandwidth = extractBandwidth();
    
    // Determine severity by bandwidth if available
    if (bandwidth !== null) {
      if (bandwidth >= 50) return 'critical';
      if (bandwidth >= 10) return 'high';
      if (bandwidth >= 5) return 'medium';
      return 'low';
    }
    
    // Fallback to keyword checking
    if (remarks.includes('[CRITICAL]') || remarks.includes('critical')) return 'critical';
    if (remarks.includes('[HIGH]') || remarks.includes('high bandwidth')) return 'high';
    if (remarks.includes('[MEDIUM]') || remarks.includes('medium')) return 'medium';
    return 'low';
  };

  const severity = getSeverity();
  
  // Map severity to visual styles
  const severityStyles = {
    critical: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'EXTREMELY HIGH',
      icon: <Zap size={12} className="mr-1" />
    },
    high: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      label: 'HIGH',
      icon: <AlertCircle size={12} className="mr-1" />
    },
    medium: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: 'MEDIUM',
      icon: <AlertTriangle size={12} className="mr-1" />
    },
    low: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'LOW',
      icon: <Info size={12} className="mr-1" />
    }
  };

  const { bg, text, label, icon } = severityStyles[severity];

  return (
    <span className={`${bg} ${text} px-2 py-1 rounded-full text-xs font-medium flex items-center`}>
      {icon} {label}
    </span>
  );
};

// Type badge component with enhanced styling
const TypeBadge = ({ type }) => {
  // Map notification types to icons and styles
  const typeMap = {
    'upload_spike': {
      icon: <UploadCloud size={12} className="mr-1" />,
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      label: 'Upload Spike'
    },
    'download_spike': {
      icon: <DownloadCloud size={12} className="mr-1" />,
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Download Spike'
    },
    'high_bandwidth_usage': {
      icon: <Activity size={12} className="mr-1" />,
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      label: 'High Bandwidth'
    },
    'upload_4_6kb_range': {
      icon: <UploadCloud size={12} className="mr-1" />,
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: '4-6KB Upload'
    },
    'download_4_6kb_range': {
      icon: <DownloadCloud size={12} className="mr-1" />,
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: '4-6KB Download'
    }
  };

  // Handle any type, fallback to default styling
  const { icon, bg, text, label } = typeMap[type] || {
    icon: <Info size={12} className="mr-1" />,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: type.replace(/_/g, ' ')
  };

  return (
    <span className={`${bg} ${text} px-2 py-1 rounded-full text-xs font-medium flex items-center`}>
      {icon} {label}
    </span>
  );
};

// Relative time component for more user-friendly timestamps
const RelativeTime = ({ timestamp }) => {
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  const formatFullDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <span className="text-xs text-gray-500 flex items-center" title={formatFullDate(timestamp)}>
      <Clock size={12} className="mr-1" />
      {formatTimeAgo(timestamp)}
    </span>
  );
};

// Bandwidth visualization component
const BandwidthVisual = ({ remarks }) => {
  // Extract bandwidth values from remarks if available
  const extractBandwidth = () => {
    // Look for patterns like "5.00 KB/s" or similar
    const kbMatch = remarks.match(/(\d+(\.\d+)?)\s*KB\/s/);
    if (kbMatch) return parseFloat(kbMatch[1]);
    
    // Look for patterns like "500 B/s" or similar
    const bMatch = remarks.match(/(\d+(\.\d+)?)\s*B\/s/);
    if (bMatch) return parseFloat(bMatch[1]) / 1024; // Convert B/s to KB/s
    
    // If no match found but contains certain keywords, assign estimated values
    if (remarks.includes('high bandwidth')) return 15;
    if (remarks.includes('critical')) return 55;
    if (remarks.includes('medium')) return 7;
    if (remarks.includes('spike')) return 8;
    
    // Default fallback
    return 2;
  };

  const bandwidth = extractBandwidth();
  
  // Determine scale - maximum width percentage
  const maxWidth = 100;
  // Adjust scale to make visual differences more apparent
  const getScaledWidth = () => {
    if (bandwidth >= 50) return maxWidth; // Cap at 100% for extremely high
    if (bandwidth >= 10) return 60 + (bandwidth - 10) * 0.8; // High range: 60-92%
    if (bandwidth >= 5) return 30 + (bandwidth - 5) * 6; // Medium range: 30-60%
    return bandwidth * 6; // Low range: 0-30%
  };
  
  const width = getScaledWidth();
  
  // Map bandwidth ranges to appropriate colors
  const getBarColor = () => {
    if (bandwidth >= 50) return 'bg-red-600'; // Extremely high
    if (bandwidth >= 10) return 'bg-red-500'; // High
    if (bandwidth >= 5) return 'bg-orange-500'; // Medium
    return 'bg-blue-500'; // Low
  };

  // Get appropriate label for the bandwidth range
  const getSeverityLabel = () => {
    if (bandwidth >= 50) return 'Extremely High';
    if (bandwidth >= 10) return 'High';
    if (bandwidth >= 5) return 'Medium';
    return 'Low';
  };

  return (
    <div className="mt-2">
      <div className="text-xs text-gray-600 mb-1 flex justify-between">
        <span className="font-medium">{bandwidth.toFixed(2)} KB/s</span>
        <span className={`
          ${bandwidth >= 50 ? 'text-red-600' : 
            bandwidth >= 10 ? 'text-red-500' : 
            bandwidth >= 5 ? 'text-orange-500' : 'text-blue-500'} 
          font-medium`}
        >{getSeverityLabel()} {remarks.includes('upload') ? 'Upload' : 'Download'}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div 
          className={`${getBarColor()} h-2 rounded-full transition-all duration-500 ease-in-out`} 
          style={{ width: `${width}%` }}
        ></div>
      </div>
    </div>
  );
};

// Dropdown Filter Component
const DropdownFilter = ({ title, options, activeOption, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {title}: <span className="font-medium ml-1 mr-2">{activeOption}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-1">
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded ${
                  activeOption === option.label ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  {option.icon}
                  <span className="ml-2">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Search component with animation
const SearchBar = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleChange = (e) => {
    setSearchTerm(e.target.value);
    onSearch(e.target.value);
  };
  
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search notifications..."
        value={searchTerm}
        onChange={handleChange}
        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 w-full transition-all duration-200"
      />
      <Search size={16} className="absolute left-3 top-3 text-gray-400" />
    </div>
  );
};

// Main Notification component
const Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [stats, setStats] = useState({
    total_count: 0,
    upload_count: 0,
    download_count: 0,
    critical_count: 0,
    high_count: 0
  });

  // Date filter options
  const dateFilterOptions = [
    { value: 'all', label: 'All Time', icon: <Calendar size={16} /> },
    { value: 'today', label: 'Today', icon: <Calendar size={16} /> },
    { value: 'week', label: 'Last 7 Days', icon: <Calendar size={16} /> }
  ];

  // Type filter options
  const typeFilterOptions = [
    { value: 'all', label: 'All Types', icon: <Filter size={16} /> },
    { value: 'upload_spike', label: 'Upload Spikes', icon: <UploadCloud size={16} className="text-orange-500" /> },
    { value: 'download_spike', label: 'Download Spikes', icon: <DownloadCloud size={16} className="text-blue-500" /> }
  ];

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
        setFilteredNotifications(response.data);
        
        // Calculate stats from the data
        const uploadCount = response.data.filter(n => n.types.includes('upload')).length;
        const downloadCount = response.data.filter(n => n.types.includes('download')).length;
        const criticalCount = response.data.filter(n => 
          n.remarks.includes('[CRITICAL]') || n.remarks.includes('critical')
        ).length;
        const highCount = response.data.filter(n => 
          n.remarks.includes('[HIGH]') || 
          (n.remarks.includes('high') && !n.remarks.includes('critical'))
        ).length;
        
        setStats({
          total_count: response.data.length,
          upload_count: uploadCount,
          download_count: downloadCount,
          critical_count: criticalCount,
          high_count: highCount
        });
      } else {
        response = await axios.get(`http://localhost:8005/api/notifications/types/${filter}`, {
          params: { limit: 100 }
        });
        setNotifications(response.data);
        setFilteredNotifications(response.data);
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

  // Search functionality
  const handleSearch = (term) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredNotifications(notifications);
      return;
    }
    
    const filtered = notifications.filter(notification => 
      notification.hostname?.toLowerCase().includes(term.toLowerCase()) ||
      notification.ip_address?.toLowerCase().includes(term.toLowerCase()) ||
      notification.remarks?.toLowerCase().includes(term.toLowerCase()) ||
      notification.types?.toLowerCase().includes(term.toLowerCase())
    );
    
    setFilteredNotifications(filtered);
  };

  // Date filtering options
  const handleDateFilter = (filter) => {
    setDateFilter(filter);
    
    const now = new Date();
    let filteredResults = [...notifications];
    
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filteredResults = notifications.filter(n => new Date(n.created_at) >= today);
    } else if (filter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredResults = notifications.filter(n => new Date(n.created_at) >= weekAgo);
    }
    
    setFilteredNotifications(filteredResults);
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
  const getNotificationIcon = (type, remarks) => {
    // Check both type and remarks to determine the most appropriate icon
    
    // Check for critical alerts
    if (remarks && (remarks.includes('[CRITICAL]') || remarks.includes('critical'))) {
      return <Zap className="text-red-500" size={20} />;
    }
    
    // Check for high alerts
    if (remarks && (remarks.includes('[HIGH]') || remarks.includes('high bandwidth'))) {
      return <AlertCircle className="text-orange-500" size={20} />;
    }
    
    // Type-based icons
    if (type.includes('upload')) {
      return <UploadCloud className="text-blue-500" size={20} />;
    }
    
    if (type.includes('download')) {
      return <DownloadCloud className="text-purple-500" size={20} />;
    }
    
    // Default
    return <AlertTriangle className="text-yellow-500" size={20} />;
  };

  // Extract clean remarks (remove severity markers)
  const cleanRemarks = (remarks) => {
    return remarks
      .replace(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*/, '')
      .replace(/^(Critical|High|Medium|Low)/, '');
  };

  // Function to extract probable cause if available
  const extractProbableCause = (remarks) => {
    if (remarks.includes("Probable cause:")) {
      return remarks.split("Probable cause:")[1].trim();
    }
    return null;
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
                <Bell className="mr-2 text-indigo-600" size={24} /> Network Notification Center
              </h1>
              <p className="text-gray-600">Advanced monitoring for network traffic anomalies and bandwidth spikes</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => fetchNotifications(activeFilter)}
                className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <RefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} size={16} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
              <div className="bg-indigo-100 p-3 rounded-full mr-3">
                <Bell className="text-indigo-600" size={20} />
              </div>
              <div>
                <h3 className="text-gray-500 text-xs font-medium">Total</h3>
                <p className="text-2xl font-semibold">{stats.total_count}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
              <div className="bg-red-100 p-3 rounded-full mr-3">
                <Zap className="text-red-600" size={20} />
              </div>
              <div>
                <h3 className="text-gray-500 text-xs font-medium">Critical</h3>
                <p className="text-2xl font-semibold">{stats.critical_count}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
              <div className="bg-orange-100 p-3 rounded-full mr-3">
                <AlertCircle className="text-orange-600" size={20} />
              </div>
              <div>
                <h3 className="text-gray-500 text-xs font-medium">High</h3>
                <p className="text-2xl font-semibold">{stats.high_count}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
              <div className="bg-blue-100 p-3 rounded-full mr-3">
                <UploadCloud className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="text-gray-500 text-xs font-medium">Upload</h3>
                <p className="text-2xl font-semibold">{stats.upload_count}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center">
              <div className="bg-purple-100 p-3 rounded-full mr-3">
                <DownloadCloud className="text-purple-600" size={20} />
              </div>
              <div>
                <h3 className="text-gray-500 text-xs font-medium">Download</h3>
                <p className="text-2xl font-semibold">{stats.download_count}</p>
              </div>
            </div>
          </div>

          {/* Filters and Search Row */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 inline-flex">
              <button 
                className={`px-4 py-2 rounded-md flex items-center ${activeFilter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => fetchNotifications('all')}
              >
                <Filter size={16} className="mr-1" /> All
              </button>
              <button 
                className={`px-4 py-2 rounded-md flex items-center ${activeFilter === 'upload_spike' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => fetchNotifications('upload_spike')}
              >
                <UploadCloud size={16} className="mr-1" /> Upload Spikes
              </button>
              <button 
                className={`px-4 py-2 rounded-md flex items-center ${activeFilter === 'download_spike' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => fetchNotifications('download_spike')}
              >
                <DownloadCloud size={16} className="mr-1" /> Download Spikes
              </button>
            </div>
            
            <DropdownFilter 
              title="Date"
              options={dateFilterOptions}
              activeOption={dateFilterOptions.find(opt => opt.value === dateFilter)?.label}
              onChange={handleDateFilter}
            />
            
            <div className="ml-auto flex-grow max-w-md">
              <SearchBar onSearch={handleSearch} />
            </div>
          </div>

          {/* Main content area - split into two columns when there's a selected notification */}
          <div className="flex flex-1 gap-6 overflow-hidden">
            {/* Notifications List */}
            <div className={`${selectedNotification ? 'w-1/2' : 'w-full'} bg-white rounded-lg shadow overflow-hidden border border-gray-200 transition-all duration-300`}>
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 className="font-medium text-gray-700 flex items-center">
                  <Activity size={18} className="mr-2 text-indigo-600" />
                  {activeFilter === 'all' ? 'All Notifications' : 
                   activeFilter === 'upload_spike' ? 'Upload Spike Notifications' : 
                   'Download Spike Notifications'}
                </h2>
                <span className="text-sm text-gray-500">{filteredNotifications.length} results</span>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  <AlertTriangle className="mx-auto mb-2" size={24} />
                  {error}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="mx-auto mb-2" size={24} />
                  No notifications found
                </div>
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  {filteredNotifications.map((notification) => (
                    <div 
                      key={notification.noti_id}
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${selectedNotification?.noti_id === notification.noti_id ? 'bg-indigo-50' : ''}`}
                      onClick={() => fetchNotificationDetails(notification.noti_id)}
                    >
                      <div className="flex items-start">
                        <div className="mr-3 mt-1">
                          {getNotificationIcon(notification.types, notification.remarks)}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h3 className="font-medium text-gray-800 mb-1 flex items-center">
                              {notification.hostname || `Device ID: ${notification.device_id}`}
                              {notification.remarks && notification.remarks.includes('[CRITICAL]') && 
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Critical
                                </span>
                              }
                            </h3>
                            <RelativeTime timestamp={notification.created_at} />
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {cleanRemarks(notification.remarks || '')}
                          </p>
                          
                          {/* Bandwidth visualization */}
                          <BandwidthVisual remarks={notification.remarks || ''} />
                          
                          <div className="flex justify-between items-center mt-3">
                            <div className="flex items-center space-x-2">
                              <TypeBadge type={notification.types} />
                              <SeverityBadge remarks={notification.remarks || ''} />
                            </div>
                            <span className="text-xs text-gray-500">{notification.ip_address}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Empty state message when no notifications are selected */}
              {!selectedNotification && !loading && filteredNotifications.length > 0 && (
                <div className="fixed bottom-6 right-6 bg-indigo-600 text-white p-3 rounded-full shadow-lg cursor-pointer animate-bounce" title="Select a notification to view details">
                  <Info size={24} />
                </div>
              )}
            </div>

            {/* Notification Details Panel */}
            {selectedNotification && (
              <div className="w-1/2 bg-white rounded-lg shadow border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h2 className="font-medium text-gray-700 flex items-center">
                    <Info className="mr-2 text-indigo-600" size={18} /> 
                    Notification Details
                  </h2>
                  <button 
                    className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100"
                    onClick={() => setSelectedNotification(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="p-6">
                  {/* Device header with icon based on severity */}
                  <div className="mb-6 flex items-center">
                    <div className={`h-16 w-16 flex items-center justify-center rounded-full 
                      ${selectedNotification.remarks?.includes('[CRITICAL]') ? 'bg-red-100' : 
                        selectedNotification.remarks?.includes('high') ? 'bg-orange-100' : 
                        'bg-blue-100'}`}>
                      {getNotificationIcon(selectedNotification.types, selectedNotification.remarks)}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-800">
                        {selectedNotification.hostname || `Device ID: ${selectedNotification.device_id}`}
                      </h3>
                      <div className="flex items-center mt-1">
                        <span className="text-sm text-gray-600 mr-3">{selectedNotification.ip_address}</span>
                        <TypeBadge type={selectedNotification.types} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Bandwidth visualization (larger version) */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center">
                      <Activity size={16} className="mr-1" /> Bandwidth Information
                    </h4>
                    <div className="mb-4">
                      <BandwidthVisual remarks={selectedNotification.remarks || ''} />
                    </div>
                    <p className="text-gray-800 mt-3">{cleanRemarks(selectedNotification.remarks || '')}</p>
                  </div>
                  
                  {/* Alert details grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Severity</h4>
                      <div><SeverityBadge remarks={selectedNotification.remarks || ''} /></div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Alert Type</h4>
                      <div><TypeBadge type={selectedNotification.types} /></div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Device ID</h4>
                      <p className="font-medium">{selectedNotification.device_id}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-xs text-gray-500 mb-1">Created At</h4>
                      <p className="font-medium">{formatDate(selectedNotification.created_at)}</p>
                    </div>
                  </div>
                  
                  {/* Probable cause section - if available in remarks */}
                  {extractProbableCause(selectedNotification.remarks || '') && (
                    <div className="mt-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <h4 className="text-sm font-medium text-indigo-700 mb-2 flex items-center">
                        <Info size={16} className="mr-1" /> Probable Cause
                      </h4>
                      <p className="text-gray-800">
                        {extractProbableCause(selectedNotification.remarks || '')}
                      </p>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="mt-6 flex justify-between">
                    <button 
                      className="bg-gray-100 text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-md flex items-center transition-colors"
                    >
                      <Check className="mr-1" size={16} />
                      Mark as Resolved
                    </button>
                    
                    <button 
                      className="bg-indigo-100 text-indigo-600 hover:bg-indigo-200 px-4 py-2 rounded-md flex items-center transition-colors"
                      onClick={() => window.location.href = `/devices/${selectedNotification.device_id}`}
                    >
                      <Cpu className="mr-1" size={16} />
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