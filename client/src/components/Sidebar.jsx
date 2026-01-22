import React, { useState } from 'react';
import SearchUsers from './SearchUsers';
import FriendRequests from './FriendRequests';

function Sidebar({ users, joinRoom, activeRoom, currentUser, onUserClick, onLogout, onTabChange, onFriendAction }) {
  const [activeTab, setActiveTab] = useState('chats'); // chats, search, requests
  const rooms = ["General", "Tech", "Random"]; 

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  return (
    <div className="w-1/3 md:w-1/4 h-full glass border-r border-white/10 flex flex-col relative z-20">
      {/* Header / Tabs */}
      <div className="flex p-2 gap-1 bg-black/20 m-4 rounded-xl">
          <button 
            onClick={() => handleTabChange('chats')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${activeTab === 'chats' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Chats
          </button>
          <button 
            onClick={() => handleTabChange('search')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${activeTab === 'search' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Search
          </button>
          <button 
            onClick={() => handleTabChange('requests')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Requests
          </button>
      </div>

      
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
        {activeTab === 'chats' && (
            <div className="space-y-6">
                {/* Public Rooms */}
                <div>
                    <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest px-2">Public Rooms</h3>
                    <div 
                        onClick={() => joinRoom('global_forum', 'Global Forum')}
                        className={`group flex items-center p-2 rounded-xl cursor-pointer transition-all duration-200 border ${
                            activeRoom === 'global_forum' 
                                ? 'bg-indigo-500/20 border-indigo-500/40' 
                                : 'border-transparent hover:bg-white/5 hover:border-white/5'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-full mr-3 flex items-center justify-center text-white text-lg shadow-lg transition-all ${
                            activeRoom === 'global_forum' 
                                ? 'bg-gradient-to-tr from-indigo-500 to-purple-600' 
                                : 'bg-gradient-to-tr from-slate-600 to-slate-700 group-hover:from-slate-500 group-hover:to-slate-600'
                        }`}>
                            🌐
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className={`font-medium block leading-tight truncate transition-colors ${
                                activeRoom === 'global_forum' 
                                    ? 'text-indigo-300' 
                                    : 'text-gray-300 group-hover:text-white'
                            }`}>
                                Global Forum
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                                Public Chat
                            </span>
                        </div>
                    </div>
                </div>

                {/* Friends */}
                <div>
                    <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest px-2">Friends</h3>
                    {(!currentUser.friends || currentUser.friends.length === 0) ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-700 text-center">
                            <p className="text-sm text-slate-500">No friends yet.</p>
                            <button onClick={() => handleTabChange('search')} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 underline">Find people</button>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {currentUser.friends.map((friend) => {
                                const isOnline = users.some(u => u.id === friend.id);
                                return (
                                    <li 
                                        key={friend.id} 
                                        onClick={() => onUserClick(friend)} // Start chat
                                        className="group flex items-center p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all duration-200 border border-transparent hover:border-white/5"
                                    >
                                        <div className="relative">
                                            {friend.image ? (
                                            <img src={friend.image} alt={friend.name} className={`w-10 h-10 rounded-full mr-3 border-2 transition-all duration-300 ${isOnline ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-slate-600 group-hover:border-slate-500'}`} />
                                            ) : (
                                            <div className={`w-10 h-10 rounded-full mr-3 flex items-center justify-center text-white text-sm font-bold relative shadow-lg ${isOnline ? 'bg-gradient-to-tr from-emerald-500 to-teal-600' : 'bg-slate-700'}`}>
                                                {friend.name.charAt(0).toUpperCase()}
                                            </div>
                                            )}
                                            {isOnline && <span className="absolute bottom-0 right-3 w-3 h-3 bg-emerald-500 border-2 border-[#1a1f2e] rounded-full"></span>}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <span className={`font-medium block leading-tight truncate transition-colors ${isOnline ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-300'}`}>{friend.name}</span>
                                            <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${isOnline ? 'text-emerald-500' : 'text-slate-600'}`}>
                                                {isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'search' && <SearchUsers currentUser={currentUser} />}
        
        
        {activeTab === 'requests' && <FriendRequests currentUser={currentUser} onActionComplete={onFriendAction} />}
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all duration-300 font-bold text-sm tracking-wide border border-red-500/20 hover:border-red-500/30"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Logout
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
