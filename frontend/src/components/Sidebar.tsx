import React, { useState } from 'react';
import { 
    FaTachometerAlt, FaNetworkWired, FaMobileAlt, FaChartLine, 
    FaFilter, FaBell, FaClipboardList, FaSignOutAlt 
} from 'react-icons/fa';
import { auth } from "../pages/auth/firebase";
import { signOut } from 'firebase/auth';

const Sidebar = ({ onComponentChange }) => {
    const [active, setActive] = useState('Dashboard'); // Track active menu
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const menuItems = [
        { name: "Dashboard", icon: <FaTachometerAlt /> },
        { name: "Network Status", icon: <FaNetworkWired /> },
        { name: "Connected Devices", icon: <FaMobileAlt /> },
        { name: "Bandwidth Usage", icon: <FaChartLine /> },
        { name: "Mac Filtering", icon: <FaFilter /> },
        { name: "Notifications", icon: <FaBell /> },
        { name: "Logs", icon: <FaClipboardList /> }
    ];

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            await signOut(auth);
            console.log("User logged out successfully");
           window.location.href = "/"
        } catch (error) {
            console.error("Error logging out:", error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="w-[16%] bg-white text-gray-800 p-6 h-screen shadow-md flex flex-col justify-between border-r border-gray-200">
            {/* Logo / Brand */}
            <h2 className="text-2xl font-bold mb-8 text-center tracking-wide text-gray-700">NetDetect</h2>

            {/* Menu List */}
            <ul className="space-y-2 h-[60vh]">
                {menuItems.map((item) => (
                    <li 
                        key={item.name} 
                        onClick={() => {
                            setActive(item.name);
                            onComponentChange(item.name); // Call the prop to change the component
                        }}
                        className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                            active === item.name 
                                ? "bg-gray-100 text-gray-900 font-medium shadow-sm"
                                : "hover:bg-gray-50 text-gray-600"
                        }`}
                    >
                        <span className="mr-3 text-lg text-gray-500">{item.icon}</span> 
                        {item.name}
                    </li>
                ))}
            </ul>

            {/* Profile & Logout */}
            <div className="flex flex-col items-center mt-6">
                <img 
                    src="path_to_your_profile_image.jpg" 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full mb-2 border border-gray-300 shadow-sm"
                />
                <span className="text-sm font-semibold text-gray-700">User Name</span>
                <button 
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center text-red-500 hover:text-red-600 mt-3 transition-all duration-300"
                >
                    <FaSignOutAlt className="mr-2" /> 
                    {isLoggingOut ? "Logging out..." : "Log Out"}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;