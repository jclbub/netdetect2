import React, { useState } from 'react';
import { FaShieldAlt, FaTools, FaBrain, FaChartLine, FaUsers, FaLightbulb, FaPaperPlane } from 'react-icons/fa';
import { motion } from 'framer-motion';
import emailjs from "@emailjs/browser";

const FeaturesBenefitsSection = () => {
  const [formData, setFormData] = useState({
    name: '',
    message: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    // Use your actual Email.js credentials
    const serviceID = "service_ib6fkmg"; // Your Email.js service ID
    const templateID = "template_gbrh41h"; // Your Email.js template ID
    const publicKey = "hX7G882Bp5zqBc6Zo"; // Your Email.js public key

    try {
      // Send email using Email.js.
      // This sends the formData, so your email template should have {{name}}, {{email}}, and {{message}}.
      await emailjs.send(serviceID, templateID, formData, publicKey);
      setSuccessMessage("Your message has been sent successfully!");
      setFormData({ name: "", email: "", message: "" });
    } catch (error) {
      setErrorMessage("Failed to send message. Please try again later.");
      console.error("Email.js Error:", error);
    }

    setLoading(false);
  };

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};
  return (
    <div className="w-full bg-gradient-to-b from-gray-50 to-white text-gray-800">
      {/* Hero Section */}
      <div className="container mx-auto px-6 pt-20 pb-16 text-center">
        <motion.h1 
          className="text-4xl md:text-5xl font-bold text-blue-700 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          NetDetect
        </motion.h1>
        <motion.p 
          className="text-xl text-gray-600 max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          Advanced network monitoring and security for educational institutions
        </motion.p>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-6 mb-20">
        <div className="relative mb-16">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-6 text-3xl md:text-4xl font-bold text-blue-600">Features</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Feature 1 */}
          <motion.div 
            className="bg-white rounded-xl shadow-lg p-8 transform hover:scale-105 transition duration-300 border-t-4 border-blue-500"
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            style={{ minHeight: '100px' }}
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-700 p-4 rounded-full mb-6 text-white w-16 h-16 flex items-center justify-center mx-auto">
              <FaShieldAlt className="text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-blue-600 mb-4 text-center">Advanced Threat Detection</h3>
            <p className="text-gray-600 text-center">
              AI-powered detection identifies and blocks suspicious activity before damage occurs, keeping your network safe 24/7.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div 
            className="bg-white rounded-xl shadow-lg p-8 transform hover:scale-105 transition duration-300 border-t-4 border-blue-500"
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            transition={{ delay: 0.2 }}
            style={{ minHeight: '100px' }}
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-700 p-4 rounded-full mb-6 text-white w-16 h-16 flex items-center justify-center mx-auto">
              <FaTools className="text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-blue-600 mb-4 text-center">Automated Responses</h3>
            <p className="text-gray-600 text-center">
              Configure automatic actions when threats are detected to minimize response time and prevent data breaches.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div 
            className="bg-white rounded-xl shadow-lg p-8 transform hover:scale-105 transition duration-300 border-t-4 border-blue-500"
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            transition={{ delay: 0.4 }}
            style={{ minHeight: '100px' }}
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-700 p-4 rounded-full mb-6 text-white w-16 h-16 flex items-center justify-center mx-auto">
              <FaBrain className="text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-blue-600 mb-4 text-center">Intelligent Analysis</h3>
            <p className="text-gray-600 text-center">
              Deep learning algorithms analyze network patterns to identify anomalies and predict potential security threats.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Benefits Section with curved background */}
      <div className="relative bg-blue-50 py-24">
        
        <div className="container mx-auto px-6">
          <div className="relative">
            <div className="absolute flex items-center">
              <div className="w-full border-t border-blue-100"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-blue-50 px-6 text-3xl md:text-4xl font-bold text-blue-600 mb-10">Benefits</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-2 gap-12">
            {/* Benefit 1 */}
            <motion.div 
              className="flex items-start bg-white p-6 rounded-lg shadow-md"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              style={{ minHeight: '100px' }}
            >
              <div className="text-green-500 mr-4 mt-1 bg-green-100 p-2 rounded-full">
                <FaChartLine className="text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Complete Visibility</h3>
                <p className="text-gray-600">
                  Gain comprehensive insight into all connected devices and their activity across your entire network infrastructure with intuitive dashboards.
                </p>
              </div>
            </motion.div>

            {/* Benefit 2 */}
            <motion.div 
              className="flex items-start bg-white p-6 rounded-lg shadow-md"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.2 }}
              style={{ minHeight: '100px' }}
            >
              <div className="text-green-500 mr-4 mt-1 bg-green-100 p-2 rounded-full">
                <FaLightbulb className="text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Reduced Response Time</h3>
                <p className="text-gray-600">
                  Automated detection and response capabilities reduce the time between threat identification and mitigation by up to 95%.
                </p>
              </div>
            </motion.div>

            {/* Benefit 3 */}
            <motion.div 
              className="flex items-start bg-white p-6 rounded-lg shadow-md"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.3 }}
              style={{ minHeight: '100px' }}
            >
              <div className="text-green-500 mr-4 mt-1 bg-green-100 p-2 rounded-full">
                <FaChartLine className="text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Lower Operational Costs</h3>
                <p className="text-gray-600">
                  Minimize the need for manual monitoring and reduce IT overhead costs while improving security outcomes and resource allocation.
                </p>
              </div>
            </motion.div>

            {/* Benefit 4 */}
            <motion.div 
              className="flex items-start bg-white p-6 rounded-lg shadow-md"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.4 }}
              style={{ minHeight: '100px' }}
            >
              <div className="text-green-500 mr-4 mt-1 bg-green-100 p-2 rounded-full">
                <FaUsers className="text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Peace of Mind</h3>
                <p className="text-gray-600">
                  Rest easy knowing your network is protected 24/7 with enterprise-grade security that evolves to meet new threats automatically.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* About Us Section */}
      <div className="container mx-auto px-6 py-24">
        <div className="relative mb-16">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-6 text-3xl md:text-4xl font-bold text-blue-600">About Us</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left Column */}
          <motion.div
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            style={{ minHeight: '100px' }}
          >
            <div className="bg-white rounded-xl shadow-lg p-8 mb-10 border-l-4 border-blue-500">
              <p className="text-gray-700 leading-relaxed">
                <span className="font-semibold text-blue-600 text-xl">NetDetect:</span> A Centralized Network Monitoring System is designed to enhance the way institutions manage and secure their networks. Developed by researchers from CSMC-College of Computer Studies, the project offers cutting-edge solutions to ensure real-time monitoring, streamline device authorization, and evaluate network health. In an increasingly digital environment, a robust network infrastructure is essential, especially for educational institutions like schools.
              </p>
            </div>
            
            <motion.div
              className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-blue-500"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.2 }}
              style={{ minHeight: '100px' }}
            >
              <h3 className="text-2xl font-semibold text-blue-600 mb-4">Collaborative Research Approach</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                The development of NetDetect is driven by collaboration and data collection. Interviews with technical personnel and relevant staff enable us to identify critical areas of concern in network management and security. By understanding these challenges, the researchers aim to create a system tailored to meet the specific needs of institutions.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By focusing on the principles of respect, confidentiality, and inclusivity, we aim to foster trust and collaboration with the institutions we work with. These values are at the heart of our mission to create impact and sustainable technological solutions.
              </p>
            </motion.div>
          </motion.div>
          
          {/* Right Column */}
          <motion.div
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            transition={{ delay: 0.3 }}
            style={{ minHeight: '100px' }}
          >
            <div className="bg-white rounded-xl shadow-lg p-8 mb-10 border-l-4 border-blue-500">
              <p className="text-gray-700 leading-relaxed">
                Additionally, we invite administrators and staff to participate in user testing. Through their feedback, gathered via a structured questionnaire, we ensure the system's effectiveness and usability for educational environments. Together, we aspire to make networks safer and more efficient for all users while maintaining the highest standards of security.
              </p>
            </div>
            
            <motion.div
              className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-blue-500"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.4 }}
              style={{ minHeight: '100px' }}
            >
              <h3 className="text-2xl font-semibold text-blue-600 mb-4">Upholding Ethical Standards</h3>
              <p className="text-gray-700 leading-relaxed">
                Our research adheres strictly to ethical standards. We prioritize obtaining informed consent from all participants and ensuring their privacy and confidentiality throughout the project. We are committed to transparency and ethical responsibility in all phases of the research and development process, building trust with our partners and users.
              </p>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-gray-700 italic">
                  "Our goal is to create technology that not only solves problems but does so with integrity and respect for all stakeholders."
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
        
      </div>

      {/* Get in Touch Section */}
      <div className="container mx-auto px-6 pb-20">
        <motion.h2
          className="text-4xl font-bold text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.8 }}
        >
          Get in Touch
        </motion.h2>

        <motion.div
          className="text-center max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          <p className="text-gray-300 mb-2">
            Have questions or feedback? Fill out the form below, and we'll get
            back to you as soon as possible!
          </p>
        </motion.div>

        <motion.form
          className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-lg shadow-lg"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <div className="mb-6">
            <label htmlFor="name" className="sr-only">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="message" className="sr-only">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows="5"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Type your message here..."
              required
            ></textarea>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Message"}
            <FaPaperPlane className="ml-2" />
          </button>

          {successMessage && (
            <p className="text-green-400 text-center mt-4">{successMessage}</p>
          )}
          {errorMessage && (
            <p className="text-red-400 text-center mt-4">{errorMessage}</p>
          )}
        </motion.form>
      </div>
    </div>
  );
};

export default FeaturesBenefitsSection;