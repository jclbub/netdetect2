import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { Search, Wifi, WifiOff, Info, Shield, Clock, RefreshCw } from "lucide-react";

const MacFiltering = () => {
    const [connectedDevices, setConnectedDevices] = useState([]);
    const [macFilter, setMacFilter] = useState("");
    const [filteredDevices, setFilteredDevices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDevices, setSelectedDevices] = useState([]);
    const [blockMode, setBlockMode] = useState("allow"); // "allow" or "block"

    // Mock data for demonstration
    useEffect(() => {
        // Simulating API fetch
        setTimeout(() => {
            const mockDevices = [
                { id: 1, hostname: "Living Room TV", mac_address: "A1:B2:C3:D4:E5:F6", ip_address: "192.168.1.101", last_seen: "2025-03-10T15:30:00", status: "online" },
                { id: 2, hostname: "John's Laptop", mac_address: "F1:E2:D3:C4:B5:A6", ip_address: "192.168.1.102", last_seen: "2025-03-10T15:28:00", status: "online" },
                { id: 3, hostname: "Kitchen Tablet", mac_address: "1A:2B:3C:4D:5E:6F", ip_address: "192.168.1.103", last_seen: "2025-03-10T14:15:00", status: "online" },
                { id: 4, hostname: "Sarah's Phone", mac_address: "6F:5E:4D:3C:2B:1A", ip_address: "192.168.1.104", last_seen: "2025-03-10T13:45:00", status: "offline" },
                { id: 5, hostname: "Office Printer", mac_address: "AA:BB:CC:DD:EE:FF", ip_address: "192.168.1.105", last_seen: "2025-03-09T17:30:00", status: "offline" },
            ];
            setConnectedDevices(mockDevices);
            setFilteredDevices(mockDevices);
            setIsLoading(false);
        }, 1000);
    }, []);

    useEffect(() => {
        if (macFilter) {
            const filtered = connectedDevices.filter(device =>
                device.hostname.toLowerCase().includes(macFilter.toLowerCase()) ||
                device.mac_address.toLowerCase().includes(macFilter.toLowerCase()) ||
                device.ip_address.toLowerCase().includes(macFilter.toLowerCase())
            );
            setFilteredDevices(filtered);
        } else {
            setFilteredDevices(connectedDevices);
        }
    }, [macFilter, connectedDevices]);

    const toggleDeviceSelection = (deviceId) => {
        setSelectedDevices(prev => 
            prev.includes(deviceId) 
                ? prev.filter(id => id !== deviceId) 
                : [...prev, deviceId]
        );
    };

    const handleRefresh = () => {
        setIsLoading(true);
        // In a real app, you would fetch new data here
        setTimeout(() => {
            setIsLoading(false);
        }, 1000);
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const isToday = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        return date.setHours(0, 0, 0, 0) === today.setHours(0, 0, 0, 0);
    };

    return (
        <div className="relative flex flex-row w-full bg-gray-50 min-h-screen">
            <Sidebar />
            <div className="flex-1 p-6">
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    {/* Header */}
                    <div className="bg-indigo-600 px-6 py-4">
                        <div className="flex justify-between items-center">
                            <h1 className="text-xl font-bold text-white">MAC Address Filtering</h1>
                            <button 
                                onClick={handleRefresh} 
                                className="p-2 bg-indigo-700 rounded-full text-white hover:bg-indigo-800 transition-colors"
                            >
                                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>

                    {/* Filter mode selector */}
                    <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Shield size={18} className="text-indigo-600" />
                                <span className="text-sm font-medium text-gray-700">Filter Mode:</span>
                            </div>
                            <div className="flex rounded-md shadow-sm overflow-hidden">
                                <button 
                                    className={`px-4 py-2 text-sm font-medium border ${blockMode === 'allow' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    onClick={() => setBlockMode('allow')}
                                >
                                    Allow Listed
                                </button>
                                <button 
                                    className={`px-4 py-2 text-sm font-medium border ${blockMode === 'block' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                    onClick={() => setBlockMode('block')}
                                >
                                    Block Listed
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Search and actions */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by device name, MAC address, or IP..."
                                    value={macFilter}
                                    onChange={(e) => setMacFilter(e.target.value)}
                                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex space-x-2">
                                <button 
                                    disabled={selectedDevices.length === 0}
                                    className={`px-4 py-2 rounded-md text-sm font-medium ${selectedDevices.length > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'} transition-colors`}
                                >
                                    {blockMode === 'allow' ? 'Allow Selected' : 'Block Selected'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Device list */}
                    {isLoading ? (
                        <div className="py-12 flex justify-center items-center">
                            <div className="animate-pulse text-center">
                                <div className="mx-auto h-12 w-12 rounded-full bg-indigo-200 mb-4"></div>
                                <div className="h-4 bg-indigo-100 rounded w-32 mx-auto"></div>
                            </div>
                        </div>
                    ) : filteredDevices.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                onChange={() => {
                                                    if (selectedDevices.length === filteredDevices.length) {
                                                        setSelectedDevices([]);
                                                    } else {
                                                        setSelectedDevices(filteredDevices.map(d => d.id));
                                                    }
                                                }}
                                                checked={selectedDevices.length === filteredDevices.length && filteredDevices.length > 0}
                                            />
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MAC Address</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredDevices.map(device => (
                                        <tr key={device.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    checked={selectedDevices.includes(device.id)}
                                                    onChange={() => toggleDeviceSelection(device.id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${device.status === 'online' ? 'bg-green-100' : 'bg-gray-100'}`}>
                                                        {device.status === 'online' ? (
                                                            <Wifi size={16} className="text-green-600" />
                                                        ) : (
                                                            <WifiOff size={16} className="text-gray-500" />
                                                        )}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{device.hostname}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-mono text-gray-900">{device.mac_address}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-mono text-gray-900">{device.ip_address}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <Clock size={14} className="text-gray-400 mr-1" />
                                                    <div className="text-sm text-gray-500">
                                                        {isToday(device.last_seen) ? 
                                                            `Today at ${formatTime(device.last_seen)}` : 
                                                            formatDate(device.last_seen)
                                                        }
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {device.status === 'online' ? 'Online' : 'Offline'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <button className={`px-3 py-1 rounded text-xs font-medium ${blockMode === 'allow' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'} transition-colors`}>
                                                    {blockMode === 'allow' ? 'Allow' : 'Block'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-gray-500">
                            <div className="mx-auto h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                                <Info size={24} className="text-gray-400" />
                            </div>
                            <p>No devices found matching your search.</p>
                            <button 
                                onClick={() => setMacFilter("")} 
                                className="mt-2 text-indigo-600 hover:text-indigo-800"
                            >
                                Clear search
                            </button>
                        </div>
                    )}

                    {/* Footer with info */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        <div className="flex items-center text-sm text-gray-500">
                            <Info size={16} className="mr-2 text-indigo-500" />
                            {blockMode === 'allow' ? 
                                "Only devices on the allowlist can connect to your network." : 
                                "All devices can connect except those on the blocklist."
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MacFiltering;