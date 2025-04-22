import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/index/Home";
import Dashboard from "./pages/dashboard/main";
import ConnectedDevices from "./pages/dashboard/ConnectedDevices";
import NetworkStatus from "./pages/dashboard/NetworkStatus";
import BandwidthUsage from "./pages/dashboard/BandWidthUsage";
import MacFiltering from "./pages/dashboard/MacFiltering";
import Logs from "./pages/dashboard/Logs";
import Notification from "./pages/dashboard/Notification";



const App = () => {
    return (
        <div style={{ display: "flex", height: "100vh" }}>
            <Routes>
                {/* Home Page */}
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/connected-devices" element={<ConnectedDevices />} />
                <Route path="/network-status" element={<NetworkStatus />} />
                <Route path="/bandwidth-usage" element={<BandwidthUsage />} />
                <Route path="/mac-filtering" element={<MacFiltering />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/notifications" element={<Notification />} />
                {/* <Route path="/notifications" element={<Notifications />} />
                <Route path="/logs" element={<Logs />} /> */}
            </Routes>
        </div>
    );
};

export default App;
