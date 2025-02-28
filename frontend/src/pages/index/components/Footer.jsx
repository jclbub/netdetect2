import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNetworkWired, faChartLine, faShieldAlt } from '@fortawesome/free-solid-svg-icons';

function Footer() {
    return (
        <footer className="footer bg-gradient-to-br from-blue-900 to-slate-800 text-white py-16 px-6 sm:px-16 lg:px-32 w-full">
            <div className="container mx-auto flex flex-col sm:flex-row justify-between gap-8 sm:gap-16">
                
                <div className="w-full sm:w-1/3">
                    <div className="flex items-center gap-3 mb-4">
                        <FontAwesomeIcon icon={faNetworkWired} className="text-blue-400 text-3xl" />
                        <p className="text-lg sm:text-xl font-semibold">Network Management with AI</p>
                    </div>
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                        Easy network management with AI analysis and user monitoring for enhanced security.
                    </p>
                </div>

                <div className="w-full sm:w-1/3">
                    <div className="flex items-center gap-3 mb-4">
                        <FontAwesomeIcon icon={faChartLine} className="text-blue-400 text-3xl" />
                        <p className="text-lg sm:text-xl font-semibold">Usage Analytics & Scalability</p>
                    </div>
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                        Get insights with Usage Analytics, detect issues with Anomaly Detection, and scale your network effortlessly.
                    </p>
                </div>

                <div className="w-full sm:w-1/3">
                    <div className="flex items-center gap-3 mb-4">
                        <FontAwesomeIcon icon={faShieldAlt} className="text-blue-400 text-3xl" />
                        <p className="text-lg sm:text-xl font-semibold">Security Features</p>
                    </div>
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                        Protect your network with Intrusion Detection and Automated Threat Response for robust security.
                    </p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
