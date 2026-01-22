import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import WelcomeScreen from './components/WelcomeScreen';
import { AnimatePresence, motion } from 'framer-motion';

import api from './api';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [view, setView] = useState("login"); // login, signup, welcome, chat

  const fetchUserInfo = async () => {
      try {
          console.log('Fetching updated user info...');
          const response = await api.get('/api/users/me');
          console.log('User data received:', response.data);
          console.log('Friends count:', response.data.friends?.length || 0);
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
      } catch (error) {
          console.error("Failed to fetch user info", error);
      }
  };

  useEffect(() => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
          // Skip welcome screen if returning user
          setView('chat');
          
          // Refresh data immediately
          fetchUserInfo();
      }
  }, []);

  const handleLogin = (userData, authToken) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
    setUser(userData);
    setToken(authToken);
    setView("welcome"); // Show welcome screen first
  };

  const handleStartChatting = () => {
    setView("chat");
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('activeRoom');
    localStorage.removeItem('activeChatName');
    setUser(null);
    setToken(null);
    setView("login");
  };

  return (
    <div className="App">
      {view === "login" && (
        <Login 
          onLogin={handleLogin} 
          onSwitchToSignup={() => setView("signup")} 
        />
      )}
      {view === "signup" && (
        <Signup 
          onLogin={handleLogin} 
          onSwitchToLogin={() => setView("login")} 
        />
      )}
      
      <AnimatePresence mode="wait">
        {view === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <WelcomeScreen 
              name={user?.name} 
              onStart={handleStartChatting}
            />
          </motion.div>
        )}
        
        {view === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Dashboard user={user} onLogout={handleLogout} refreshUser={fetchUserInfo} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
