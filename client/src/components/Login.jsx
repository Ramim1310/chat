import React, { useState } from 'react';
import api from '../api';

function Login({ onLogin, onSwitchToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/login', { email, password });
      onLogin(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-inter">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-700">
        <h2 className="text-3xl font-bold mb-6 text-center text-indigo-400">Login</h2>
        {error && <div className="bg-red-500/10 text-red-500 p-2 rounded mb-4 text-sm text-center">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded-lg font-bold transition">
            Log In
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          Don't have an account? <button onClick={onSwitchToSignup} className="text-indigo-400 hover:underline">Sign up</button>
        </p>
      </div>
    </div>
  );
}

export default Login;
