import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";

const ContactUs = () => {
	return (
		<>
			<Navbar />
			<div className="bg-gradient-to-b from-purple-500 to-blue-500 min-h-[800px] flex items-center justify-center">
				<div className="max-w-md w-full p-8 bg-white shadow-lg rounded-lg">
					<h2 className="text-3xl font-bold text-center text-purple-700 mb-6">
						Contact Us
					</h2>
					<p className="text-center text-gray-600 mb-6">
						Got a question? We’d love to hear from you. Send us a message and
						we’ll respond as soon as possible.
					</p>

					<div>
						<div className="mb-4">
							<label
								htmlFor="name"
								className="block text-sm font-medium text-gray-700"
							>
								Name*
							</label>
							<input
								type="text"
								id="from_name"
								name="from_name"
								className="w-full p-3 border border-gray-300 rounded-md mt-2 bg-white text-black"
								required
							/>
						</div>
						<div className="mb-4">
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700"
							>
								Email address*
							</label>
							<input
								type="email"
								id="from_email"
								name="from_email"
								className="w-full p-3 border border-gray-300 rounded-md mt-2 bg-white text-black"
								required
							/>
						</div>
						<div className="mb-6">
							<label
								htmlFor="message"
								className="block text-sm font-medium text-gray-700"
							>
								Message
							</label>
							<textarea
								id="message"
								name="message"
								rows="5"
								className="w-full p-3 border border-gray-300 rounded-md mt-2 bg-white text-black"
							/>
						</div>
						<button className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200">
							Send Message
						</button>
					</div>
				</div>
			</div>
		</>
	);
};

export default ContactUs;
