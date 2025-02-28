import React from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/index/Home";
import Dashboard from "./pages/dashboard/main";
import ConnectedDevices from "./pages/dashboard/ConnectedDevices";
import NetworkStatus from "./pages/dashboard/NetworkStatus";
import BandwidthUsage from "./pages/dashboard/BandWidthUsage";

const App = () => {
    return (
        <div style={{ display: "flex", height: "100vh" }}>
            <Routes>
                {/* Home Page */}
                <Route path="/" element={<Home />} />

                {/* Dashboard Layout with Sidebar */}
                <Route path="/dashboard/*" element={<DashboardLayout />} />
            </Routes>
        </div>
    );
};

// Wrapper for Dashboard Pages
const DashboardLayout = () => {
    return (
        <>
            <Sidebar />
            <div style={{ marginLeft: "20px", flexGrow: 1 }}>
                <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="network-status" element={<NetworkStatus />} />
                    <Route path="connected-devices" element={<ConnectedDevices />} />
                    <Route path="bandwidth-usage" element={<BandwidthUsage />} />
                </Routes>
            </div>
        </>
    );
};

export default App;
