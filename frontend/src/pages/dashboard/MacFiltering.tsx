import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { Search, Wifi, WifiOff, RefreshCw, Clock, Signal, Shield, ShieldOff, AlertTriangle } from "lucide-react";
import { otherFetch } from "../../hooks/otherFetch";

const WirelessDevices = () => {
  const [wirelessDevices, setWirelessDevices] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'hostname', direction: 'ascending' });
  const [blockingDevice, setBlockingDevice] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [selectedFrequencyBand, setSelectedFrequencyBand] = useState("2.4GHz");
  
  // API data fetching
  const { data: devicesData, error: deviceError, loading: deviceLoading, refetch: refetchDevices } 
      = otherFetch("wireless-devices");
      
  // Get blocked devices information
  const { data: blockedDevicesData, error: blockedError, loading: blockedLoading, refetch: refetchBlocked } 
      = otherFetch("mac-filter/blocked-devices");

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
        is_blocked: false // Default to not blocked, will update when blocked data arrives
      }));
      
      setWirelessDevices(enhancedDevices);
      setIsLoading(false);
    }
  }, [devicesData]);
  
  // Update blocked status when blocked devices data arrives
  useEffect(() => {
    if (blockedDevicesData && wirelessDevices.length > 0) {
      // Get the blocked MAC addresses for the selected frequency band
      const blockedMacs = new Set(
        (blockedDevicesData[selectedFrequencyBand] || [])
          .map(device => device.MACAddress.toLowerCase())
      );
      
      // Update wireless devices with blocked status
      const updatedDevices = wirelessDevices.map(device => ({
        ...device,
        is_blocked: blockedMacs.has(device.mac_address.toLowerCase())
      }));
      
      setWirelessDevices(updatedDevices);
    }
  }, [blockedDevicesData, selectedFrequencyBand, wirelessDevices]);

  // Filter devices based on search criteria
  useEffect(() => {
    let filtered = wirelessDevices;
    
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
  }, [searchFilter, wirelessDevices, sortConfig]);

  // Refresh all data
  const handleRefresh = () => {
    setIsLoading(true);
    refetchDevices();
    refetchBlocked();
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

  // Format uptime to readable format
  const formatUptime = (uptime) => {
    if (uptime === "Unknown") return uptime;
    
    // Assuming uptime is in seconds
    const seconds = parseInt(uptime);
    if (isNaN(seconds)) return uptime;
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };
  
  // Handle device blocking
  const handleBlockDevice = async (device) => {
    setBlockingDevice(device.id);
    try {
      const response = await fetch("/api/mac-filter/add-single-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          band: selectedFrequencyBand,
          mac_address: device.mac_address,
          host_name: device.hostname,
          policy: 1 // Block policy
        }),
      });
      
      if (response.ok) {
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
        
        // Refresh blocked devices
        refetchBlocked();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to block device");
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
      const response = await fetch("/api/mac-filter/remove-single-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          band: selectedFrequencyBand,
          mac_address: device.mac_address,
          policy: 1 // Block policy
        }),
      });
      
      if (response.ok) {
        // Update device status locally
        const updatedDevices = wirelessDevices.map(d => 
          d.id === device.id ? { ...d, is_blocked: false } : d
        );
        setWirelessDevices(updatedDevices);
        
        // Show success message
        setActionMessage({
          type: "success",
          text: `Device ${device.hostname} has been unblocked`
        });
        
        // Refresh blocked devices
        refetchBlocked();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to unblock device");
      }
    } catch (error) {
      console.error("Error unblocking device:", error);
      setActionMessage({
        type: "error",
        text: error.message || "Failed to unblock device"
      });
    } finally {
      setBlockingDevice(null);
      // Clear message after a delay
      setTimeout(() => setActionMessage(null), 3000);
    }
  };
  
  // Handle frequency band change
  const handleBandChange = (band) => {
    setSelectedFrequencyBand(band);
  };

  return (
    <div className="relative flex flex-row w-full bg-gray-50 min-h-screen">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold text-white">Wireless Devices</h1>
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
          
          {/* Frequency band selector */}
          <div className="bg-blue-50 px-6 py-2 border-b border-blue-100">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">Wi-Fi Band for Blocking:</span>
                <div className="flex rounded-md shadow-sm overflow-hidden">
                  <button 
                    className={`px-3 py-1 text-sm font-medium border ${selectedFrequencyBand === '2.4GHz' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => handleBandChange('2.4GHz')}
                    disabled={blockingDevice !== null}
                  >
                    2.4 GHz
                  </button>
                  <button 
                    className={`px-3 py-1 text-sm font-medium border ${selectedFrequencyBand === '5GHz' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => handleBandChange('5GHz')}
                    disabled={blockingDevice !== null}
                  >
                    5 GHz
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <Shield size={18} className="text-blue-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">
                  Blocking {blockedDevicesData && blockedDevicesData[selectedFrequencyBand] 
                    ? blockedDevicesData[selectedFrequencyBand].length 
                    : 0} device(s)
                </span>
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
            <div className={`px-6 py-2 ${actionMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <div className="flex items-center">
                <AlertTriangle size={16} className="mr-2" />
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDevices.map(device => (
                    <tr key={device.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${device.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
                            {device.status === 'active' ? (
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
                            {device.status === 'active' ? 'Connected' : 'Disconnected'}
                          </span>
                          
                          {device.is_blocked && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Blocked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.is_blocked ? (
                          <button
                            onClick={() => handleUnblockDevice(device)}
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
                            onClick={() => handleBlockDevice(device)}
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
                  ? "No wireless devices found matching your search." 
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
            </div>
          )}

          {/* Footer with info */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div>
                {filteredDevices.length} device(s) found
              </div>
              <div className="flex items-center">
                <Shield size={14} className="mr-1 text-red-500" />
                <span>Blocking applies to {selectedFrequencyBand} network</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WirelessDevices;