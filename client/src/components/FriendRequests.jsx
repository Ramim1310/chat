import React, { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

function FriendRequests({ currentUser, onActionComplete }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!currentUser || !currentUser.id) {
        setLoading(false);
        return;
    }
    
    try {
        console.log("Fetching requests for user:", currentUser.id);
        const response = await api.get(`/api/friend-request/pending/${currentUser.id}`);
        setRequests(response.data);
    } catch (error) {
        console.error("Failed to fetch requests", error);
        toast.error("Failed to load requests");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentUser]);

  const handleAction = async (requestId, action) => {
      // action = 'accept' or 'reject'
      try {
          const response = await api.post(`/api/friend-request/${action}`, { requestId });
          
          if (response.status === 200) {
              setRequests(prev => prev.filter(r => r.id !== requestId));
              toast.success(`Request ${action}ed!`);
              
              if (action === 'accept' && onActionComplete) {
                  console.log('Friend request accepted, refreshing user data...');
                  // Small delay to ensure server transaction completes
                  setTimeout(() => {
                      onActionComplete();
                  }, 500);
              }
          }
      } catch (error) {
          console.error(`Failed to ${action}`, error);
          toast.error(`Failed to ${action} request`);
      }
  };

  return (
    <div className="p-4 h-full flex flex-col">
        <h3 className="text-lg font-bold text-gray-200 mb-4 px-2 uppercase tracking-wide text-xs">Pending Requests</h3>
        
        {loading && <div className="text-indigo-400 text-center text-sm animate-pulse mt-4">Loading...</div>}

        {!loading && requests.length === 0 && (
            <div className="text-slate-500 italic text-center text-sm mt-4">No pending requests.</div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {requests.map(req => (
                <div key={req.id} className="p-3 mb-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all duration-200 shadow-lg">
                    <div className="flex items-center mb-3">
                         {req.sender?.image ? (
                             <img src={req.sender.image} alt={req.sender.name} className="w-10 h-10 rounded-full mr-3 border border-indigo-500/30" />
                         ) : (
                             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 mr-3 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                 {req.sender?.name?.[0].toUpperCase()}
                             </div>
                         )}
                         <div>
                             <div className="font-bold text-gray-200 text-sm">{req.sender?.name}</div>
                             <div className="text-[10px] text-slate-400">wants to be friends</div>
                         </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleAction(req.id, 'accept')}
                            className="flex-1 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg hover:bg-emerald-500/30 transition-all"
                        >
                            Accept
                        </button>
                        <button 
                            onClick={() => handleAction(req.id, 'reject')}
                            className="flex-1 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-all"
                        >
                            Decline
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}

export default FriendRequests;
