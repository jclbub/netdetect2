import React, { useState, useEffect } from 'react';
import { Calendar, Search, RefreshCw, Download, Filter, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import Sidebar from '../../components/Sidebar';

const Logs = () => {
  // State for storing network data
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    endDate: new Date().toISOString().split('T')[0] // Today
  });
  
  // State for selected network
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [bandwidthData, setBandwidthData] = useState([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Fetch networks data from API using axios
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
  
  // Fetch bandwidth data for a specific network using axios
  const fetchBandwidthData = async (networkId) => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:8005/api/networks/${networkId}/bandwidth?limit=100`);
      setBandwidthData(response.data);
      setLoading(false);
    } catch (err) {
      setError(`Error fetching bandwidth data: ${err.message}`);
      setLoading(false);
    }
  };
  
  // Handle network selection
  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
    fetchBandwidthData(network.id);
  };
  
  // Filter networks based on search term and date range
  const filteredNetworks = networks.filter(network => {
    const matchesSearch = 
      searchTerm === '' || 
      network.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      network.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      network.mac_address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const networkDate = new Date(network.updated_at);
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59); // Include the entire end date
    
    const matchesDate = networkDate >= startDate && networkDate <= endDate;
    
    return matchesSearch && matchesDate;
  });
  
  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNetworks = filteredNetworks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredNetworks.length / itemsPerPage);
  
  // Calculate total upload and download for selected network's filtered bandwidth data
  const calculateTotals = () => {
    if (!bandwidthData.length) return { totalUpload: 0, totalDownload: 0 };
    
    const filteredData = bandwidthData.filter(item => {
      if (!item.created_at) return false;
      
      const itemDate = new Date(item.created_at);
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59);
      
      return itemDate >= startDate && itemDate <= endDate;
    });
    
    return filteredData.reduce((acc, item) => {
      return {
        totalUpload: acc.totalUpload + item.upload,
        totalDownload: acc.totalDownload + item.download
      };
    }, { totalUpload: 0, totalDownload: 0 });
  };
  
  const { totalUpload, totalDownload } = calculateTotals();
  
  // Format bytes to readable format (KB, MB, GB)
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Handle refresh with axios
  const handleRefresh = () => {
    if (selectedNetwork) {
      fetchBandwidthData(selectedNetwork.id);
    } else {
      // Fetch all networks again
      setLoading(true);
      axios.get('http://localhost:8005/api/networks')
        .then(response => {
          setNetworks(response.data.networks);
          setLoading(false);
        })
        .catch(err => {
          setError(`Error refreshing network data: ${err.message}`);
          setLoading(false);
        });
    }
  };
  
  // Handle export to Excel with each device on separate sheet
  const exportToExcel = async () => {
    const workbook = XLSX.utils.book_new();
    
    if (selectedNetwork) {
      // Export only the selected network's bandwidth data
      const filteredData = bandwidthData.filter(item => {
        if (!item.created_at) return false;
        
        const itemDate = new Date(item.created_at);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59);
        
        return itemDate >= startDate && itemDate <= endDate;
      });
      
      // Create worksheet for this device
      const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
        'Upload (bytes)': item.upload,
        'Upload': formatBytes(item.upload),
        'Download (bytes)': item.download,
        'Download': formatBytes(item.download),
        'Created At': formatDate(item.created_at)
      })));
      
      // Format column headers
      XLSX.utils.book_append_sheet(workbook, worksheet, selectedNetwork.hostname.substring(0, 31)); // Excel sheet names limited to 31 chars
    } else {
      // Export data for all networks, each on its own sheet
      // First, create a summary sheet with all networks
      const summaryData = filteredNetworks.map(network => ({
        'ID': network.id,
        'Hostname': network.hostname,
        'IP Address': network.ip_address,
        'MAC Address': network.mac_address,
        'Status': network.status,
        'Total Upload': formatBytes(network.total_upload),
        'Total Download': formatBytes(network.total_download),
        'Updated At': formatDate(network.updated_at)
      }));
      
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'All Networks');
      
      // Then create individual sheets for each network (limited to first 10 networks to avoid performance issues)
      const devicesToExport = filteredNetworks.slice(0, 10);
      
      for (const network of devicesToExport) {
        // Fetch bandwidth data for this network
        try {
          const response = await axios.get(`http://localhost:8005/api/networks/${network.id}/bandwidth?limit=100`);
          
          if (response.status === 200) {
            const data = response.data;
            
            // Filter by date range
            const filteredData = data.filter(item => {
              if (!item.created_at) return false;
              
              const itemDate = new Date(item.created_at);
              const startDate = new Date(dateRange.startDate);
              const endDate = new Date(dateRange.endDate);
              endDate.setHours(23, 59, 59);
              
              return itemDate >= startDate && itemDate <= endDate;
            });
            
            // Create worksheet for this device
            const deviceData = filteredData.map(item => ({
              'Upload (bytes)': item.upload,
              'Upload': formatBytes(item.upload),
              'Download (bytes)': item.download,
              'Download': formatBytes(item.download),
              'Created At': formatDate(item.created_at)
            }));
            
            if (deviceData.length > 0) {
              const deviceSheet = XLSX.utils.json_to_sheet(deviceData);
              // Excel sheet names limited to 31 chars
              XLSX.utils.book_append_sheet(workbook, deviceSheet, network.hostname.substring(0, 31));
            }
          }
        } catch (error) {
          console.error(`Error fetching data for ${network.hostname}:`, error);
        }
      }
    }
    
    // Export the workbook
    XLSX.writeFile(workbook, 'network_monitoring_data.xlsx');
  };
  
  return (
    <div className="flex flex-row overflow-hidden gap-20 bg-gray-50 w-full">
      <Sidebar />
    <div className="bg-gray-50 h-screen w-full px-20 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 py-4 px-6 shadow-md flex-shrink-0">
        <h1 className="text-white text-2xl font-bold">Network Monitoring Logs</h1>
        <p className="text-blue-100 mt-1">View and analyze network traffic data</p>
      </div>
      
      {/* Main Content */}
      <div className="flex-grow overflow-hidden flex flex-col">
        
        {/* Filter Bar */}
        <div className="bg-white shadow-md p-4 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-grow max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by hostname, IP, or MAC..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                  />
                </div>
                <span className="mx-2 text-gray-500">to</span>
                <input
                  type="date"
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                />
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleRefresh}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
                <button 
                  onClick={exportToExcel}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export to Excel
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-4 my-2 rounded-md flex-shrink-0">
            <p>{error}</p>
          </div>
        )}
        
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Networks</h3>
            <p className="text-3xl font-bold text-blue-600">{networks.length}</p>
            <p className="text-sm text-gray-500 mt-2">Available in range: {filteredNetworks.length}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Upload</h3>
            <p className="text-3xl font-bold text-green-600">{formatBytes(totalUpload)}</p>
            <p className="text-sm text-gray-500 mt-2">For {selectedNetwork ? selectedNetwork.hostname : 'all networks'}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Download</h3>
            <p className="text-3xl font-bold text-purple-600">{formatBytes(totalDownload)}</p>
            <p className="text-sm text-gray-500 mt-2">For {selectedNetwork ? selectedNetwork.hostname : 'all networks'}</p>
          </div>
        </div>
        
        {/* Main Content Area - Flexbox for responsive layout */}
        <div className="flex-grow overflow-hidden flex flex-col lg:flex-row gap-4 p-4">
          {/* Networks Table */}
          <div className="w-full lg:w-2/3 flex flex-col overflow-hidden">
            <div className="bg-white rounded-lg shadow-md flex flex-col h-full overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-800">Networks</h2>
                <div className="text-sm text-gray-500">
                  Showing {Math.min(filteredNetworks.length, indexOfFirstItem + 1)} to {Math.min(indexOfLastItem, filteredNetworks.length)} of {filteredNetworks.length}
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center flex-grow">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
                </div>
              ) : (
                <div className="flex flex-col flex-grow overflow-hidden">
                  <div className="overflow-auto flex-grow">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hostname</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Traffic</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentNetworks.length > 0 ? (
                          currentNetworks.map((network) => (
                            <tr 
                              key={network.id} 
                              onClick={() => handleNetworkSelect(network)}
                              className={`hover:bg-blue-50 cursor-pointer transition ${selectedNetwork && selectedNetwork.id === network.id ? 'bg-blue-50' : ''}`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{network.hostname}</div>
                                <div className="text-xs text-gray-500">{network.mac_address}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{network.ip_address}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  network.status === 'active' ? 'bg-green-100 text-green-800' : 
                                  network.status === 'inactive' ? 'bg-red-100 text-red-800' : 
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {network.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(network.updated_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {formatBytes(network.total_upload + network.total_download)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  <span className="text-green-600">↑ {formatBytes(network.total_upload)}</span> / 
                                  <span className="text-purple-600"> ↓ {formatBytes(network.total_download)}</span>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                              No networks found matching your criteria
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
                      <div>
                        <p className="text-sm text-gray-700">
                          Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                        </p>
                      </div>
                      <div className="flex-1 flex justify-end">
                        <button
                          onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                            currentPage === 1 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-700 bg-white hover:bg-gray-50'
                          } mr-3`}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                            currentPage === totalPages 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-700 bg-white hover:bg-gray-50'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Bandwidth Details */}
          <div className="w-full lg:w-1/3 h-full">
            <div className="bg-white rounded-lg shadow-md h-full flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-800">
                  {selectedNetwork ? `${selectedNetwork.hostname} Details` : 'Network Details'}
                </h2>
              </div>
              
              <div className="p-6 overflow-auto flex-grow">
                {selectedNetwork ? (
                  <div className="h-full flex flex-col">
                    <div className="mb-6 flex-shrink-0">
                      <h3 className="text-lg font-medium text-gray-700 mb-2">Device Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">IP Address</p>
                          <p className="text-base font-medium">{selectedNetwork.ip_address}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">MAC Address</p>
                          <p className="text-base font-medium">{selectedNetwork.mac_address}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Device Type</p>
                          <p className="text-base font-medium">{selectedNetwork.device_type || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Status</p>
                          <p className="text-base font-medium">
                            <span className={`px-2 py-1 text-xs leading-none font-semibold rounded-full ${
                              selectedNetwork.status === 'active' ? 'bg-green-100 text-green-800' : 
                              selectedNetwork.status === 'inactive' ? 'bg-red-100 text-red-800' : 
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {selectedNetwork.status}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-grow flex flex-col overflow-hidden">
                      <h3 className="text-lg font-medium text-gray-700 mb-2 flex-shrink-0">Bandwidth Activity</h3>
                      {loading ? (
                        <div className="flex justify-center items-center flex-grow">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                        </div>
                      ) : bandwidthData.length > 0 ? (
                        <div className="space-y-4 flex flex-col overflow-hidden">
                          <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                            <div className="bg-green-50 p-4 rounded-lg">
                              <p className="text-sm text-green-600">Total Upload</p>
                              <p className="text-xl font-bold text-green-700">{formatBytes(totalUpload)}</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <p className="text-sm text-purple-600">Total Download</p>
                              <p className="text-xl font-bold text-purple-700">{formatBytes(totalDownload)}</p>
                            </div>
                          </div>
                          
                          <div className="flex-grow overflow-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upload</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Download</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {bandwidthData.map((item, index) => {
                                  const itemDate = new Date(item.created_at);
                                  const startDate = new Date(dateRange.startDate);
                                  const endDate = new Date(dateRange.endDate);
                                  endDate.setHours(23, 59, 59);
                                  
                                  if (itemDate >= startDate && itemDate <= endDate) {
                                    return (
                                      <tr key={index}>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                          {formatDate(item.created_at)}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-green-600">
                                          {formatBytes(item.upload)}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-purple-600">
                                          {formatBytes(item.download)}
                                        </td>
                                      </tr>
                                    );
                                  }
                                  return null;
                                }).filter(Boolean)}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 flex-grow flex items-center justify-center">
                          <p>No bandwidth data available for this device in the selected date range.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 h-full flex items-center justify-center">
                    <div>
                      <Filter className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-lg">Select a network from the table to view detailed bandwidth information.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Logs;