import React, { useState } from "react";

function LoginModal({ isOpen, onClose }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const API_URL = import.meta.env.VITE_apiUrl;

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		try {
			const response = await fetch(`${API_URL}/auth/jwt/create/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, password }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					errorData?.non_field_errors?.[0] || "Invalid credentials"
				);
			}

			const data = await response.json();

			// Save tokens (access and refresh) to localStorage or cookies
			localStorage.setItem("accessToken", data.access);
			localStorage.setItem("refreshToken", data.refresh);
			window.location.replace("/");

			onClose();
		} catch (err) {
			setError(err.message || "An error occurred");
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<div className="bg-white w-[90%] max-w-md rounded-lg shadow-lg p-6">
				<h2 className="text-2xl font-bold text-center mb-4">Sign In</h2>
				{error && (
					<p className="text-red-500 text-sm text-center mb-4">{error}</p>
				)}
				<form onSubmit={handleSubmit}>
					<div className="mb-4">
						<label
							htmlFor="email"
							className="block text-gray-700 font-medium mb-2"
						>
							Email
						</label>
						<input
							type="email"
							id="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
							placeholder="Enter your email"
							required
						/>
					</div>
					<div className="mb-4">
						<label
							htmlFor="password"
							className="block text-gray-700 font-medium mb-2"
						>
							Password
						</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
							placeholder="Enter your password"
							required
						/>
					</div>
					<button
						type="submit"
						className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-300"
					>
						Sign In
					</button>
				</form>
				<button
					onClick={onClose}
					className="mt-4 w-full text-gray-600 hover:text-gray-900"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

export default LoginModal;
