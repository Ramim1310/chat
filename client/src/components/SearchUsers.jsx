import socket from '../socket';
import React, { useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

function SearchUsers({ currentUser }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState(new Set());

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await api.post('/api/users/search', { query, userId: currentUser.id });
      setResults(response.data);
    } catch (error) {
      console.error("Search failed", error);
      setResults([]);
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = (receiverId) => {
      // Use socket instead of fetch
      socket.emit('sendFriendRequest', { 
          senderId: currentUser.id, 
          receiverId 
      }, (response) => {
          if (response.success) {
              setSentRequests(prev => new Set(prev).add(receiverId));
              toast.success("Friend request sent!");
          } else {
              toast.error(response.error || "Failed to send request");
          }
      });
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <h3 className="text-lg font-bold text-gray-200 mb-4 px-2 uppercase tracking-wide text-xs">Find Friends</h3>
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Username..." 
            className="flex-1 p-2 rounded-xl border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-black/20 text-gray-200 placeholder-slate-500 text-sm"
        />
        <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-bold transition-all shadow-lg shadow-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
        </button>
      </form>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && <div className="text-indigo-400 text-center text-sm animate-pulse mt-4">Searching...</div>}
        
        {results.map(user => (
            <div key={user.id} className="flex items-center justify-between p-3 mb-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all duration-200">
                <div className="flex items-center">
                    {user.image ? (
                        <img src={user.image} alt={user.name} className="w-10 h-10 rounded-full mr-3 border border-indigo-500/30" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 mr-3 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                            {user.name[0].toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="font-bold text-gray-200 text-sm">{user.name}</div>
                        <div className="text-[10px] text-gray-500">{user.email}</div>
                    </div>
                </div>
                
                {sentRequests.has(user.id) ? (
                    <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20">Sent</span>
                ) : (
                    <button 
                        onClick={() => sendRequest(user.id)}
                        className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                    >
                        Add
                    </button>
                )}
            </div>
        ))}

        {results.length === 0 && !loading && query && (
            <div className="text-gray-400 text-center text-sm">No users found.</div>
        )}
      </div>
    </div>
  );
}

export default SearchUsers;
