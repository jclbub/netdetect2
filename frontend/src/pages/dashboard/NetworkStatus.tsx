import React from "react";
import useFetch from "../../hooks/fetch.js";
import { Network, Globe, Laptop, RefreshCw } from "lucide-react";
import Sidebar from "../../components/Sidebar.js";

const NetworkStatus = () => {
  const { data, loading, error, refetch } = useFetch('network-info');
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br w-full from-indigo-50 to-gray-100 overflow-hidden flex flex-row gap-20">

    <Sidebar />

    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Network Status</h1>
        <button 
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 p-4 rounded-md text-red-700 mb-4">
          <p className="font-medium">Error loading network data</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <Laptop className="text-blue-500" size={24} />
              <h2 className="text-lg font-semibold">Local Network</h2>
            </div>
            <div className="space-y-4">
              <div className="group">
                <p className="text-sm text-gray-500">Local IP Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg">{data.local_ip}</p>
                  <button 
                    onClick={() => copyToClipboard(data.local_ip)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gray-100 rounded hover:bg-gray-200"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="group">
                <p className="text-sm text-gray-500">MAC Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg">{data.mac_address}</p>
                  <button 
                    onClick={() => copyToClipboard(data.mac_address)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gray-100 rounded hover:bg-gray-200"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="group">
                <p className="text-sm text-gray-500">Loopback Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg">{data.loopback_ip}</p>
                  <button 
                    onClick={() => copyToClipboard(data.loopback_ip)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gray-100 rounded hover:bg-gray-200"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="text-green-500" size={24} />
              <h2 className="text-lg font-semibold">Internet Connection</h2>
            </div>
            <div className="space-y-4">
              <div className="group">
                <p className="text-sm text-gray-500">External IP Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg">{data.external_ip}</p>
                  <button 
                    onClick={() => copyToClipboard(data.external_ip)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gray-100 rounded hover:bg-gray-200"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm text-gray-500">Connection Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-3 w-3 bg-green-500 rounded-full"></span>
                  <p className="font-medium">Connected</p>
                </div>
              </div>
              
              <div className="mt-4">
                <button 
                  onClick={() => window.open(`https://whatismyipaddress.com/ip/${data.external_ip}`, '_blank')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <Network size={16} />
                  Check IP Details
                </button>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-lg font-semibold mb-4">Network Information</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">Type</th>
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">Value</th>
                    <th className="py-2 px-4 text-left text-sm font-medium text-gray-500">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="py-2 px-4 text-sm">Local IP</td>
                    <td className="py-2 px-4 font-mono text-sm">{data.local_ip}</td>
                    <td className="py-2 px-4 text-sm text-gray-500">Your device's address on the local network</td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4 text-sm">External IP</td>
                    <td className="py-2 px-4 font-mono text-sm">{data.external_ip}</td>
                    <td className="py-2 px-4 text-sm text-gray-500">Your public IP address visible to websites</td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4 text-sm">MAC Address</td>
                    <td className="py-2 px-4 font-mono text-sm">{data.mac_address}</td>
                    <td className="py-2 px-4 text-sm text-gray-500">Physical address of your network interface</td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4 text-sm">Loopback IP</td>
                    <td className="py-2 px-4 font-mono text-sm">{data.loopback_ip}</td>
                    <td className="py-2 px-4 text-sm text-gray-500">Internal IP used for local services</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 text-sm text-gray-500">
        <p>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
    </div>
  );
};

export default NetworkStatus;