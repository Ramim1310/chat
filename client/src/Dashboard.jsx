import React, { useState, useEffect } from "react";
import socket from "./socket";
import Sidebar from "./components/Sidebar";
import TypingIndicator from "./components/TypingIndicator";
import EmptyState from "./components/EmptyState";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';
import toast, { Toaster } from 'react-hot-toast';

function Dashboard({ user, onLogout, refreshUser }) {
  const [username, setUsername] = useState(user?.name || "Anonymous");
  const [room, setRoom] = useState(localStorage.getItem('activeRoom') || "");
  const [chatName, setChatName] = useState(localStorage.getItem('activeChatName') || "");
  const [activeTab, setActiveTab] = useState('chats');

  const [message, setMessage] = useState("");
  // Removed manual messageList state - relying on Query
  const [showChat, setShowChat] = useState(false);
  const [isTyping, setIsTyping] = useState(false); 
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const messagesEndRef = React.useRef(null); 

  const queryClient = useQueryClient();

  // Queries
  const { data: messageList = [] } = useQuery({
    queryKey: ['messages', room],
    queryFn: async () => {
      const { data } = await api.get(`/api/messages?room=${room}`);
      return data;
    },
    enabled: !!room,
    staleTime: Infinity, // handled by sockets
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: (newMessage) => {
      return api.post('/api/messages', newMessage);
    },
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: ['messages', room] });
      const previousMessages = queryClient.getQueryData(['messages', room]);
      
      // Optimistic update
      queryClient.setQueryData(['messages', room], (old) => [...(old || []), newMessage]);
      
      return { previousMessages };
    },
    onError: (err, newMessage, context) => {
      // Do not rollback - mark as error so user knows
      queryClient.setQueryData(['messages', room], (old) => {
          if (!old) return old;
          return old.map(m => (m.tempId === newMessage.tempId) ? { ...m, status: 'error' } : m);
      });
      console.error("Failed to send message", err);
    },
    onSuccess: (response, variables) => {
        // response.data is the real message from server
        // variables is the payload we sent (containing tempId)
        const serverMessage = response.data;
        queryClient.setQueryData(['messages', room], (old) => {
            if (!old) return old;
            return old.map(m => (m.tempId === variables.tempId) ? { ...serverMessage, status: 'sent', tempId: variables.tempId } : m);
        });
    },
    onSettled: () => {
       // queryClient.invalidateQueries({ queryKey: ['messages', room] });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messageList, isTyping]);


  const joinRoom = async (roomName, friendlyName = null) => {
    const r = roomName || room;
    if (username !== "" && r !== "") {
      socket.emit("join_room", r);
      if(!showChat) setShowChat(true);
      setRoom(r);
      const name = friendlyName || r;
      setChatName(name);

      localStorage.setItem('activeRoom', r);
      localStorage.setItem('activeChatName', name);
    }
  };

  const startPrivateChat = (otherUser) => {
    const isFriend = user.friends?.some(f => f.id === otherUser.id);
    if (!isFriend) {
        toast.error("You can only chat with friends!");
        return;
    }
    const participants = [user.id, otherUser.id].sort((a,b) => a - b);
    const privateRoomId = `${participants[0]}-${participants[1]}`;
    joinRoom(privateRoomId, otherUser.name);
  };
 
  const sendMessage = async () => {
    if (message !== "") {
      const tempId = Date.now() + Math.random();
      const messageData = {
        room: room,
        author: username,
        content: message,
        email: user?.email,
        senderId: user?.id,
        image: user?.image || `https://ui-avatars.com/api/?name=${username}`,
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
        isOptimistic: true,
        status: 'sending',
        tempId: tempId
      };

      // Trigger mutation
      mutation.mutate(messageData);
      
      setMessage("");
      handleStopTyping();
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (!isTyping) {
        setIsTyping(true);
        socket.emit("typing", room);
    }
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(handleStopTyping, 2000);
  };

  const handleStopTyping = () => {
      setIsTyping(false);
      socket.emit("stop_typing", room);
  };

  useEffect(() => {
    if (user) {
        socket.emit('user_connected', user);
    }

    const handleReceiveMessage = (data) => {
       // Only update if message is for current active room
       if (data.room !== room) {
           console.log(`Message for room ${data.room} ignored, current room is ${room}`);
           return;
       }
       
       // Update Query Cache
       queryClient.setQueryData(['messages', room], (old) => {
           if (!old) return [data];
           // Check dedupe logic
           const exists = old.find(m => (m.id && m.id === data.id) || (m.tempId && m.tempId === data.tempId));
           if (exists) return old; 
           return [...old, data];
       });
    };
    
    const handleDisplayTyping = (userId) => {
        setTypingUsers((prev) => [...new Set([...prev, userId])]);
    };

    const handleHideTyping = (userId) => {
        setTypingUsers((prev) => prev.filter(id => id !== userId));
    };

    const handleActiveUsers = (users) => {
        const unique = Array.from(new Map(users.map(u => [u.email, u])).values());
        setActiveUsers(unique);
    };

    const handleFriendRequest = (data) => {
        setNotification({
            message: `New friend request from ${data.senderName}!`,
            type: 'info'
        });
        setTimeout(() => setNotification(null), 5000);
    };

  /* New: Handle Message Status Updates */
    const handleMessageSent = (data) => {
        queryClient.setQueryData(['messages', room], (old) => {
            if (!old) return old;
            return old.map(m => (m.tempId === data.tempId) ? { ...m, ...data } : m);
        });
    };

    const handleMessagesSeen = ({ room: r }) => {
        if (room === r) {
            queryClient.setQueryData(['messages', room], (old) => {
                if (!old) return old;
                 return old.map(m => 
                    (m.sender?.name === username || m.author === username) ? { ...m, status: 'seen' } : m
                );
            });
        }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("display_typing", handleDisplayTyping);
    socket.on("hide_typing", handleHideTyping);
    socket.on("active_users", handleActiveUsers);
    socket.on("friend_request_received", handleFriendRequest);
    socket.on("message_sent", handleMessageSent);
    socket.on("messages_seen", handleMessagesSeen);
    
    return () => {
        socket.off("receive_message", handleReceiveMessage);
        socket.off("display_typing", handleDisplayTyping);
        socket.off("hide_typing", handleHideTyping);
        socket.off("active_users", handleActiveUsers);
        socket.off("friend_request_received", handleFriendRequest);
        socket.off("message_sent", handleMessageSent);
        socket.off("messages_seen", handleMessagesSeen);
    }
  }, [socket, user, room]); // added room dependency for seen logic

  useEffect(() => {
    if (user) {
        // Load persisted room or default to general
        const persistedRoom = localStorage.getItem('activeRoom');
        const persistedName = localStorage.getItem('activeChatName');
        
        if (persistedRoom) {
            joinRoom(persistedRoom, persistedName || persistedRoom);
        } else {
            joinRoom('global_forum', 'Global Forum');
        }
    }
  }, [user]);

  // Mark messages as seen when entering room or receiving new ones
  useEffect(() => {
    if (room && user) {
        // Emit mark read
        socket.emit('mark_messages_read', { room, userId: user.id });
    }
  }, [room, messageList, user]);


  // Dashboard Screen
  return (
    <div className="flex items-center justify-center h-screen w-full p-4 lg:p-8 font-inter overflow-hidden">
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(17, 25, 40, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      />
      
      {/* Main Glass Container */}
      <div className="glass-panel w-full max-w-[1600px] h-full flex rounded-3xl overflow-hidden shadow-2xl relative">
        
        <Sidebar 
          users={activeUsers} 
          joinRoom={joinRoom} 
          activeRoom={room} 
          currentUser={user} 
          onUserClick={startPrivateChat}
          onLogout={onLogout}
          onTabChange={setActiveTab}
          onFriendAction={refreshUser}
        />
        
        {/* Main Content Area */}
        <AnimatePresence mode="wait">
        {activeTab !== 'chats' ? (
          <motion.div 
            key="empty-state"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 h-full relative"
          >
            <EmptyState type={activeTab} />
          </motion.div>
        ) : (
          <motion.div 
            key="chat-interface"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col h-full relative bg-black/20"
          >
            {/* Glass Header */}
            <div className="h-20 glass flex items-center justify-between px-8 border-b border-white/10 z-20">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 tracking-tight">
                      {room.includes('-') ? (chatName || 'Private Chat') : `#${chatName || room}`}
                    </h2>
                    {/* Status Indicator */}
                    {room.includes('-') && (
                      <div className="flex items-center mt-1">
                          {(() => {
                              const isOnline = activeUsers.some(u => u.name === chatName);
                              return (
                                  <>
                                      <span className={`w-2 h-2 rounded-full mr-2 shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isOnline ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-slate-500'}`}></span>
                                      <span className="text-xs text-slate-400 font-medium tracking-wide">{isOnline ? 'Online' : 'Offline'}</span>
                                  </>
                              );
                          })()}
                      </div>
                    )}
                </div>
                
                {/* User Controls */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 pl-6 border-l border-white/10">
                        <div className="relative">
                           {user?.image ? (
                                <img src={user.image} alt={user.name} className="w-10 h-10 rounded-full border-2 border-indigo-500/50 shadow-lg" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg text-sm">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#1a1f2e]"></div>
                        </div>
                        <div className="hidden md:flex flex-col">
                          <span className="font-semibold text-gray-200 text-sm">{user?.name}</span>
                          <span className="text-[10px] text-gray-400">Active Now</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scroll-smooth custom-scrollbar">
                <AnimatePresence>
                {messageList.map((messageContent, index) => {
                  const isMe = (messageContent.sender?.name === username) || (messageContent.author === username);
                  
                  const prevMessage = index > 0 ? messageList[index - 1] : null;
                  const prevSender = prevMessage?.sender?.name || prevMessage?.author;
                  const currentSender = messageContent.sender?.name || messageContent.author;
                  const isGrouped = prevSender === currentSender;
                  
                  return (
                    <motion.div
                      key={messageContent.id || messageContent.tempId || index}
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                      className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                      style={{ marginTop: isGrouped ? '4px' : '24px' }}
                    >
                      {/* Avatar */}
                      {!isMe && !isGrouped && (
                        <div className="mr-3 flex-shrink-0 self-end mb-1">
                          {messageContent.sender?.image || messageContent.image ? (
                            <img 
                              src={messageContent.sender?.image || messageContent.image} 
                              alt={currentSender} 
                              className="w-8 h-8 rounded-full border border-white/10 shadow-md"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-[10px] font-bold border border-white/10">
                              {currentSender?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Spacer for proper alignment if grouped */}
                      {!isMe && isGrouped && <div className="w-11 mr-0 flex-shrink-0"></div>}
                      
                      <div className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender Name */}
                        {!isMe && !isGrouped && (
                            <span className="text-[10px] text-slate-400 ml-1 mb-1">{currentSender}</span>
                        )}

                        <div className={`relative px-5 py-3 shadow-md backdrop-blur-sm
                            ${isMe 
                            ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-sm" 
                            : "glass text-gray-200 border border-white/5 rounded-2xl rounded-tl-sm"
                        }`}>
                          <p className="text-[14px] md:text-[15px] leading-relaxed tracking-wide font-light">{messageContent.content}</p>
                        </div>
                        
                        {/* Timestamp & Status */}
                        <div className={`flex items-center gap-1 mt-1 opacity-70 text-[10px] font-medium ${isMe ? 'mr-1' : 'ml-1'}`}>
                              <span className="text-slate-500">
                                  {messageContent.timestamp ? new Date(messageContent.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : messageContent.time}
                              </span>
                              {isMe && (
                                  <span className="ml-1">
                                      {messageContent.status === 'seen' && <span className="text-blue-400">✓✓</span>}
                                      {messageContent.status === 'sent' && <span className="text-slate-400">✓</span>}
                                      {messageContent.status === 'sending' && <span className="text-slate-500 animate-pulse">...</span>}
                                      {messageContent.status === 'error' && <span className="text-red-400">⚠</span>}
                                  </span>
                              )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
                
                {/* Typing Indicator */}
                <AnimatePresence>
                {typingUsers.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex justify-start ml-12 mt-2"
                    >
                        <div className="glass px-4 py-2 rounded-full rounded-tl-none border border-white/10 flex items-center gap-2">
                             <TypingIndicator />
                             <span className="text-[10px] text-slate-400">Typing...</span>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
                
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 pb-6 z-20">
              <div className="glass p-1.5 rounded-full flex items-center shadow-2xl border border-white/10 relative">
                <input
                  type="text"
                  value={message}
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-gray-200 placeholder-slate-500 px-4 h-12"
                  onChange={handleTyping}
                  onKeyPress={(event) => {
                    event.key === "Enter" && sendMessage();
                  }}
                />
                
                <button 
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className={`h-10 w-10 mr-1 rounded-full flex items-center justify-center transition-all duration-300
                      ${message.trim() 
                        ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] hover:scale-110 active:scale-95' 
                        : 'bg-white/5 text-white/20 cursor-not-allowed'
                      }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 ml-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Dashboard;
