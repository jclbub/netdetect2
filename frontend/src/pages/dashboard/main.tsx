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
  const [bandwidthHistory, setBandwidthHistory] = useState<Array<{
    timestamp: string;
    bytes_sent: number;
    bytes_recv: number;
    _smooth?: boolean;
  }>>([]);
  const [pingHistory, setPingHistory] = useState<Array<{
    timestamp: string;
    ping: number;
    _smooth?: boolean;
  }>>([]);
  const [realTimeSpeedData, setRealTimeSpeedData] = useState<{
    download_speed: number | null;
    upload_speed: number | null;
    ping_latency: number | null;
  }>({
    download_speed: null,
    upload_speed: null,
    ping_latency: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningSpeedTest, setIsRunningSpeedTest] = useState(false);
  const [connectedDevicesList, setConnectedDevicesList] = useState([]);

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
  const { data: speedData, error: speedError, loading: speedLoading, refetch: refetchSpeed } = useSmoothFetch("speed-test");
  const { data: bandwidthData, error: bandwidthError, loading: bandwidthLoading, refetch: refetchBandwidth } = useSmoothFetch("total-bandwidth-usage");
  const { data: connectedDevices, error: connectedError, loading: connectedLoading, refetch: refetchConnected } = otherFetch("connected-devices");

  // Define the type for bandwidthData
  type BandwidthDataType = {
    total_bytes_sent?: number;
    total_bytes_recv?: number;
    total_mbps_sent?: number;
    total_mbps_recv?: number;
  };

  // Function to run a new speed test
  const runSpeedTest = async () => {
    setIsRunningSpeedTest(true);
    try {
      const response = await fetch('http://localhost:8000/run-speed-test', {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setRealTimeSpeedData({
          download_speed: data.download_mbps,
          upload_speed: data.upload_mbps,
          ping_latency: data.ping_ms
        });
        
        // Update refs for smooth transitions
        prevSpeedData.current = {
          download_speed: data.download_mbps,
          upload_speed: data.upload_mbps,
          ping_latency: data.ping_ms
        };
      }
    } catch (error) {
      console.error('Error running speed test:', error);
    } finally {
      setIsRunningSpeedTest(false);
    }
  };

  const formatBandwidth = (mb) => {
    const num = Number(mb); 
    if (isNaN(num) || num <= 0) return "0 MB"; 
  
    const gb = num / 1024;
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${num.toFixed(2)} MB`;
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
  
      // Update bandwidth history for the chart
      setBandwidthHistory(prevHistory => {
        // Check if bandwidthData exists and has the expected properties
        if (!bandwidthData || (!bandwidthData.total_mbps_recv && !bandwidthData.total_mbps_sent)) {
          return prevHistory;
        }
        
        const newHistory = [
          ...prevHistory,
          {
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            bytes_sent: bandwidthData.total_mbps_sent || 0, 
            bytes_recv: bandwidthData.total_mbps_recv || 0,
            _smooth: true
          }
        ];
        // Keep only the latest 20 data points
        return newHistory.slice(-20);
      });
    }
  }, [bandwidthData]);
  
  // Update connected devices data
  useEffect(() => {
    if (connectedDevices?.connected_devices) {
      setConnectedDevicesList(connectedDevices.connected_devices);
      prevConnectedDevices.current = connectedDevices;
      
      // Update the ping history for the chart
      const count = connectedDevices.connected_devices.length || 0;
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
    }
  }, [connectedDevices]);

  // Update connected devices data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refetchConnected();
    }, 5000);

    return () => clearInterval(interval);
  }, [refetchConnected]);

  // Fetch initial speed data
  useEffect(() => {
    if (speedData) {
      setRealTimeSpeedData({
        download_speed: speedData.downbandwidth,
        upload_speed: speedData.upbandwidth,
        ping_latency: speedData.ping_latency || 15 // Default value if not provided
      });
      
      prevSpeedData.current = {
        download_speed: speedData.downbandwidth,
        upload_speed: speedData.upbandwidth,
        ping_latency: speedData.ping_latency || 15
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
              download_speed: data.downbandwidth || 0,
              upload_speed: data.upbandwidth || 0,
              ping_latency: data.ping_latency || 15
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
      return Math.min(1, Math.max(0, value / 500));
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
          {payload[0] && <p className="text-sm text-indigo-600">Sent: {formatBandwidth(payload[0].value)}</p>}
          {payload[1] && <p className="text-sm text-emerald-600">Received: {formatBandwidth(payload[1].value)}</p>}
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

  // SpeedometerGauge component
  const SpeedometerGauge = ({ value = 0, maxValue, type, title, icon: Icon }) => {
    // Handle null or undefined values
    const safeValue = value !== null && value !== undefined ? value : 0;
    const percentage = calculateGaugePercentage(safeValue, type);
    const qualityColor = getQualityColor(safeValue, type);
    const qualityText = getQualityText(safeValue, type);
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
              {safeValue?.toFixed(1) || "0.0"}
            </text>
            <text x="90" y="75" textAnchor="middle" className="text-xs fill-gray-500">
              {type === "ping" ? "ms" : "Kbps"}
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

  // Component for Connected Devices List
  const ConnectedDevicesList = ({ devices }) => {
    return (
      <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-sm rounded-xl shadow-sm overflow-hidden hover:shadow-md mb-6">
        <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi size={18} />
              <h2 className="font-semibold">Connected Devices</h2>
            </div>
            <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
              {devices?.length || 0} Devices
            </span>
          </div>
        </div>
        
        <div className="p-4">
          {connectedLoading ? (
            renderLoading()
          ) : connectedError ? (
            renderError()
          ) : devices?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MAC Address</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speed</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {devices.map((device, index) => (
                    <tr key={device.MACAddress || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                            {device.DeviceType === "Desktop PC" && <Globe size={20} className="text-blue-500" />}
                            {device.DeviceType === "Mobile" && <div className="w-5 h-8 rounded-sm border-2 border-blue-500" />}
                            {!device.DeviceType && <Wifi size={20} className="text-gray-500" />}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{device.HostName || "Unknown Device"}</div>
                            <div className="text-xs text-gray-500">{device.ActualName || "No name"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{device.IPAddress || "Unknown"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{device.MACAddress || "Unknown"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{device.DeviceType || "Unknown"}</div>
                        <div className="text-xs text-gray-500">{device.InterfaceType || "Unknown"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${device.Active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {device.Active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <div className="flex items-center">
                            <Upload size={12} className="text-indigo-500 mr-1" />
                            <span>{device.UpRate || 0} kbps</span>
                          </div>
                          <div className="flex items-center">
                            <Download size={12} className="text-emerald-500 mr-1" />
                            <span>{device.DownRate || 0} kbps</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Wifi size={40} className="mx-auto text-gray-300 mb-2" />
              <p>No devices connected</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Network Status Card
  const NetworkStatusCard = ({ data }) => {
    return (
      <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-sm rounded-xl shadow-sm overflow-hidden hover:shadow-md mb-6">
        <div className="p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Globe size={18} />
            <h2 className="font-semibold">Network Status</h2>
          </div>
        </div>
        
        <div className="p-4">
          {speedLoading ? (
            renderLoading()
          ) : speedError ? (
            renderError()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Connection Details</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 text-sm font-medium text-gray-500">Status</div>
                  <div className="col-span-2 text-sm text-gray-900">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {data?.connectionstatus || "Connected"}
                    </span>
                  </div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">Type</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.connection_type || "IP_Routed"}</div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">Access</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.accesstype || "Ethernet"}</div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">IP Address</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.ipv4addr || "192.168.1.3"}</div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">Gateway</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.ipv4gateway || "192.168.1.1"}</div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Network Settings</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 text-sm font-medium text-gray-500">DNS Servers</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.ipv4dnsservers || "192.168.1.1"}</div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">MTU</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.mtu || 1500}</div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">IPv6</div>
                  <div className="col-span-2 text-sm text-gray-900">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${data?.ipv6enable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {data?.ipv6enable ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">Access Status</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.accessstatus || "Up"}</div>
                  
                  <div className="col-span-1 text-sm font-medium text-gray-500">Connection Name</div>
                  <div className="col-span-2 text-sm text-gray-900">{data?.name || "INTERNET_R_ETH1"}</div>
                </div>
              </div>
            </div>
          )}
          
          {data?.note && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <p>{data.note}</p>
              </div>
            </div>
          )}
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

        {/* Network Status Card */}
        <NetworkStatusCard data={speedData} />

        {/* Connected Devices List */}
        {/* <ConnectedDevicesList devices={connectedDevicesList} /> */}

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
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 mr-1 animate-pulse text-black"></span>
                    <span className="text-black">Live</span>
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
                        <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} />
                        <YAxis 
                          tickFormatter={tick => tick}
                          width={60}
                          tick={{ fontSize: 12 }} 
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="bytes_sent" 
                          name="Upload" 
                          stroke="#6366f1" 
                          dot={false}
                          strokeWidth={2}
                          animationDuration={300}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="bytes_recv" 
                          name="Download" 
                          stroke="#10b981"
                          dot={false}
                          strokeWidth={2}
                          animationDuration={300}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <div className="text-xs text-indigo-600 mb-1">Total Sent</div>
                      <div className="text-xl font-bold text-indigo-700">
                        {(bandwidthData as BandwidthDataType)?.total_bytes_sent ? formatBandwidth(parseFloat((bandwidthData as BandwidthDataType).total_bytes_sent)) : "Loading..."}
                      </div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <div className="text-xs text-emerald-600 mb-1">Total Received</div>
                      <div className="text-xl font-bold text-emerald-700">
                        {(bandwidthData as BandwidthDataType)?.total_bytes_recv ? formatBandwidth(parseFloat((bandwidthData as BandwidthDataType).total_bytes_recv)) : "Loading..."}
                      </div>
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
                  <Wifi size={18} />
                  <h2 className="font-semibold">Connected Devices History</h2>
                </div>
                <div className="flex items-center">
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-300 mr-1 animate-pulse"></span>
                    <span className="text-black">Live</span>
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
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        ...Array.from(new Set(connectedDevices.map(d => d.DeviceType))).map(type => ({
                          name: type,
                          value: connectedDevices.filter(d => d.DeviceType === type).length
                        }))
                      ]} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis 
                          tick={{ fill: '#6b7280' }}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Legend />
                        <Bar 
                          dataKey="value" 
                          name="Devices" 
                          fill="#ff007f" 
                          radius={[4, 4, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-rose-50 rounded-lg p-3">
                      <div className="text-xs text-rose-600 mb-1">Current Devices</div>
                      <div className="text-xl font-bold text-rose-700">
                        {connectedDevices?.length || 0}
                      </div>
                    </div>
                    {/* <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-blue-600 mb-1">Peak Devices</div>
                      <div className="text-xl font-bold text-blue-700">
                        {Math.max(...pingHistory.map(p => p.ping || 0), 0)}
                      </div>
                    </div> */}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Speed Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Download Speed */}
          <SpeedometerGauge 
            value={realTimeSpeedData?.download_speed || 0} 
            maxValue={500}
            type="download"
            title="Download Speed"
            icon={Download}
          />
          
          {/* Upload Speed */}
          <SpeedometerGauge 
            value={realTimeSpeedData?.upload_speed || 0} 
            maxValue={200}
            type="upload"
            title="Upload Speed"
            icon={Upload}
          />
          
          {/* Ping Latency */}
          <SpeedometerGauge 
            value={realTimeSpeedData?.ping_latency || 0} 
            maxValue={200}
            type="ping"
            title="Ping Latency"
            icon={Activity}
          />
        </div>

        {/* Speed Test Button */}
        <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-sm rounded-xl shadow-sm p-5 mb-6 hover:shadow-md">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Network Speed Test</h2>
              <p className="text-gray-500 text-sm">Run a comprehensive test to measure your connection performance</p>
            </div>
            <button
              onClick={runSpeedTest}
              disabled={isRunningSpeedTest}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                isRunningSpeedTest
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {isRunningSpeedTest ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <Activity size={16} />
                  Run Speed Test
                </>
              )}
            </button>
          </div>
          
          {/* Test results summary */}
          {realTimeSpeedData && !isRunningSpeedTest && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs text-blue-600 mb-1">Download Speed</div>
                <div className="text-xl font-bold text-blue-700 mt-2">
                  {(realTimeSpeedData.download_speed || 0).toFixed(2)} Kbps
                </div>
              </div>
              
              <div className="bg-indigo-50 p-3 rounded-lg">
                <div className="text-xs text-indigo-600 mb-1">Upload Speed</div>
                <div className="text-xl font-bold text-indigo-700 mt-2">
                  {(realTimeSpeedData.upload_speed || 0).toFixed(2)} Kbps
                </div>
              </div>
              
              <div className="bg-emerald-50 p-3 rounded-lg">
                <div className="text-xs text-emerald-600 mb-1">Ping Latency</div>
                <div className="text-xl font-bold text-emerald-700 mt-2">
                  {(realTimeSpeedData.ping_latency || 0).toFixed(1)} ms
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6">
          <div className="text-center text-sm text-gray-500">
            <p> 2025 Network Monitor Dashboard. All rights reserved.</p>
            <p className="mt-1">Data refreshes automatically every 30 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;