import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Database } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import axios from "axios";

const BandwidthUsage = () => {
  const [bandwidthData, setBandwidthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [deviceCount, setDeviceCount] = useState({ total: 0, types: {} });
  const [networks, setNetworks] = useState([])

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8005/api/networks');
        setNetworks(response.data.networks);
        setLoading(false);
      } catch (err) {
        setError(`Error fetching network data: ${err.message}`);
        setLoading(false);
      }
    };
    
    fetchNetworks();
  }, []);

  // Colors for the pie chart
  const COLORS = ["#3b82f6", "#ef4444"];

  // Fetch total bandwidth data
  const fetchBandwidthData = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://127.0.0.1:8000/total-bandwidth-usage");
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setBandwidthData(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching bandwidth data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch connected devices data
  const fetchConnectedDevices = async () => {
    try {
      const response = await fetch("/connected-devices");
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setConnectedDevices(data);
      
      // Calculate device type counts
      const counts = { total: data.length, types: {} };
      data.forEach(device => {
        const deviceType = device.DeviceType || "Unknown";
        counts.types[deviceType] = (counts.types[deviceType] || 0) + 1;
      });
      
      setDeviceCount(counts);
    } catch (err) {
      console.error("Error fetching connected devices:", err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchBandwidthData();
    fetchConnectedDevices();
  }, []);

  // Set up auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBandwidthData();
      fetchConnectedDevices();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Manual refresh handler
  const handleRefresh = () => {
    fetchBandwidthData();
    fetchConnectedDevices();
  };

  // Prepare data for pie chart
  const preparePieData = () => {
    if (!bandwidthData) return [];
    
    // Extract numeric values from the formatted strings, regardless of unit
    const downloadValue = parseFloat(bandwidthData.total_download_MB?.split(" ")[0]) || 0;
    const uploadValue = parseFloat(bandwidthData.total_upload_MB?.split(" ")[0]) || 0;
    
    return [
      { name: "Download", value: downloadValue },
      { name: "Upload", value: uploadValue },
    ];
  };

  // Custom tooltip for the pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      // Get the value in most appropriate unit
      const value = payload[0].value;
      let formattedValue;
      if (value < 1) {
        formattedValue = `${(value * 1024).toFixed(2)} KB`;
      } else if (value < 1024) {
        formattedValue = `${value.toFixed(2)} MB`;
      } else if (value < 1024 * 1024) {
        formattedValue = `${(value / 1024).toFixed(2)} GB`;
      } else {
        formattedValue = `${(value / (1024 * 1024)).toFixed(2)} TB`;
      }
      
      // Calculate the percentage
      const total = preparePieData()[0].value + preparePieData()[1].value;
      const percentage = total > 0 ? ((payload[0].value / total) * 100).toFixed(1) : '0.0';
      
      return (
        <div className="bg-white p-3 rounded-md shadow-md border border-gray-200 text-sm">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-gray-700">{formattedValue}</p>
          <p className="text-gray-500 text-xs">
            {`${percentage}%`}
          </p>
        </div>
      );
    }
    return null;
  };

  // Get top bandwidth consumers
  const getTopConsumers = () => {
    if (!connectedDevices || connectedDevices.length === 0) return [];
    
    // Sort devices by total bandwidth (TxKBytes + RxKBytes)
    return [...connectedDevices]
      .filter(device => device.TxKBytes || device.RxKBytes)
      .sort((a, b) => {
        const aTotalKB = (parseInt(a.TxKBytes || 0) + parseInt(a.RxKBytes || 0));
        const bTotalKB = (parseInt(b.TxKBytes || 0) + parseInt(b.RxKBytes || 0));
        return bTotalKB - aTotalKB;
      })
      .slice(0, 5);  // Get top 5
  };

  // Format KB to appropriate unit (KB, MB, GB, TB)
  const formatKBytes = (kbytes) => {
    if (!kbytes) return "0 KB";
    const kb = parseInt(kbytes);
    
    // Convert to the most appropriate unit
    if (kb < 1024) return `${kb} KB`;
    if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(2)} MB`;
    if (kb < 1024 * 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
    return `${(kb / (1024 * 1024 * 1024)).toFixed(2)} TB`;
  };

  return (
    <div className="flex flex-row gap-5 w-full">
      <Sidebar />
      <div className="p-6 max-w-6xl mx-auto bg-gray-50 rounded-lg w-full flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Database className="text-blue-500" />
            Total Bandwidth Usage
          </h1>
          <div className="flex items-center gap-4">
            <div>
              <label htmlFor="refreshInterval" className="text-sm text-gray-500 mr-2">Refresh:</label>
              <select 
                id="refreshInterval"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                className="p-1 rounded border border-gray-300"
              >
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
              </select>
            </div>
            <button 
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-100 p-4 rounded-md text-red-700">
            <p className="font-medium">Error loading bandwidth data</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Connected devices summary */}
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-3">Connected Devices</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-gray-500">Total Devices</p>
              <p className="text-2xl font-bold">{networks.length}</p>
            </div>
            {Object.entries(deviceCount.types).map(([type, count]) => (
              <div key={type} className="flex-1 bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-500">{type}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main bandwidth stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column - Stats cards */}
          <div className="flex flex-col gap-4">
            {/* Download stats */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <div className="flex items-center gap-3">
                <ArrowDownCircle size={24} className="text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold">Total Download</h2>
                  <p className="text-3xl font-bold text-blue-600">
                    {loading ? "..." : (() => {
                      if (!bandwidthData) return "0 KB";
                      
                      // Extract the value and make it dynamic
                      const mbValue = parseFloat(bandwidthData.total_download_MB?.split(" ")[0]) || 0;
                      
                      if (mbValue >= 1024) {
                        // Convert to GB if >= 1024 MB
                        return `${(mbValue / 1024).toFixed(2)} GB`;
                      } else if (mbValue >= 1) {
                        // Keep as MB if >= 1 MB
                        return bandwidthData.total_download_MB;
                      } else {
                        // Convert to KB for small values
                        return `${(mbValue * 1024).toFixed(0)} KB`;
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Upload stats */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <div className="flex items-center gap-3">
                <ArrowUpCircle size={24} className="text-red-500" />
                <div>
                  <h2 className="text-lg font-semibold">Total Upload</h2>
                  <p className="text-3xl font-bold text-red-600">
                    {loading ? "..." : (() => {
                      if (!bandwidthData) return "0 KB";
                      
                      // Extract the value and make it dynamic
                      const mbValue = parseFloat(bandwidthData.total_upload_MB?.split(" ")[0]) || 0;
                      
                      if (mbValue >= 1024) {
                        // Convert to GB if >= 1024 MB
                        return `${(mbValue / 1024).toFixed(2)} GB`;
                      } else if (mbValue >= 1) {
                        // Keep as MB if >= 1 MB
                        return bandwidthData.total_upload_MB;
                      } else {
                        // Convert to KB for small values
                        return `${(mbValue * 1024).toFixed(0)} KB`;
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Combined stats */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold">Total Bandwidth</h2>
              <div className="mt-3">
                <p className="text-sm text-gray-500">Total Usage</p>
                {loading ? (
                  <p className="text-xl font-semibold text-purple-600">...</p>
                ) : (
                  <p className="text-3xl font-bold text-purple-600">
                    {(() => {
                      // Get the value and auto-format to the most appropriate unit
                      if (!bandwidthData) return "0 KB";
                      
                      // First try to get total_bandwidth_GB to check if it's in GB range
                      const gbValue = parseFloat(bandwidthData.total_bandwidth_GB?.split(" ")[0]) || 0;
                      
                      if (gbValue >= 1024) {
                        // Show in TB if > 1024 GB
                        return `${(gbValue / 1024).toFixed(2)} TB`;
                      } else if (gbValue >= 1) {
                        // Show in GB if >= 1 GB
                        return bandwidthData.total_bandwidth_GB;
                      } else {
                        // Show in MB for smaller values
                        return bandwidthData.total_bandwidth_MB;
                      }
                    })()}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Right column - Pie chart */}
          <div className="bg-white p-4 rounded-lg shadow-md flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Bandwidth Distribution</h2>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={preparePieData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {preparePieData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex justify-between text-sm text-gray-500">
          <p>Auto-refreshing every {refreshInterval/1000} seconds</p>
          <p>Last updated: {lastUpdated.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default BandwidthUsage;