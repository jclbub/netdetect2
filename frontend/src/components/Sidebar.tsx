import React, { useState, useEffect } from 'react';
import { 
    FaTachometerAlt, FaNetworkWired, FaMobileAlt, FaChartLine, 
    FaFilter, FaBell, FaClipboardList, FaSignOutAlt, FaBars, FaTimes 
} from 'react-icons/fa';
import { auth } from "../pages/auth/firebase";
import { signOut } from 'firebase/auth';
import axios from 'axios';
import image from '../../public/a35.jpg';

const Sidebar = () => {
    const [active, setActive] = useState('Dashboard');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState(() => {
        // Initialize from localStorage if available
        const saved = localStorage.getItem('lastCheckedNotifications');
        return saved ? new Date(saved).toISOString() : new Date().toISOString();
    });

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const menuItems = [ 
        { name: "Dashboard", route: "dashboard", icon: <FaTachometerAlt /> },
        { name: "Network Status", route: "network-status", icon: <FaNetworkWired /> },
        { name: "Connected Devices", route: "connected-devices", icon: <FaMobileAlt /> },
        { name: "Bandwidth Usage", route: "bandwidth-usage", icon: <FaChartLine /> },
        { name: "Mac Filtering", route: "mac-filtering", icon: <FaFilter /> },
        { 
            name: "Notifications", 
            route: "notifications", 
            icon: <FaBell />,
            hasBadge: unreadNotifications > 0,
            badgeCount: unreadNotifications
        },
        { name: "Logs", route: "logs", icon: <FaClipboardList /> }
    ];

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            await signOut(auth);
            console.log("User logged out successfully");
            window.location.href = "/";
        } catch (error) {
            console.error("Error logging out:", error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const onComponentChange = (route) => {
        console.log(route);
        
        // If navigating to notifications, update the last checked timestamp
        if (route === "notifications") {
            const now = new Date().toISOString();
            setLastCheckedTimestamp(now);
            localStorage.setItem('lastCheckedNotifications', now);
            setUnreadNotifications(0);
        }
        
        window.location.href = `/${route}`;
    };

    // Fetch notifications and check for new ones
    const checkForNewNotifications = async () => {
        try {
            const response = await axios.get('http://localhost:8005/api/notifications');

            console.log(response.data)
            
            // Count notifications that came after the last checked timestamp
            const newNotifications = response.data.filter(
                notification => new Date(notification.created_at) > new Date(lastCheckedTimestamp)
            );
            
            setUnreadNotifications(newNotifications.length);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    // Setup polling for new notifications
    useEffect(() => {
        // Initial check
        checkForNewNotifications();
        
        // Poll for new notifications every 30 seconds
        const intervalId = setInterval(checkForNewNotifications, 30000);
        
        // Clean up on unmount
        return () => clearInterval(intervalId);
    }, [lastCheckedTimestamp]);

    useEffect(() => {
        const currentRoute = window.location.pathname.replace('/', '');
        const activeItem = menuItems.find(item => item.route === currentRoute);
        if (activeItem) {
            setActive(activeItem.name);
            
            // If on notifications page, reset the unread count and update last checked time
            if (currentRoute === "notifications") {
                const now = new Date().toISOString();
                setLastCheckedTimestamp(now);
                localStorage.setItem('lastCheckedNotifications', now);
                setUnreadNotifications(0);
            }
        }
    }, [menuItems]);

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            <button className='toggle-button' onClick={toggleSidebar}>
                {isOpen ? <FaTimes /> : <FaBars />}
            </button>
            <div className='sidebar-content'>
                <h2 className="text-2xl font-bold mb-8 text-center tracking-wide text-gray-700">NetDetect</h2>
                <ul className="space-y-2 h-[60vh]">
                    {menuItems.map((item) => (
                        <li 
                            key={item.name} 
                            onClick={() => {
                                setActive(item.name);
                                onComponentChange(item.route);
                            }}
                            className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                                active === item.name 
                                    ? "bg-gray-300 text-gray-900 font-medium shadow-sm"
                                    : "hover:bg-gray-50 text-gray-600"
                            }`}
                        >
                            <span className="mr-3 text-lg text-gray-500 relative">
                                {item.icon}
                                {/* Notification badge */}
                                {item.hasBadge && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                                        {item.badgeCount > 9 ? '9+' : item.badgeCount}
                                    </span>
                                )}
                            </span> 
                            {item.name}
                        </li>
                    ))}
                </ul>
                <div className="flex flex-col items-center mt-6">
                    <img 
                        src={image}
                        alt="Profile" 
                        className="w-16 h-16 rounded-full mb-2 border border-gray-300 shadow-sm"
                    />
                    <span className="text-sm font-semibold text-gray-700">Joel</span>
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
        </div>
    );
};

export default Sidebar;