import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faHome,
	faInfoCircle,
	faPhone,
	faSignInAlt,
	faSignOutAlt,
	faBars,
	faTimes,
} from "@fortawesome/free-solid-svg-icons";
// import LoginModal from "../../auth/LoginModal"; // Adjust the path as necessary

function Navbar({login}) {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

	const toggleMobileMenu = () => {
		setIsMobileMenuOpen((prev) => !prev);
	};

	const handleLoginOpen = () => {
		setIsLoginModalOpen(true);
		login()
	};

	const handleLoginClose = () => {
		setIsLoginModalOpen(false);
	};

	return (
		<>
			<nav className="fixed top-0 left-0 w-full bg-white shadow-md text-[#285FF8] flex justify-between items-center z-10 px-6 py-4 lg:px-10 transition-all duration-300">
				<div className="logo text-[1.5rem] font-semibold tracking-tight text-[#285FF8] hover:text-blue-700 transition duration-300">
					NetDetect
				</div>

				{/* Hamburger Menu for Mobile */}
				<div className="lg:hidden">
					<button
						aria-label="Toggle menu"
						onClick={toggleMobileMenu}
						className="text-[#285FF8] focus:outline-none text-2xl"
					>
						<FontAwesomeIcon icon={isMobileMenuOpen ? faTimes : faBars} />
					</button>
				</div>

				{/* Navigation Links */}
				<ul
					className={`${
						isMobileMenuOpen ? "block" : "hidden"
					} lg:flex lg:gap-[5rem] items-center absolute lg:static bg-white w-full lg:w-auto left-0 top-[4.5rem] lg:top-auto px-6 py-4 lg:p-0 shadow-md lg:shadow-none transition-all duration-300 ease-in-out`}
				>
					<li className="py-2 lg:py-0">
						<Link
							to="/"
							className="flex items-center gap-4 text-[1.1rem] hover:text-[#1d4ed8] transition duration-300 relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-[#1d4ed8] hover:after:w-full after:transition-width after:duration-500"
						>
							<FontAwesomeIcon icon={faHome} />
							Home
						</Link>
					</li>
					<li className="py-2 lg:py-0">
						<Link
							to="/about"
							className="flex items-center gap-4 text-[1.1rem] hover:text-[#1d4ed8] transition duration-300 relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-[#1d4ed8] hover:after:w-full after:transition-width after:duration-500"
						>
							<FontAwesomeIcon icon={faInfoCircle} />
							About Us
						</Link>
					</li>
					<li className="py-2 lg:py-0">
						<Link
							to="/contact"
							className="flex items-center gap-4 text-[1.1rem] hover:text-[#1d4ed8] transition duration-300 relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-[#1d4ed8] hover:after:w-full after:transition-width after:duration-500"
						>
							<FontAwesomeIcon icon={faPhone} />
							Contact
						</Link>
					</li>

					{/* Buttons for Mobile */}
					{isMobileMenuOpen && (
						<li className="py-2 lg:py-0">
							<button
								onClick={handleLoginOpen}
								className="flex items-center gap-2 py-2 px-4 rounded-lg text-[1rem] text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 transition duration-300 shadow-md hover:shadow-lg w-full"
							>
								<FontAwesomeIcon icon={faSignInAlt} />
								Sign In
							</button>
						</li>
					)}
				</ul>

				{/* Buttons for Desktop */}
				<div className="hidden lg:flex gap-4">
					<button
						onClick={handleLoginOpen}
						className="flex items-center gap-2 py-2 px-6 rounded-xl text-[1rem] text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 transition duration-300 shadow-md hover:shadow-lg"
					>
						<FontAwesomeIcon icon={faSignInAlt} />
						Sign In
					</button>
				</div>
			</nav>

			{/* Login Modal
			<LoginModal isOpen={isLoginModalOpen} onClose={handleLoginClose} /> */}
		</>
	);
}

export default Navbar;
