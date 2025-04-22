import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { Search, Wifi, WifiOff, RefreshCw, Shield, ShieldOff, AlertTriangle, Check, X, Settings, Signal} from "lucide-react";
import { otherFetch } from "../../hooks/otherFetch";
import axios from 'axios';

const WirelessDevices = () => {
  const [wirelessDevices, setWirelessDevices] = useState([]);
  const [blockedDevices, setBlockedDevices] = useState([]); // New state for blocked devices
  const [searchFilter, setSearchFilter] = useState("");
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'hostname', direction: 'ascending' });
  const [blockingDevice, setBlockingDevice] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [macFilteringEnabled, setMacFilteringEnabled] = useState(true);
  const [macFilteringPolicy, setMacFilteringPolicy] = useState("allowlist");
  const [viewMode, setViewMode] = useState("all"); // "all" or "blocked"
  
  // API data fetching
  const { data: devicesData, error: deviceError, loading: deviceLoading, refetch: refetchDevices } 
      = otherFetch("wireless-devices");
      
  // Get blocked devices information - using the new enhanced API
  const { data: macFilterData, error: macFilterError, loading: macFilterLoading, refetch: refetchMacFilter } 
      = otherFetch("blocked-devices");

  // Fetch blocked devices directly from the API
  const fetchBlockedDevices = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('http://localhost:8001/blocked-devices');
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
    } finally {
      setIsLoading(false);
    }
  };

  // Process blocked devices data from API
  const processBlockedDevices = (data) => {
    let allBlockedDevices = [];
    
    // Extract blocked devices from both 2.4GHz and 5GHz bands
    if (data['2.4GHz'] && Array.isArray(data['2.4GHz'].blocked_devices)) {
      const devices24GHz = data['2.4GHz'].blocked_devices.map((device, index) => ({
        id: `blocked-${index}-24g`,
        hostname: device.HostName || "Unknown Device",
        mac_address: device.MACAddress || "Unknown",
        ip_address: device.IPAddress || "Unknown",
        signal_strength: device.signal_strength || 0,
        status: device.Active ? "active" : "inactive",
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
        signal_strength: device.signal_strength || 0,
        status: device.Active ? "active" : "inactive",
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
    
    return uniqueDevices;
  };

  // Initial data load
  useEffect(() => {
    fetchBlockedDevices();
  }, []);

  // Process wireless device data when it arrives
  useEffect(() => {
    if (devicesData) {
      const enhancedDevices = devicesData.map((device, index) => ({
        id: index + 1,
        hostname: device.HostName || "Unknown Device",
        mac_address: device.MACAddress || "Unknown",
        ip_address: device.IPAddress || "Unknown",
        signal_strength: device.signal_strength || 0,
        status: device.Active ? "active" : "inactive",
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
      
      setWirelessDevices(enhancedDevices);
      setIsLoading(false);
    }
  }, [devicesData]);
  
  // Update MAC filtering status when data arrives
  useEffect(() => {
    if (macFilterData) {
      // Check for error in response
      if (macFilterData.error) {
        console.error("Error fetching MAC filter data:", macFilterData.error);
        setActionMessage({
          type: "error",
          text: `Failed to load blocked devices: ${macFilterData.error}`
        });
        setTimeout(() => setActionMessage(null), 3000);
        return;
      }
      
      // For simplicity, combine blocked devices from both bands
      const allBlockedDevices = [];
      const allAllowedDevices = [];
      
      // Process data for each frequency band
      if ('2.4GHz' in macFilterData) {
        // Update MAC filtering settings from 2.4GHz
        const band24 = macFilterData['2.4GHz'];
        setMacFilteringEnabled(band24.enabled);
        // Convert numeric policy: 0 = allowlist, 1 = blocklist
        setMacFilteringPolicy(band24.policy === 0 ? "allowlist" : "blocklist");
        
        // Add blocked and allowed devices
        if (Array.isArray(band24.blocked_devices)) {
          allBlockedDevices.push(...band24.blocked_devices);
        }
        
        if (Array.isArray(band24.allowed_devices)) {
          allAllowedDevices.push(...band24.allowed_devices);
        }
      }
      
      if ('5GHz' in macFilterData) {
        // Add blocked and allowed devices from 5GHz
        const band5 = macFilterData['5GHz'];
        if (Array.isArray(band5.blocked_devices)) {
          allBlockedDevices.push(...band5.blocked_devices);
        }
        
        if (Array.isArray(band5.allowed_devices)) {
          allAllowedDevices.push(...band5.allowed_devices);
        }
      }
      
      // Handle case where we get raw data array from backend
      if (Array.isArray(macFilterData)) {
        macFilterData.forEach(bandConfig => {
          const frequencyBand = bandConfig.FrequencyBand;
          
          // Get the first band config to set the policy (preferring 2.4GHz if available)
          if (frequencyBand === '2.4GHz' || !macFilteringPolicy) {
            setMacFilteringEnabled(bandConfig.MACAddressControlEnabled === true);
            setMacFilteringPolicy(bandConfig.MacFilterPolicy === 0 ? "allowlist" : "blocklist");
          }
          
          // Add blocked and allowed devices
          if (Array.isArray(bandConfig.BMACAddresses)) {
            allBlockedDevices.push(...bandConfig.BMACAddresses);
          }
          
          if (Array.isArray(bandConfig.WMACAddresses)) {
            allAllowedDevices.push(...bandConfig.WMACAddresses);
          }
        });
      }
      
      // If we have wireless devices, update their blocked/allowed status
      if (wirelessDevices.length > 0) {
        // Create maps for quick MAC lookup
        const blockedMacsMap = new Map();
        allBlockedDevices.forEach(device => {
          if (device && device.MACAddress) {
            blockedMacsMap.set(device.MACAddress.toLowerCase(), device);
          }
        });
        
        const allowedMacsMap = new Map();
        allAllowedDevices.forEach(device => {
          if (device && device.MACAddress) {
            allowedMacsMap.set(device.MACAddress.toLowerCase(), device);
          }
        });
        
        // Update wireless devices with blocked/allowed status
        const updatedDevices = wirelessDevices.map(device => {
          const macLower = device.mac_address.toLowerCase();
          const blockedInfo = blockedMacsMap.get(macLower);
          const allowedInfo = allowedMacsMap.get(macLower);
          
          return {
            ...device,
            is_blocked: !!blockedInfo,
            is_allowed: !!allowedInfo,
            added_on: blockedInfo ? blockedInfo.AddedOn : null
          };
        });
        
        setWirelessDevices(updatedDevices);
      }
    }
  }, [macFilterData, wirelessDevices]);

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
    refetchDevices();
    refetchMacFilter();
    fetchBlockedDevices();
    setTimeout(() => setIsLoading(false), 800);
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
  const handleBlockDevice = async (device, method) => {
    console.log(device.id)
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
  const handleUnblockDevice = async (device, order) => {
    console.log(order)
    console.log(device.id)
    setBlockingDevice(device.id);
    try {
      const res = await axios.post('http://127.0.0.1:8001/unblock', {
        device_name: device?.hostname,
        mac_address: device?.mac_address,
        list_type: "unblocked",
        order: order
      });

      console.log(res.data)

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
      window.location.reload()
      setActionMessage({
        type: "error",
        text: error.message || "Failed to block device"
      });
    } finally {
      setBlockingDevice(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  // Get device details
  const showDeviceDetails = (device) => {
    // Here you would implement the logic to show device details
    // For example, open a modal or navigate to a details page
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
    <div className="relative flex flex-row w-full bg-gray-50 min-h-screen">
      <Sidebar />
      <div className="flex-1 p-6">
        {/* Main Wireless Devices Section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
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
          <div className="bg-blue-50 px-6 py-3 border-b border-blue-100">
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
          <div className="px-6 py-4 border-b border-gray-200">
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
            <div className={`px-6 py-2 ${
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
          ) : deviceError ? (
            <div className="py-12 text-center text-red-500">
              <p>Error loading data: {deviceError}</p>
              <button 
                onClick={handleRefresh} 
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Try again
              </button>
            </div>
          ) : filteredDevices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
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
                      Signal
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDevices.map(device => (
                    <tr key={device.id} className={`hover:bg-gray-50 ${device.is_blocked || viewMode === "blocked" ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                            device.is_blocked || viewMode === "blocked" ? 'bg-red-100' : device.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {device.is_blocked || viewMode === "blocked" ? (
                              <ShieldOff size={16} className="text-red-600" />
                            ) : device.status === 'active' ? (
                              <Wifi size={16} className="text-green-600" />
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
                        {renderSignalStrength(device.signal_strength)}
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
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            device.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {device.status === 'active' ? 'Active' : 'Idle'}
                          </span>
                          
                          {/* Show blocked status */}
                          {(device.is_blocked || viewMode === "blocked") && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Blocked
                            </span>
                          )}
                          {/* Show allowed status (if in allowlist mode) */}
                          {macFilteringPolicy === "allowlist" && device.is_allowed && (
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {device.is_blocked || viewMode === "blocked" ? (
                            <button
                              onClick={() => handleUnblockDevice(device, 2)}
                              disabled={blockingDevice === device.id}
                              className={`flex items-center px-3 py-1 rounded text-xs font-medium ${
                                blockingDevice === device.id
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                              } transition-colors`}
                            >
                              <ShieldOff size={14} className="mr-1" />
                              {blockingDevice === device.id ? 'Unblocking...' : 'Unblock'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlockDevice(device, "blocklist")}
                              disabled={blockingDevice === device.id}
                              className={`flex items-center px-3 py-1 rounded text-xs font-medium ${
                                blockingDevice === device.id
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              } transition-colors`}
                            >
                              <Shield size={14} className="mr-1" />
                              {blockingDevice === device.id ? 'Blocking...' : 'Block'}
                            </button>
                          )}
                          
                          {/* Additional action button */}
                          <button
                            onClick={() => showDeviceDetails(device)}
                            className="flex items-center px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                          >
                            <Settings size={14} className="mr-1" />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <p>
                {searchFilter 
                  ? "No devices found matching your search." 
                  : viewMode === "blocked"
                    ? "No blocked devices found."
                    : "No wireless devices connected."
                }
              </p>
              {searchFilter && (
                <button 
                  onClick={() => setSearchFilter("")} 
                  className="mt-2 text-blue-600 hover:text-blue-800"
                >
                  Clear search
                </button>
              )}
              {viewMode === "blocked" && blockedDevices.length === 0 && (
                <button 
                  onClick={() => setViewMode("all")} 
                  className="mt-2 text-blue-600 hover:text-blue-800"
                >
                  View all devices
                </button>
              )}
            </div>
          )}

          {/* Footer with info */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div>
                {viewMode === "all" 
                  ? `${filteredDevices.length} device(s) found`
                  : `${filteredDevices.length} blocked device(s) shown`
                }
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <Shield size={14} className="mr-1 text-blue-500" />
                  <span>Total Blocked: {blockedDevices.length}</span>
                </div>
                <div className="flex items-center">
                  <span>Last Updated: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WirelessDevices;