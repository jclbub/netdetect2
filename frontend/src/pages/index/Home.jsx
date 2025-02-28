import React, { useState } from "react";
import Footer from "./components/Footer";
import { Cobe } from "./components/Cobe";
import TypingEffect from "./components/TypingEffect";
import Navbar from "./components/Navbar";
import FeaturesBenefitsSection from "./components/FeaturesBenefitsSection";
import { auth } from "../auth/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

function Home() {
	const [showModal, setShowModal] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLogin, setIsLogin] = useState(true);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const googleProvider = new GoogleAuthProvider();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		
		try {
			if (isLogin) {
				await signInWithEmailAndPassword(auth, email, password);
				window.location.href = "/DASHBOARD";
			} else {
				await createUserWithEmailAndPassword(auth, email, password);
				window.location.href = "/DASHBOARD";
			}
		} catch (error) {
			console.error("Authentication error:", error);
			setError(error.message);
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleSignIn = async () => {
		setError("");
		setLoading(true);
		
		try {
			await signInWithPopup(auth, googleProvider);
			window.location.href = "/DASHBOARD";
		} catch (error) {
			console.error("Google sign-in error:", error);
			setError(error.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-col w-full">
			<Navbar login={() => setShowModal(true)} />
			<section
				id="home"
				className="home flex flex-col md:flex-row items-center h-screen px-6 md:px-[10%] py-[5%] bg-gradient-to-br from-blue-200 via-white to-blue-100 relative"
			>
				{/* Column 1 */}
				<div className="column1 flex flex-col items-center md:items-start justify-center h-full w-full md:w-[50%] space-y-6 text-center md:text-left">
					<h1 className="text-[2.5rem] md:text-[5.5rem] font-extrabold text-gray-800 leading-tight md:leading-[5.5rem] mb-4 tracking-tight">
						Protect your <br />
						<TypingEffect />
					</h1>
					<p className="text-sm md:text-lg text-gray-600 mt-2 max-w-md leading-relaxed">
						Easy network management with AI analysis and user monitoring to
						secure your infrastructure.
					</p>
					<button 
						className="bg-gradient-to-r from-blue-500 to-blue-700 text-white py-2 px-6 md:py-3 md:px-8 rounded-2xl shadow-lg transform hover:scale-105 transition duration-300 ease-in-out hover:shadow-xl animate-shine"
						onClick={() => setShowModal(true)}
					>
						Login
					</button>
				</div>

				{/* Column 2 */}
				<div className="column2 relative h-full w-full md:w-[50%] flex items-center justify-center">
					<Cobe />
					<div className="select-none absolute bottom-0 right-0 mb-4 md:mb-8 mr-2 md:mr-4 text-right text-sm md:text-[1rem] text-gray-600">
						Secure all networks in all places
					</div>
					<div className="absolute top-1/3 md:top-1/4 right-1/3 md:right-1/4 w-[150px] md:w-[300px] h-[150px] md:h-[300px] bg-blue-200 rounded-full opacity-40 blur-xl animate-pulse"></div>
				</div>
			</section>

			{/* Login Modal */}
			{showModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
					<div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden transform transition-all animate-slideIn">
						{/* Modal Header with Logo */}
						<div className="bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-4 text-white relative">
							<h3 className="text-xl font-bold">{isLogin ? "Log In" : "Sign Up"}</h3>
							<button 
								className="absolute top-4 right-4 text-white hover:text-gray-200"
								onClick={() => setShowModal(false)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						{/* Modal Body */}
						<div className="p-6">
							{error && (
								<div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
									{error}
								</div>
							)}

							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
										Email
									</label>
									<input
										type="email"
										id="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
										placeholder="Enter your email"
										required
									/>
								</div>
								<div>
									<label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
										Password
									</label>
									<input
										type="password"
										id="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
										placeholder="Enter your password"
										required
									/>
								</div>

								{isLogin && (
									<div className="text-right">
										<a href="#" className="text-sm text-blue-600 hover:underline">
											Forgot password?
										</a>
									</div>
								)}

								<button
									type="submit"
									disabled={loading}
									className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium"
								>
									{loading ? (
										<span className="flex items-center justify-center">
											<svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
												<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											Processing...
										</span>
									) : isLogin ? "Log In" : "Sign Up"}
								</button>
							</form>

							<div className="mt-6">
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<div className="w-full border-t border-gray-300"></div>
									</div>
									<div className="relative flex justify-center text-sm">
										<span className="px-2 bg-white text-gray-500">Or continue with</span>
									</div>
								</div>

								<div className="mt-4">
									<button
										type="button"
										onClick={handleGoogleSignIn}
										disabled={loading}
										className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
									>
										<svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
											<g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
												<path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
												<path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
												<path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
												<path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
											</g>
										</svg>
										Google
									</button>
								</div>
							</div>

							<div className="mt-6 text-center">
								<button
									type="button"
									className="text-sm text-blue-600 hover:underline"
									onClick={() => setIsLogin(!isLogin)}
								>
									{isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
			
			<FeaturesBenefitsSection />


			{/* <Footer /> */}
			
			{/* Add these animation classes to your global CSS or tailwind config */}
			<style jsx>{`
				@keyframes fadeIn {
					from { opacity: 0; }
					to { opacity: 1; }
				}
				@keyframes slideIn {
					from { transform: translateY(-50px); opacity: 0; }
					to { transform: translateY(0); opacity: 1; }
				}
				.animate-fadeIn {
					animation: fadeIn 0.3s ease-out;
				}
				.animate-slideIn {
					animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
				}
				@keyframes shine {
					0% {
						background-position: 0% 50%;
					}
					50% {
						background-position: 100% 50%;
					}
					100% {
						background-position: 0% 50%;
					}
				}
				.animate-shine {
					background-size: 200% auto;
					animation: shine 3s linear infinite;
				}
			`}</style>
		</div>
	);
}

export default Home;