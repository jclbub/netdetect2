import React, { useState, useEffect, useRef } from "react";
import useFetch from "../../hooks/fetch.js";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowUpCircle, ArrowDownCircle, Activity, RefreshCw } from "lucide-react";

const BandwidthUsage = () => {
  const [historyData, setHistoryData] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(2000);
  const { data, loading, error } = useFetch('bandwidth-usage');
  const prevDataRef = useRef(null);
  const intervalRef = useRef(null);
  const animationRef = useRef(null);

  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0 || isNaN(bytes) || bytes === undefined) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // Calculate bandwidth rate (bytes per second)
  const calculateRate = (current, previous, elapsedMs) => {
    if (!previous || !current || isNaN(current) || isNaN(previous) || current < 0 || previous < 0) return 0;
    const byteDiff = current - previous;
    const seconds = elapsedMs / 1000;
    return byteDiff / seconds;
  };

  // Function to refresh data
  const refreshData = () => {
    // This would normally trigger your fetch hook, but we'll simulate with animation
    if (animationRef.current) {
      animationRef.current.beginElement();
    }
  };

  useEffect(() => {
    // Initialize auto-refresh
    intervalRef.current = setInterval(() => {
      refreshData();
    }, refreshInterval);
    
    return () => {
      clearInterval(intervalRef.current);
    };
  }, [refreshInterval]);

  useEffect(() => {
    if (!data || loading || !data.bytes_recv || !data.bytes_sent) return;
  
    const timestamp = new Date().toLocaleTimeString();
  
    const newDataPoint = {
      time: timestamp,
      totalReceived: Number(data.bytes_recv) || 0,
      totalSent: Number(data.bytes_sent) || 0,
      packetsReceived: Number(data.packets_recv) || 0,
      packetsSent: Number(data.packets_sent) || 0,
    };
  
    setHistoryData(prev => {
      const updated = [...prev, newDataPoint].slice(-20);
      return updated;
    });
  
    prevDataRef.current = data;
  }, [data, loading, refreshInterval]);
  

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-md shadow-md border border-gray-200">
          <p className="font-semibold">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className={index === 0 ? "text-blue-500" : "text-red-500"}>
              {entry.name}: {formatBytes(entry.value || 0)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  

  // Get the latest rates for display with NaN/undefined handling
  const currentTotalReceived = historyData.length > 0 ? 
    (historyData[historyData.length - 1].totalReceived || 0) : 0;
  const currentTotalSent = historyData.length > 0 ? 
    (historyData[historyData.length - 1].totalSent || 0) : 0;
  const totalReceived = data ? formatBytes(data.bytes_recv || 0) : '0 Bytes';
  const totalSent = data ? formatBytes(data.bytes_sent || 0) : '0 Bytes';

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Activity className="text-blue-500" />
          Bandwidth Usage Monitor
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
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
          <button 
            onClick={refreshData}
            className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {loading && historyData.length === 0 && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 p-4 rounded-md text-red-700 mb-4">
          <p className="font-medium">Error loading bandwidth data</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-3">
            <ArrowDownCircle size={24} className="text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold">Total Received</h2>
              <p className="text-3xl font-bold text-blue-600 transition-all duration-500 ease-in-out">{totalReceived}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Packets Received</p>
            <p className="text-lg font-semibold transition-all duration-500 ease-in-out">{data?.packets_recv || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-3">
            <ArrowUpCircle size={24} className="text-red-500" />
            <div>
              <h2 className="text-lg font-semibold">Total Sent</h2>
              <p className="text-3xl font-bold text-red-600 transition-all duration-500 ease-in-out">{totalSent}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Packets Sent</p>
            <p className="text-lg font-semibold transition-all duration-500 ease-in-out">{data?.packets_sent || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Bandwidth Usage Over Time</h2>
        <div className="h-64">
          {historyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={historyData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    // Show fewer x-axis labels for clarity
                    return value;
                  }}
                />
                <YAxis 
                  tickFormatter={(value) => {
                    // Handle NaN/undefined in Y-axis labels
                    return isNaN(value) || value === undefined ? '0 B' : formatBytes(value, 0);
                  }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalReceived"
                  name="Total Received"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-in-out"
                />
                <Line
                  type="monotone"
                  dataKey="totalSent"
                  name="Total Sent"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-in-out"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Collecting data...
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-between text-sm text-gray-500">
        <p>Auto-refreshing every {refreshInterval/1000} seconds</p>
        <p className="transition-opacity duration-300">Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default BandwidthUsage;