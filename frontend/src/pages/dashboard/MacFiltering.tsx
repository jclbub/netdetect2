import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { Search, Wifi, WifiOff, RefreshCw, Shield, ShieldOff, AlertTriangle, Check, X, Settings, Signal} from "lucide-react";
import { otherFetch } from "../../hooks/otherFetch";
import axios from 'axios';

const WirelessDevices = () => {
  const [wirelessDevices, setWirelessDevices] = useState([]);
  const [blockedDevices, setBlockedDevices] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'hostname', direction: 'ascending' });
  const [blockingDevice, setBlockingDevice] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [macFilteringEnabled, setMacFilteringEnabled] = useState(true);
  const [macFilteringPolicy, setMacFilteringPolicy] = useState("allowlist");
  const [viewMode, setViewMode] = useState("all"); // "all" or "blocked"
  
  // Fetch all devices directly from our optimized API
  const fetchAllDevices = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('http://127.0.0.1:8001/all-devices');
      if (response.status === 200) {
        const processedDevices = processDevicesData(response.data.devices);
        setWirelessDevices(processedDevices);
      } else {
        throw new Error('Failed to fetch devices');
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      setActionMessage({
        type: "error",
        text: `Failed to load devices: ${error.message}`
      });
      setTimeout(() => setActionMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Process devices data from API
  const processDevicesData = (devices) => {
    return devices.map((device, index) => ({
      id: device.id || index + 1,
      hostname: device.HostName || "Unknown Device",
      mac_address: device.MACAddress || "Unknown",
      ip_address: device.IPAddress || "Unknown",
      // Use status directly from the API if available, otherwise use Active flag as fallback
      status: device.Status ? device.Status.toLowerCase() : device.Active ? "online" : "offline",
      manufacturer: device.Manufacturer || device.ActualManu || "Unknown",
      device_type: device.DeviceType || "Unknown",
      last_seen: device.LastSeen || new Date().toISOString(),
      uptime: device.Uptime || "Unknown",
      bandwidth: {
        download: device.RxKBytes || 0,
        upload: device.TxKBytes || 0
      },
      is_blocked: false, // Default to not blocked, will update when filter data arrives
      is_allowed: false, // Default to not explicitly allowed
      added_on: null // Will be updated when filter data arrives
    }));
  };

  // Fetch blocked devices directly from the API
  const fetchBlockedDevices = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8001/blocked-devices');
      if (response.status === 200) {
        // Process blocked devices data
        const processedBlockedDevices = processBlockedDevices(response.data);
        setBlockedDevices(processedBlockedDevices);
      } else {
        throw new Error('Failed to fetch blocked devices');
      }
    } catch (error) {
      console.error("Error fetching blocked devices:", error);
      setActionMessage({
        type: "error",
        text: `Failed to load blocked devices: ${error.message}`
      });
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  // Process blocked devices data from API
  const processBlockedDevices = (data) => {
    // If data is directly an array of blocked devices
    if (Array.isArray(data.blocked_devices)) {
      return data.blocked_devices.map((device, index) => ({
        id: `blocked-${index}`,
        hostname: device.HostName || "Unknown Device",
        mac_address: device.MACAddress || "Unknown",
        ip_address: device.IPAddress || "Unknown",
        // Use status directly if available, default to active/inactive based on Active flag
        status: device.Status ? device.Status.toLowerCase() : device.Active ? "online" : "offline",
        manufacturer: device.Manufacturer || device.ActualManu || "Unknown",
        device_type: device.DeviceType || "Unknown",
        last_seen: device.LastSeen || new Date().toISOString(),
        uptime: device.Uptime || "Unknown",
        bandwidth: {
          download: device.RxKBytes || 0,
          upload: device.TxKBytes || 0
        },
        is_blocked: true,
        is_allowed: false,
        added_on: device.AddedOn || null,
        band: device.Band || "All bands"
      }));
    }
    
    // Handle legacy format with bands
    let allBlockedDevices = [];
    
    // Extract blocked devices from both 2.4GHz and 5GHz bands
    if (data['2.4GHz'] && Array.isArray(data['2.4GHz'].blocked_devices)) {
      const devices24GHz = data['2.4GHz'].blocked_devices.map((device, index) => ({
        id: `blocked-${index}-24g`,
        hostname: device.HostName || "Unknown Device",
        mac_address: device.MACAddress || "Unknown",
        ip_address: device.IPAddress || "Unknown",
        status: device.Active ? "online" : "offline",
        manufacturer: device.Manufacturer || device.ActualManu || "Unknown",
        device_type: device.DeviceType || "Unknown",
        last_seen: device.LastSeen || new Date().toISOString(),
        uptime: device.Uptime || "Unknown",
        bandwidth: {
          download: device.RxKBytes || 0,
          upload: device.TxKBytes || 0
        },
        is_blocked: true,
        is_allowed: false,
        added_on: device.AddedOn || null,
        band: "2.4GHz"
      }));
      
      allBlockedDevices = [...allBlockedDevices, ...devices24GHz];
    }
    
    if (data['5GHz'] && Array.isArray(data['5GHz'].blocked_devices)) {
      const devices5GHz = data['5GHz'].blocked_devices.map((device, index) => ({
        id: `blocked-${index}-5g`,
        hostname: device.HostName || "Unknown Device",
        mac_address: device.MACAddress || "Unknown",
        ip_address: device.IPAddress || "Unknown",
        status: device.Active ? "online" : "offline",
        manufacturer: device.Manufacturer || device.ActualManu || "Unknown",
        device_type: device.DeviceType || "Unknown",
        last_seen: device.LastSeen || new Date().toISOString(),
        uptime: device.Uptime || "Unknown",
        bandwidth: {
          download: device.RxKBytes || 0,
          upload: device.TxKBytes || 0
        },
        is_blocked: true,
        is_allowed: false,
        added_on: device.AddedOn || null,
        band: "5GHz"
      }));
      
      allBlockedDevices = [...allBlockedDevices, ...devices5GHz];
    }
    
    // Remove duplicates based on MAC address
    const uniqueDevices = [];
    const seenMacs = new Set();
    
    allBlockedDevices.forEach(device => {
      if (!seenMacs.has(device.mac_address)) {
        seenMacs.add(device.mac_address);
        uniqueDevices.push(device);
      }
    });
    
    return uniqueDevices.length > 0 ? uniqueDevices : [];
  };

  // Initial data load
  useEffect(() => {
    fetchAllDevices();
    fetchBlockedDevices();
  }, []);

  // Update blocked status on wireless devices
  useEffect(() => {
    if (wirelessDevices.length > 0 && blockedDevices.length > 0) {
      // Create map of MAC addresses for quick lookup
      const blockedMacsMap = new Map();
      blockedDevices.forEach(device => {
        blockedMacsMap.set(device.mac_address.toLowerCase(), device);
      });
      
      // Update wireless devices with blocked status
      const updatedDevices = wirelessDevices.map(device => {
        const macLower = device.mac_address.toLowerCase();
        const isBlocked = blockedMacsMap.has(macLower);
        
        return {
          ...device,
          is_blocked: isBlocked,
          added_on: isBlocked ? blockedMacsMap.get(macLower).added_on : null
        };
      });
      
      setWirelessDevices(updatedDevices);
    }
  }, [blockedDevices]);

  // Filter devices based on search criteria and view mode
  useEffect(() => {
    let filtered = viewMode === "blocked" ? blockedDevices : wirelessDevices;
    
    // Apply search filter if present
    if (searchFilter) {
      filtered = filtered.filter(device =>
        (device.hostname && device.hostname.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (device.mac_address && device.mac_address.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (device.ip_address && device.ip_address.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (device.manufacturer && device.manufacturer.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (device.device_type && device.device_type.toLowerCase().includes(searchFilter.toLowerCase()))
      );
    }
    
    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredDevices(filtered);
  }, [searchFilter, wirelessDevices, blockedDevices, sortConfig, viewMode]);

  // Refresh all data
  const handleRefresh = () => {
    setIsLoading(true);
    fetchAllDevices();
    fetchBlockedDevices();
  };

  // Request to sort table
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Format bandwidth in a readable way
  const formatBandwidth = (kbytes) => {
    if (kbytes < 1024) {
      return `${kbytes} KB`;
    } else if (kbytes < 1024 * 1024) {
      return `${(kbytes / 1024).toFixed(2)} MB`;
    } else {
      return `${(kbytes / (1024 * 1024)).toFixed(2)} GB`;
    }
  };

  // Format date in a readable way
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleString();
  };

  // Render signal strength indicator
  const renderSignalStrength = (strength) => {
    // Normalize strength value (assuming it's in dBm or percentage)
    const normalized = typeof strength === 'number' ? Math.min(100, Math.max(0, strength)) : 0;
    
    // Determine color based on strength
    let color;
    if (normalized >= 70) color = "text-green-500";
    else if (normalized >= 40) color = "text-yellow-500";
    else color = "text-red-500";
    
    return (
      <div className="flex items-center">
        <Signal size={16} className={color} />
        <span className="ml-1">{normalized}%</span>
      </div>
    );
  };

  // Handle device blocking
  const handleBlockDevice = async (device) => {
    setBlockingDevice(device.id);
    try {
      const res = await axios.post('http://127.0.0.1:8001/macfilter', {
        device_name: device?.hostname,
        mac_address: device?.mac_address,
        list_type: "block"
      });

      if (res.status === 200) {
        // Update device status locally
        const updatedDevices = wirelessDevices.map(d => 
          d.id === device.id ? { ...d, is_blocked: true } : d
        );
        setWirelessDevices(updatedDevices);
        
        // Show success message
        setActionMessage({
          type: "success",
          text: `Device ${device.hostname} has been blocked`
        });
        
        // Refresh blocked devices list
        fetchBlockedDevices();
      } else {
        throw new Error("Failed to block device");
      }
    } catch (error) {
      console.error("Error blocking device:", error);
      setActionMessage({
        type: "error",
        text: error.message || "Failed to block device"
      });
    } finally {
      setBlockingDevice(null);
      // Clear message after a delay
      setTimeout(() => setActionMessage(null), 3000);
    }
  };
  
  // Handle device unblocking
  const handleUnblockDevice = async (device) => {
    setBlockingDevice(device.id);
    try {
      const res = await axios.post('http://127.0.0.1:8001/unblock', {
        device_name: device?.hostname,
        mac_address: device?.mac_address,
        list_type: "unblocked"
      });

      if (res.status === 200) {
        // Update device status locally
        const updatedDevices = wirelessDevices.map(d => 
          d.mac_address === device.mac_address ? { ...d, is_blocked: false } : d
        );
        setWirelessDevices(updatedDevices);
        
        // Refresh blocked devices list (remove device from blocked list)
        const updatedBlockedDevices = blockedDevices.filter(
          d => d.mac_address !== device.mac_address
        );
        setBlockedDevices(updatedBlockedDevices);
        
        // Show success message
        setActionMessage({
          type: "success",
          text: `Device ${device.hostname} has been unblocked`
        });
      } else {
        throw new Error("Failed to unblock device");
      }
    } catch (error) {
      console.error("Error unblocking device:", error);
      setActionMessage({
        type: "error",
        text: error.message || "Failed to unblock device"
      });
    } finally {
      setBlockingDevice(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  // Get device details
  const showDeviceDetails = (device) => {
    setActionMessage({
      type: "info",
      text: `Showing details for ${device.hostname}`
    });
    
    // Clear message after a delay
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Get total number of blocked devices
  const getTotalBlockedDevices = () => {
    return blockedDevices.length;
  };

  return (
    <div className="relative flex flex-row w-full bg-gray-50 h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-6 overflow-auto flex-1">
          {/* Main Wireless Devices Section */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            {/* Header */}
            <div className="bg-blue-600 px-6 py-4 sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-white">
                  {viewMode === "blocked" ? "Blocked Devices" : "Wireless Devices"}
                </h1>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handleRefresh} 
                    className="p-2 bg-blue-700 rounded-full text-white hover:bg-blue-800 transition-colors"
                  >
                    <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* View mode controls */}
            <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 sticky top-16 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-700">View:</span>
                  <div className="flex rounded-md shadow-sm overflow-hidden">
                    <button 
                      className={`px-3 py-1 text-sm font-medium border ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      onClick={() => setViewMode('all')}
                      disabled={blockingDevice !== null}
                    >
                      All Devices
                    </button>
                    <button 
                      className={`px-3 py-1 text-sm font-medium border ${viewMode === 'blocked' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                      onClick={() => setViewMode('blocked')}
                      disabled={blockingDevice !== null}
                    >
                      <Shield size={14} className="inline mr-1" />
                      Blocked Devices ({getTotalBlockedDevices()})
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="flex items-center">
                    <Shield size={18} className="text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">
                      {blockedDevices.length === 0 ? "No devices blocked" : `${blockedDevices.length} device(s) blocked`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-4 border-b border-gray-200 sticky top-32 z-10 bg-white">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by device name, MAC address, IP address, manufacturer..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Action message */}
            {actionMessage && (
              <div className={`px-6 py-2 sticky top-48 z-20 ${
                actionMessage.type === 'success' ? 'bg-green-50 text-green-800' : 
                actionMessage.type === 'info' ? 'bg-blue-50 text-blue-800' : 
                'bg-red-50 text-red-800'
              }`}>
                <div className="flex items-center">
                  {actionMessage.type === 'success' ? <Check size={16} className="mr-2" /> : 
                   actionMessage.type === 'info' ? <AlertTriangle size={16} className="mr-2" /> : 
                   <X size={16} className="mr-2" />}
                  <span className="text-sm">{actionMessage.text}</span>
                </div>
              </div>
            )}

            {/* Device list */}
            {isLoading ? (
              <div className="py-12 flex justify-center items-center">
                <div className="animate-pulse text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-blue-200 mb-4"></div>
                  <div className="h-4 bg-blue-100 rounded w-32 mx-auto"></div>
                </div>
              </div>
            ) : filteredDevices.length > 0 ? (
              <div className="overflow-auto max-h-[calc(100vh-14rem)]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('hostname')}
                      >
                        Device
                        {sortConfig.key === 'hostname' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('mac_address')}
                      >
                        MAC Address
                        {sortConfig.key === 'mac_address' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => requestSort('ip_address')}
                      >
                        IP Address
                        {sortConfig.key === 'ip_address' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                        )}
                      </th>
                     
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bandwidth
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      {viewMode === "blocked" && (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Blocked On
                        </th>
                      )}
                      {viewMode === "blocked" && (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Band
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDevices.map(device => (
                      <tr key={device.id} className={`hover:bg-gray-50 ${device.is_blocked || viewMode === "blocked" ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                              device.is_blocked || viewMode === "blocked" 
                                ? 'bg-red-100' 
                                : device.status === 'online' 
                                ? 'bg-green-100' 
                                : device.status === 'inactive'
                                ? 'bg-yellow-100'
                                : 'bg-gray-100'
                            }`}>
                              {device.is_blocked || viewMode === "blocked" ? (
                                <ShieldOff size={16} className="text-red-600" />
                              ) : device.status === 'online' ? (
                                <Wifi size={16} className="text-green-600" />
                              ) : device.status === 'inactive' ? (
                                <Wifi size={16} className="text-yellow-600" />
                              ) : (
                                <WifiOff size={16} className="text-gray-500" />
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{device.hostname}</div>
                              <div className="text-xs text-gray-500">{device.device_type}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-900">{device.mac_address}</div>
                          <div className="text-xs text-gray-500">{device.manufacturer}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-900">{device.ip_address}</div>
                        </td>
                      
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-500">
                            <div className="flex items-center">
                              <span className="text-blue-500">↓</span> {formatBandwidth(device.bandwidth.download)}
                            </div>
                            <div className="flex items-center">
                              <span className="text-green-500">↑</span> {formatBandwidth(device.bandwidth.upload)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {/* Status is NOT clickable in All Devices tab, just display it */}
                            {viewMode === "all" ? (
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                device.status === 'online' 
                                  ? 'bg-green-100 text-green-800' 
                                  : device.status === 'blocked' 
                                  ? 'bg-red-200 text-red-800'
                                  : device.status === 'inactive'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-slate-300 text-slate-800'
                              }`}>
                                {device.status === 'online' 
                                  ? 'Active' 
                                  : device.status === 'inactive'
                                  ? 'Inactive'
                                  : 'Offline'}
                              </span>
                            ) : (
                              /* Status IS clickable in Blocked Devices tab */
                              <button 
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  device.status === 'online' || device.status === 'active'
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                    : device.status === 'inactive'
                                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                                onClick={() => {
                                  if (viewMode === "blocked") {
                                    // Only clickable in blocked view
                                    showDeviceDetails(device);
                                  }
                                }}
                              >
                                {device.status === 'online' || device.status === 'active'
                                  ? 'Active' 
                                  : device.status === 'inactive'
                                  ? 'Inactive'
                                  : 'Offline'}
                              </button>
                            )}
                            
                            {/* Show blocked status */}
                            {(device.is_blocked || viewMode === "blocked") && (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Blocked
                              </span>
                            )}
                            {/* Show allowed status (if in allowlist mode) */}
                            {macFilteringPolicy === "allowlist" && device.is_allowed && viewMode === "all" && (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Allowed
                              </span>
                            )}
                          </div>
                        </td>
                        {viewMode === "blocked" && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatDate(device.added_on)}
                            </div>
                          </td>
                        )}
                        {viewMode === "blocked" && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {device.band || "All bands"}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <WifiOff size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No devices found</h3>
                <p className="mt-2 text-sm text-gray-500">
                  {searchFilter 
                    ? `No devices match your search criteria "${searchFilter}". Try a different search.` 
                    : viewMode === "blocked" 
                      ? "No devices are currently blocked." 
                      : "No wireless devices are currently connected."}
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleRefresh}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
            )}
            
            <div className="px-6 py-3 bg-gray-50 flex justify-between items-center text-sm text-gray-500 sticky bottom-0 z-10">
              <div>
                {filteredDevices.length > 0 ? (
                  <span>Showing {filteredDevices.length} {filteredDevices.length === 1 ? 'device' : 'devices'}</span>
                ) : null}
              </div>
              <div className="flex items-center space-x-1">
                {viewMode === "all" && (
                  <>
                    <span>MAC Filtering:</span>
                    <button 
                      onClick={() => setMacFilteringEnabled(!macFilteringEnabled)}
                      className={`px-2 py-1 rounded-md ${macFilteringEnabled ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'}`}
                    >
                      {macFilteringEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {macFilteringEnabled && (
                      <>
                        <span>Policy:</span>
                        <div className="flex rounded overflow-hidden border border-gray-300">
                          <button 
                            onClick={() => setMacFilteringPolicy("allowlist")}
                            className={`px-2 py-1 text-xs ${macFilteringPolicy === "allowlist" ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                          >
                            Allowlist
                          </button>
                          <button 
                            onClick={() => setMacFilteringPolicy("blocklist")}
                            className={`px-2 py-1 text-xs ${macFilteringPolicy === "blocklist" ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                          >
                            Blocklist
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WirelessDevices;