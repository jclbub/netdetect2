import React, { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar } from "recharts";
import { otherFetch } from "../../hooks/otherFetch";
import { AlertCircle, WifiOff, Wifi, RefreshCw, X, Activity, HardDrive, Database, Zap } from "lucide-react";

const ConnectedDevices = () => {
    const [connectedDevices, setConnectedDevices] = useState([]);
    const [deviceHistory, setDeviceHistory] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [realTimeData, setRealTimeData] = useState(null);
    const [bandwidthHistory, setBandwidthHistory] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState("list"); // "list", "grid", or "map"
    const { data, error, loading, refetch } = otherFetch("connected-devices");

    // Real-time bandwidth monitoring simulation
    useEffect(() => {
        if (!selectedDevice) return;
        
        const interval = setInterval(() => {
            // Base values from the device
            const sentBase = parseInt(selectedDevice.bandwidth_sent);
            const receivedBase = parseInt(selectedDevice.bandwidth_received);
            
            // Add some randomization to simulate fluctuating bandwidth
            const sentValue = Math.max(0, sentBase + Math.floor(Math.random() * 20) - 10);
            const receivedValue = Math.max(0, receivedBase + Math.floor(Math.random() * 40) - 15);
            
            setRealTimeData({
                ...selectedDevice,
                bandwidth_sent: sentValue,
                bandwidth_received: receivedValue,
                last_updated: new Date().toLocaleTimeString()
            });
            
            // Add to bandwidth history
            setBandwidthHistory(prev => [
                ...prev.slice(-20),
                {
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    upload: sentValue,
                    download: receivedValue
                }
            ]);
        }, 2000);
        
        return () => clearInterval(interval);
    }, [selectedDevice]);

    useEffect(() => {
        if (data) {
            const enhancedDevices = data.connected_devices.map(device => ({
                ...device,
                lastSeen: new Date().toLocaleTimeString(),
                signalStrength: Math.floor(Math.random() * 100),
                // Make sure these are numbers for calculations
                bandwidth_sent: parseInt(device.bandwidth_sent) || 0,
                bandwidth_received: parseInt(device.bandwidth_received) || 0,
                // Ensure these properties exist
                connection_type: device.connection_type || "wireless",
                status: device.status || "active"
            }));
            
            setConnectedDevices(enhancedDevices);
            
            // Calculate wireless vs wired counts for the chart
            const wirelessCount = enhancedDevices.filter(d => d.connection_type === "wireless").length;
            const wiredCount = enhancedDevices.filter(d => d.connection_type === "wired").length;
            
            const currentTime = new Date();
            setDeviceHistory(prevHistory => [
                ...prevHistory.slice(-24), // Keep last 24 data points
                { 
                    time: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                    count: enhancedDevices.length,
                    wireless: wirelessCount,
                    wired: wiredCount
                }
            ]);
        }
        
        // Set up auto-refresh every 20 seconds
        const refreshInterval = setInterval(() => {
            setIsRefreshing(true);
            refetch().finally(() => {
                setTimeout(() => setIsRefreshing(false), 500);
            });
        }, 20000);
        
        return () => clearInterval(refreshInterval);
    }, [data, refetch]);

    const handleDeviceClick = useCallback((device) => {
        setSelectedDevice(device);
        setBandwidthHistory([{
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            upload: parseInt(device.bandwidth_sent),
            download: parseInt(device.bandwidth_received)
        }]);
        setShowModal(true);
        setRealTimeData(device); // Initialize real-time data with current device data
    }, []);

    const closeModal = useCallback(() => {
        setShowModal(false);
        setSelectedDevice(null);
        setBandwidthHistory([]);
    }, []);

    const handleManualRefresh = useCallback(() => {
        setIsRefreshing(true);
        refetch().finally(() => {
            setTimeout(() => setIsRefreshing(false), 500);
        });
    }, [refetch]);

    const renderDeviceModal = () => {
        if (!showModal || !selectedDevice || !realTimeData) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between bg-indigo-600 text-white px-6 py-4">
                        <h3 className="text-xl font-bold">{realTimeData.hostname || "Device Details"}</h3>
                        <button onClick={closeModal} className="p-1 rounded-full hover:bg-indigo-700 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-indigo-50 p-4 rounded-lg">
                                <h4 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center">
                                    <HardDrive size={20} className="mr-2" />
                                    Device Information
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">IP Address:</span>
                                        <span className="font-mono text-indigo-700">{realTimeData.ip_address}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">MAC Address:</span>
                                        <span className="font-mono text-indigo-700">{realTimeData.mac_address}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Device Type:</span>
                                        <span className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-sm font-medium">
                                            {realTimeData.device_type}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Connection:</span>
                                        <span className="flex items-center">
                                            {realTimeData.connection_type === "wireless" ? 
                                                <Wifi size={16} className="text-green-500 mr-1" /> : 
                                                <Database size={16} className="text-blue-500 mr-1" />}
                                            {realTimeData.connection_type || "Wireless"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Status:</span>  
                                        <span className={`flex items-center ${realTimeData.status === "active" ? "text-green-600" : "text-amber-600"}`}>
                                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${realTimeData.status === "active" ? "bg-green-500" : "bg-amber-500"}`}></span>
                                            {realTimeData.status || "Active"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Last Updated:</span>
                                        <span className="text-indigo-700">{realTimeData.last_updated}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-indigo-50 p-4 rounded-lg">
                                <h4 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center">
                                    <Activity size={20} className="mr-2" />
                                    Current Bandwidth Usage
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-gray-600 text-sm">Upload</span>
                                            <span className="text-green-600 font-medium">{realTimeData.bandwidth_sent}KB</span>
                                        </div>
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-green-500" 
                                                style={{ 
                                                    width: `${Math.min(parseInt(realTimeData.bandwidth_sent) / 20, 100)}%` 
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-gray-600 text-sm">Download</span>
                                            <span className="text-blue-600 font-medium">{realTimeData.bandwidth_received}KB</span>
                                        </div>
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-500" 
                                                style={{ 
                                                    width: `${Math.min(parseInt(realTimeData.bandwidth_received) / 40, 100)}%` 
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <span className="text-xs text-gray-500">Refreshing every 2 seconds</span>
                                        <div className="flex items-center justify-center mt-1">
                                            <RefreshCw size={16} className={`text-indigo-600 ${isRefreshing ? "animate-spin" : ""}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                                <Zap size={20} className="mr-2" />
                                Real-Time Bandwidth History
                            </h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={bandwidthHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="time" tick={{ fill: '#6b7280' }} />
                                        <YAxis tick={{ fill: '#6b7280' }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                borderRadius: '8px',
                                                border: 'none',
                                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                            }}
                                            formatter={(value) => [`${value} KB`, undefined]}
                                        />
                                        <Legend />
                                        <Area 
                                            type="monotone" 
                                            dataKey="upload" 
                                            name="Upload" 
                                            stroke="#10b981" 
                                            fill="rgba(16, 185, 129, 0.2)" 
                                            activeDot={{ r: 8 }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="download" 
                                            name="Download" 
                                            stroke="#3b82f6" 
                                            fill="rgba(59, 130, 246, 0.2)" 
                                            activeDot={{ r: 8 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
                        <button 
                            onClick={closeModal}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDevicesList = () => (
        <div className="relative rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full table-auto">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">IP Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">MAC Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Hostname</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Manufacturer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Device Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Bandwidth Usage</th>
                    </tr>
                </thead>
            </table>
            <div className="overflow-y-auto max-h-80">
                <table className="w-full table-auto">
                    <tbody className="bg-white divide-y divide-gray-200">
                        {connectedDevices.map((device, index) => (
                            <tr 
                                key={index} 
                                className="hover:bg-indigo-50 transition-colors duration-150 ease-in-out cursor-pointer"
                                onClick={() => handleDeviceClick(device)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{device.ip_address}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{device.mac_address}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{device.hostname}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                        {device.manufacturer}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                        {device.device_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex space-x-2">
                                        <span className="px-3 py-1 inline-flex text-xs text-center leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                           ↑ {device.bandwidth_sent} KB
                                        </span>
                                        <span className="px-3 py-1 inline-flex text-xs text-center leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                            ↓ {device.bandwidth_received} KB
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderDevicesGrid = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedDevices.map((device, index) => (
                <div
                    key={index}
                    className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleDeviceClick(device)}
                >
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium text-gray-800 truncate">{device.hostname}</h3>
                            <span className={`inline-flex items-center ${device.status === "active" ? "text-green-600" : "text-amber-600"}`}>
                                <span className={`w-2 h-2 rounded-full mr-1 ${device.status === "active" ? "bg-green-500" : "bg-amber-500"}`}></span>
                                <span className="text-xs">{device.status === "active" ? "Active" : "Idle"}</span>
                            </span>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                            <span className="font-mono">{device.ip_address}</span>
                        </div>
                        
                        <div className="flex items-center text-xs text-gray-500 mb-3">
                            <span className="font-mono truncate">{device.mac_address}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <span className="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                {device.manufacturer}
                            </span>
                            
                            <div className="flex space-x-1">
                                <span className="text-xs text-green-600">↑{device.bandwidth_sent} KB</span>
                                <span className="text-xs text-blue-600">↓{device.bandwidth_received} KB</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex-1 p-8 overflow-hidden bg-gray-50">
            <div className="flex items-center mb-8">
                <h1 className="text-3xl font-bold text-indigo-900">Connected Devices</h1>
                <div className="ml-auto flex items-center bg-white rounded-full px-4 py-2 shadow-md border border-indigo-100">
                    <span className="h-3 w-3 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                    <span className="text-sm font-medium text-gray-700">
                        {connectedDevices.length} Active Devices
                    </span>
                </div>
                <button 
                    onClick={handleManualRefresh}
                    className="ml-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors border border-indigo-100"
                    title="Refresh data"
                >
                    <RefreshCw size={20} className={`text-indigo-600 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-lg p-6 border border-indigo-100">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Connection Trends</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={deviceHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis 
                                dataKey="time" 
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
                            <Area 
                                type="monotone" 
                                dataKey="count" 
                                name="Total Devices"
                                stroke="#6366f1" 
                                fill="rgba(99, 102, 241, 0.2)"
                                strokeWidth={2}
                                activeDot={{ r: 8, fill: '#4f46e5' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="wireless" 
                                name="Wireless"
                                stroke="#ec4899" 
                                fill="rgba(236, 72, 153, 0.2)"
                                strokeWidth={2}
                                activeDot={{ r: 6, fill: '#db2777' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="wired" 
                                name="Wired"
                                stroke="#14b8a6" 
                                fill="rgba(20, 184, 166, 0.2)"
                                strokeWidth={2}
                                activeDot={{ r: 6, fill: '#0d9488' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 border border-indigo-100">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Device Type Distribution</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            ...Array.from(new Set(connectedDevices.map(d => d.device_type))).map(type => ({
                                name: type,
                                value: connectedDevices.filter(d => d.device_type === type).length
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
                                fill="#8884d8" 
                                radius={[4, 4, 0, 0]} 
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-indigo-100 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Device Inventory</h2>
                    <div className="flex border rounded-lg overflow-hidden">
                        <button 
                            onClick={() => setViewMode("list")}
                            className={`px-3 py-1 text-sm ${viewMode === "list" ? "bg-indigo-600 text-white" : "bg-white text-gray-600"}`}
                        >
                            List
                        </button>
                        <button 
                            onClick={() => setViewMode("grid")}
                            className={`px-3 py-1 text-sm ${viewMode === "grid" ? "bg-indigo-600 text-white" : "bg-white text-gray-600"}`}
                        >
                            Grid
                        </button>
                    </div>
                </div>
                
                {loading && (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <span className="ml-3 text-gray-600">Loading devices...</span>
                    </div>
                )}
                
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start">
                        <AlertCircle size={20} className="mr-2 mt-1 flex-shrink-0" />
                        <div>
                            <p className="font-medium">Error loading devices</p>
                            <p className="text-sm mt-1">{error.message || "An unknown error occurred."}</p>
                        </div>
                    </div>
                )}

                {!loading && !error && connectedDevices.length === 0 && (
                    <div className="bg-gray-50 text-gray-600 p-8 rounded-lg flex flex-col items-center justify-center">
                        <WifiOff size={48} className="text-gray-400 mb-3" />
                        <p className="font-medium">No devices connected</p>
                        <p className="text-sm mt-1">Check your network connection and try again.</p>
                    </div>
                )}
                
                {!loading && !error && connectedDevices.length > 0 && (
                    viewMode === "list" ? renderDevicesList() : renderDevicesGrid()
                )}
            </div>
            
            {renderDeviceModal()}
        </div>
    );
};

export default ConnectedDevices;