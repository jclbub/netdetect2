import { useEffect, useState, useRef } from "react";
import { Activity, Wifi, Download, Upload, AlertCircle, Globe, RefreshCw } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import useFetch from "../../hooks/fetch";
import { otherFetch } from "../../hooks/otherFetch";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

const Dashboard = () => {
  // Use refs to store the previous data for smooth transitions
  const prevBandwidthData = useRef(null);
  const prevConnectedDevices = useRef(null);
  const prevSpeedData = useRef(null);

  // State for live data
  const [bandwidthHistory, setBandwidthHistory] = useState([]);
  const [pingHistory, setPingHistory] = useState([]);
  const [realTimeSpeedData, setRealTimeSpeedData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningSpeedTest, setIsRunningSpeedTest] = useState(false);

  // Custom hook for data fetching with smooth transitions
  const useSmoothFetch = (endpoint) => {
    const { data, error, loading, refetch } = useFetch(endpoint);
    const [smoothData, setSmoothData] = useState(null);
    const [smoothLoading, setSmoothLoading] = useState(true);

    useEffect(() => {
      if (data && !loading) {
        const timer = setTimeout(() => {
          setSmoothData(data);
          setSmoothLoading(false);
        }, 300);
        return () => clearTimeout(timer);
      } else if (loading) {
        setSmoothLoading(true);
      }
    }, [data, loading]);

    return { data: smoothData, error, loading: smoothLoading, refetch };
  };

  // Use smooth fetch for all data endpoints
  const { data: speedData, error: speedError, loading: speedLoading, refetch: refetchSpeed } = useSmoothFetch("network-speed");
  const { data: bandwidthData, error: bandwidthError, loading: bandwidthLoading, refetch: refetchBandwidth } = useSmoothFetch("total-bandwidth-usage");
  const { data: connectedDevices, error: connectedError, loading: connectedLoading, refetch: refetchConnected } = otherFetch("connected-devices");


  // Function to run a new speed test
  const runSpeedTest = () => {
    setIsRunningSpeedTest(true);
    // Simulate a speed test completion
    setTimeout(() => {
      setIsRunningSpeedTest(false);
      refetchSpeed();
    }, 2000);
  };

  // Convert bytes to appropriate unit
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Handle refresh of all data
  const handleRefresh = () => {
    setIsRefreshing(true);
    refetchSpeed();
    refetchBandwidth();
    refetchConnected();
    runSpeedTest();
    
    // Simulate a smooth refresh experience
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  // Update bandwidth history when new data arrives
  useEffect(() => {
    if (bandwidthData) {
      // Store previous data
      prevBandwidthData.current = bandwidthData;
      
      // Update the bandwidth history for the chart with smooth transitions
      setBandwidthHistory(prevHistory => {
        const newHistory = [...prevHistory, {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          bytes_sent: bandwidthData.total_bytes_sent,
          bytes_recv: bandwidthData.total_bytes_recv,
          // Add interpolation data for smoother transitions
          _smooth: true
        }];
        // Keep only the latest 20 data points
        return newHistory.slice(-20);
      });
    }
  }, [bandwidthData]);

  // Update connected devices data periodically
  useEffect(() => {
    if (connectedDevices) {
      prevConnectedDevices.current = connectedDevices;
    }
    
    const interval = setInterval(() => {
      const count = connectedDevices?.connected_devices?.length || 0;
      setPingHistory(prevHistory => {
        const newHistory = [...prevHistory, {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          ping: count,
          // Add smoothing flag
          _smooth: true
        }];
        // Keep only the latest 20 data points
        return newHistory.slice(-20);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [connectedDevices]);

  // Fetch initial speed data
  useEffect(() => {
    if (speedData) {
      setRealTimeSpeedData({
        download_speed: speedData.download_speed,
        upload_speed: speedData.upload_speed,
        ping_latency: speedData.ping_latency
      });
      
      prevSpeedData.current = {
        download_speed: speedData.download_speed,
        upload_speed: speedData.upload_speed,
        ping_latency: speedData.ping_latency
      };
    }
  }, [speedData]);

  // Update speed data periodically (every 30 seconds)
  useEffect(() => {
    const fetchSpeedUpdate = async () => {
      try {
        const response = await fetch('http://localhost:8000/network-speed');
        if (response.ok) {
          const data = await response.json();
          
          // Apply smooth transition
          if (prevSpeedData.current) {
            const transitionData = {
              download_speed: data.download_mbps,
              upload_speed: data.upload_mbps,
              ping_latency: data.ping_ms
            };
            
            setRealTimeSpeedData(transitionData);
            prevSpeedData.current = transitionData;
          }
        }
      } catch (error) {
        console.error('Error updating speed data:', error);
      }
    };
    
    // Initial fetch
    fetchSpeedUpdate();
    
    // Set up interval for periodic updates
    const intervalId = setInterval(fetchSpeedUpdate, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Function to determine color based on speed quality
  const getQualityColor = (value, type) => {
    if (type === "ping") {
      if (value < 20) return "#10b981"; // Good (green)
      if (value < 50) return "#f59e0b"; // Medium (amber)
      return "#ef4444"; // Poor (red)
    } else {
      if (type === "download") {
        if (value > 300) return "#10b981"; // Good (green)
        if (value > 100) return "#f59e0b"; // Medium (amber)
        return "#ef4444"; // Poor (red)
      } else {
        if (value > 100) return "#10b981"; // Good (green)
        if (value > 50) return "#f59e0b"; // Medium (amber)
        return "#ef4444"; // Poor (red)
      }
    }
  };

  // Get quality text
  const getQualityText = (value, type) => {
    if (type === "ping") {
      if (value < 20) return "Excellent";
      if (value < 50) return "Good";
      if (value < 100) return "Average";
      return "Poor";
    } else if (type === "download") {
      if (value > 300) return "Excellent";
      if (value > 100) return "Good";
      if (value > 50) return "Average";
      return "Poor";
    } else {
      if (value > 100) return "Excellent";
      if (value > 50) return "Good";
      if (value > 20) return "Average";
      return "Poor";
    }
  };

  // Calculate percentage for gauge
  const calculateGaugePercentage = (value, type) => {
    if (type === "ping") {
      return Math.min(1, Math.max(0, 1 - (value / 200)));
    } else if (type === "download") {
      return Math.min(1, Math.max(0, value / 300));
    } else {
      return Math.min(1, Math.max(0, value / 200));
    }
  };
  
  // Custom tooltip for the bandwidth graph
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
          <p className="font-medium text-gray-700">{label}</p>
          {payload[0] && <p className="text-sm text-indigo-600">Sent: {formatBytes(payload[0].value)}</p>}
          {payload[1] && <p className="text-sm text-emerald-600">Received: {formatBytes(payload[1].value)}</p>}
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for the ping graph
  const PingTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md">
          <p className="font-medium text-gray-700">{label}</p>
          {payload[0] && <p className="text-sm text-rose-600">Devices: {payload[0].value.toFixed(0)}</p>}
        </div>
      );
    }
    return null;
  };

  // Render loading state with skeleton loaders
  const renderLoading = () => (
    <div className="grid gap-4 w-full animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3"></div>
      <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
      </div>
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="flex items-center gap-2 text-red-500 py-4 justify-center">
      <AlertCircle size={18} />
      <p className="text-sm">Error fetching data</p>
    </div>
  );

  const SpeedometerGauge = ({ value = 0, maxValue, type, title, icon: Icon }) => {
    const percentage = calculateGaugePercentage(value, type);
    const qualityColor = getQualityColor(value, type);
    const qualityText = getQualityText(value, type);
    const rotation = percentage * 180;
    
    // Define gradient IDs for each gauge type
    const gradientId = `gauge-gradient-${type}`;
    
    return (
      <div className="relative flex flex-col items-center justify-center bg-white rounded-xl shadow-md h-full hover:shadow-lg overflow-hidden group">
        <div className="w-full bg-gradient-to-r from-gray-800 to-gray-900 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Icon size={16} className="text-gray-200" />
            <h3 className="font-medium">{title}</h3>
          </div>
          <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full text-white">
            {type === "ping" ? "Latency" : "Speed"}
          </span>
        </div>
        
        <div className="p-4 w-full flex flex-col items-center">
          {/* SVG Gauge - No animation classes */}
          <svg width="180" height="100" viewBox="0 0 180 100" className="my-2">
            {/* Define gradients */}
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                {type === "ping" ? (
                  <>
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="40%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </>
                )}
              </linearGradient>
            </defs>
            
            {/* Background arc */}
            <path 
              d="M 10 90 A 80 80 0 0 1 170 90" 
              fill="none" 
              stroke="#e5e7eb" 
              strokeWidth="10" 
              strokeLinecap="round"
            />
            
            {/* Foreground arc - no animation classes */}
            <path 
              d={`M 10 90 A 80 80 0 0 1 ${10 + percentage * 160} ${90 - Math.sin(percentage * Math.PI) * 80}`}
              fill="none" 
              stroke={`url(#${gradientId})`}
              strokeWidth="10" 
              strokeLinecap="round"
            />
            
            {/* Gauge needle - no animation classes */}
            <g style={{ transform: `rotate(${rotation - 90}deg)`, transformOrigin: '90px 90px' }}>
              <line x1="90" y1="90" x2="160" y2="90" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
              <circle cx="90" cy="90" r="5" fill="#1f2937" />
            </g>
            
            {/* Value text */}
            <text x="90" y="60" textAnchor="middle" className="font-bold text-xl fill-gray-800">
              {value ? value.toFixed(1) : '0.0'}
            </text>
            <text x="90" y="75" textAnchor="middle" className="text-xs fill-gray-500">
              {type === "ping" ? "ms" : "Mbps"}
            </text>
          </svg>
          
          {/* Quality indicator */}
          <div className="mt-2 flex flex-col items-center">
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: qualityColor }}
            >
              {qualityText}
            </span>
            
            {/* Measurement timestamp */}
            {speedData && (
              <span className="mt-2 text-xs text-gray-500">
                Last updated: {new Date().toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br w-full from-indigo-50 to-gray-100 overflow-y-auto overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 p-3 md:p-6 overflow-y-auto max-w-full">
        {/* Header with glass morphism effect */}
        <div className="bg-white bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-xl shadow-sm p-4 md:p-5 mb-4 md:mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:shadow-md">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Globe className="text-indigo-500" size={24} />
              Network Dashboard
            </h1>
            <p className="text-sm md:text-base text-gray-500">Monitor your network performance and bandwidth usage in real-time</p>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-3 rounded-full ${isRefreshing ? 'bg-gray-100 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100 hover:shadow-md'}`}
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'text-gray-400 animate-spin' : 'text-indigo-600'}`} />
          </button>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6 mb-3 md:mb-6">
          {/* Bandwidth Usage Chart */}
          <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-sm rounded-xl shadow-sm overflow-hidden h-full hover:shadow-md">
            <div className="p-3 md:p-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="md:size-18" />
                  <h2 className="font-semibold text-sm md:text-base">Real-time Bandwidth Usage</h2>
                </div>
                <div className="flex items-center">
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 mr-1 animate-pulse"></span>
                    Live
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-3 md:p-5">
              {bandwidthLoading ? (
                renderLoading()
              ) : bandwidthError ? (
                renderError()
              ) : (
                <>
                  <div className="h-48 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={bandwidthHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="timestamp" 
                          tick={{ fontSize: 10, width: 40 }}
                          stroke="#9ca3af"
                          tickFormatter={(value) => value.substring(0, 5)}
                        />
                        <YAxis 
                          tickFormatter={(value) => formatBytes(value, 0)}
                          width={60}
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          verticalAlign="top" 
                          height={36}
                          formatter={(value) => <span className="text-xs md:text-sm font-medium">{value === "bytes_sent" ? "Upload" : "Download"}</span>}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="bytes_sent" 
                          name="bytes_sent"
                          stroke="#6366f1" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, stroke: "#4f46e5", strokeWidth: 1 }}
                          animationDuration={1000}
                          animationEasing="ease-out"
                          isAnimationActive={true}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="bytes_recv" 
                          name="bytes_recv"
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, stroke: "#059669", strokeWidth: 1 }}
                          animationDuration={1000}
                          animationEasing="ease-out"
                          isAnimationActive={true}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="flex justify-between mt-4 text-xs md:text-sm text-gray-600">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-indigo-500 mr-2"></div>
                      <span>Upload (Sent Data)</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>
                      <span>Download (Received Data)</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Connected Devices Chart */}
          <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-sm rounded-xl shadow-sm overflow-hidden h-full hover:shadow-md">
            <div className="p-3 md:p-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi size={16} className="md:size-18" />
                  <h2 className="font-semibold text-sm md:text-base">Connected Devices Monitoring</h2>
                </div>
                <div className="flex items-center">
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-300 mr-1 animate-pulse"></span>
                    Live
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-3 md:p-5">
              {connectedLoading ? (
                renderLoading()
              ) : connectedError ? (
                renderError()
              ) : (
                <>
                  <div className="h-48 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pingHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="timestamp" 
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                          tickFormatter={(value) => value.substring(0, 5)}
                        />
                        <YAxis 
                          width={40}
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                          domain={[0, 'dataMax + 2']}
                        />
                        <Tooltip content={<PingTooltip />} />
                        <Legend 
                          verticalAlign="top" 
                          height={36}
                          formatter={(value) => <span className="text-xs md:text-sm font-medium">{value}</span>}
                        />
                        <Bar 
                          dataKey="ping" 
                          name="Connected Devices"
                          fill="#e11d48" 
                          animationDuration={1000}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="flex justify-between mt-4 text-xs md:text-sm text-gray-600">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-rose-500 mr-2"></div>
                      <span>Connected Devices ({connectedDevices?.connected_devices?.length || 0})</span>
                    </div>
                    {connectedDevices && (
                      <div className="flex items-center">
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                          Last updated: {new Date().toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row - Connection Performance Gauges */}
        <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-sm rounded-xl shadow-sm overflow-hidden mb-6 hover:shadow-md">
          <div className="p-3 md:p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <Globe size={16} className="md:size-18" />
              <h2 className="font-semibold text-sm md:text-base">Connection Performance</h2>
            </div>
          </div>
          
          <div className="p-3 md:p-6">
            {speedLoading && !realTimeSpeedData ? (
              renderLoading()
            ) : speedError && !realTimeSpeedData ? (
              renderError()
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {/* Download Speed Gauge */}
                <SpeedometerGauge 
                  value={speedData?.download_mbps || 0}
                  maxValue={1000}
                  type="download"
                  title="Download Speed"
                  icon={Download}
                />
                
                {/* Upload Speed Gauge */}
                <SpeedometerGauge 
                  value={speedData?.upload_mbps || 0}                  
                  maxValue={1000}
                  type="upload"
                  title="Upload Speed"
                  icon={Upload}
                />
                
                {/* Ping Gauge */}
                <SpeedometerGauge 
                  value={speedData?.ping_ms || 0}                  
                  maxValue={100}
                  type="ping"
                  title="Ping Latency"
                  icon={Activity}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    0% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animate-gradientShift {
    background-size: 200% 200%;
    animation: gradientShift 5s ease infinite;
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.8s ease-out forwards;
  }
  
  .animate-pulse {
    animation: pulse 2s infinite;
  }
  
  .border-16 {
    border-width: 16px;
  }

  .backdrop-filter {
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
  }

  /* Responsive styles */
  @media (max-width: 640px) {
    .text-xs {
      font-size: 0.7rem;
    }

    .p-3 {
      padding: 0.5rem;
    }
  }
`;
document.head.appendChild(style);

export default Dashboard;