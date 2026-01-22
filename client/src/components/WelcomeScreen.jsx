import React from 'react';
import { motion } from 'framer-motion';

function WelcomeScreen({ name, onStart }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-black animate-gradient-slow overflow-hidden">
      <div className="text-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-6xl md:text-7xl font-bold text-white mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
        >
          Welcome, {name}!
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-xl md:text-2xl text-gray-300 mb-12"
        >
          Let's connect with your friends.
        </motion.p>
        
        <motion.button
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          onClick={onStart}
          className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] transition-all duration-300 transform hover:scale-105"
        >
          Start Chatting
        </motion.button>
      </div>
    </div>
  );
}

export default WelcomeScreen;
