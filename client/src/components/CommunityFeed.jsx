import React, { useState, useEffect } from 'react';
import api from '../api';
import { motion, AnimatePresence } from 'framer-motion';

export default function CommunityFeed({ user }) {
  const [posts, setPosts] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [communityName, setCommunityName] = useState('gaming');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingCommentId, setSubmittingCommentId] = useState(null);

  const fetchPosts = async () => {
    try {
      const res = await api.get('/api/posts');
      setPosts(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post('/api/posts', { title, content, communityName });
      setTitle('');
      setContent('');
      // Optimistically fetch immediately, then poll once after AI summarizes
      fetchPosts();
      setTimeout(fetchPosts, 3500); 
    } catch (e) {
      console.error("Failed to post", e);
    }
    setIsSubmitting(false);
  };

  const handleCommentSubmit = async (e, postId) => {
    e.preventDefault();
    const cmt = commentInputs[postId];
    if (!cmt || !cmt.trim()) return;
    
    setSubmittingCommentId(postId);
    try {
       await api.post(`/api/posts/${postId}/comments`, { content: cmt });
       setCommentInputs(prev => ({ ...prev, [postId]: '' }));
       fetchPosts(); // fresh data
    } catch (e) {
       console.error("Failed to post comment", e);
    }
    setSubmittingCommentId(null);
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-hidden relative pb-4">
       {/* Create Post Header */}
       <div className="glass p-4 sm:p-6 rounded-3xl border border-white/5 shrink-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500"></div>
          <h2 className="text-xl font-bold text-white mb-4 ml-1">Create Post</h2>
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="flex flex-col sm:flex-row gap-3">
                 <select 
                    value={communityName} 
                    onChange={e => setCommunityName(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm sm:text-base text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none font-bold tracking-wide"
                 >
                    <option value="gaming">🎮 Gaming</option>
                    <option value="sports">🏅 Sports</option>
                    <option value="anime">⛩️ Anime</option>
                    <option value="movie">🎬 Movie</option>
                 </select>
                 <input 
                    type="text" 
                    placeholder="Post Title..." 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-gray-200 outline-none focus:ring-1 focus:ring-indigo-500 text-sm sm:text-base transition-all"
                 />
              </div>
              <textarea 
                 placeholder="What's on your mind? Start a discussion!" 
                 value={content}
                 onChange={e => setContent(e.target.value)}
                 className="bg-black/20 border border-white/10 rounded-xl p-4 text-gray-200 outline-none focus:ring-1 focus:ring-indigo-500 w-full min-h-[100px] text-sm resize-none custom-scrollbar transition-all"
              />
              <div className="flex justify-end mt-1">
                 <button 
                    type="submit" 
                    disabled={isSubmitting || !title.trim() || !content.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-2.5 px-8 rounded-xl shadow-lg transition-all text-sm disabled:opacity-50 disabled:scale-100 hover:scale-105 active:scale-95"
                 >
                    {isSubmitting ? 'Posting...' : 'Publish Post'}
                 </button>
              </div>
          </form>
       </div>

       {/* Feed */}
       <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5">
          <AnimatePresence>
          {posts.map(post => (
              <motion.div 
                 key={post.id}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="glass p-5 md:p-7 rounded-3xl border border-white/5 relative group shadow-xl"
              >
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                         {post.author?.image ? (
                             <img src={post.author.image} alt={post.author?.name} className="w-10 h-10 rounded-full border-2 border-indigo-500/30 shadow-md" />
                         ) : (
                             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-sm font-bold text-white border-2 border-indigo-500/30 shadow-md">
                                {post.author?.name?.charAt(0).toUpperCase()}
                             </div>
                         )}
                         <div>
                            <p className="text-sm text-gray-100 font-semibold leading-tight">{post.author?.name}</p>
                            <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest mt-0.5">{post.community?.name}</p>
                         </div>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                          {new Date(post.createdAt).toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                  </div>

                  <h3 className="text-xl md:text-2xl font-bold text-white mb-3 tracking-tight">{post.title}</h3>
                  <p className="text-[15px] text-gray-300 leading-relaxed font-light mb-5 whitespace-pre-line">{post.content}</p>

                  {/* AI Insight visually differentiated */}
                  {post.aiInsight && (
                      <div className="mt-5 p-5 rounded-2xl bg-gradient-to-tr from-emerald-900/30 to-teal-900/30 border border-emerald-500/20 relative overflow-hidden shadow-inner">
                          <div className="absolute -right-4 -top-4 opacity-10">
                              <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                          </div>
                          <div className="flex items-center gap-2 mb-2 relative z-10">
                              <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              </div>
                              <span className="text-xs font-black text-emerald-400 tracking-wider uppercase">AI Generated Summary</span>
                          </div>
                          <p className="text-[14px] text-emerald-100/90 leading-relaxed italic border-l-[3px] border-emerald-500/50 pl-4 ml-1 relative z-10">
                              "{post.aiInsight.summary}"
                          </p>
                      </div>
                  )}

                  <div className="mt-6 pt-5 border-t border-white/10 space-y-4">
                      {post.comments && post.comments.length > 0 && (
                          <div className="space-y-4 mb-4">
                              <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Comments</h4>
                              {post.comments.map(comment => {
                                  const isSystemAgent = comment.author?.name === 'System Agent';
                                  return (
                                  <div key={comment.id} className="flex gap-3 items-start">
                                      {isSystemAgent ? (
                                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30 shadow-inner mt-0.5">
                                              <span className="text-sm text-indigo-300 drop-shadow-md">✨</span>
                                          </div>
                                      ) : comment.author?.image ? (
                                          <img src={comment.author.image} alt={comment.author.name} className="w-8 h-8 rounded-full border border-white/10 shrink-0 mt-0.5" />
                                      ) : (
                                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 border border-white/10 shadow-inner mt-0.5 text-xs font-bold text-white">
                                              {comment.author?.name ? comment.author.name.charAt(0).toUpperCase() : '?'}
                                          </div>
                                      )}
                                      <div className={`rounded-2xl rounded-tl-sm p-4 w-full border ${isSystemAgent ? 'bg-indigo-900/10 border-indigo-500/20' : 'bg-black/20 border-white/5'}`}>
                                          <div className="flex items-center justify-between mb-1">
                                            <p className={`text-xs font-bold tracking-wide ${isSystemAgent ? 'text-indigo-300' : 'text-slate-300'}`}>
                                                {comment.author?.name || 'Unknown'}
                                            </p>
                                            <span className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                          </div>
                                          <div className="text-[14px] text-gray-300 font-light leading-relaxed">
                                             {isSystemAgent 
                                                ? comment.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white font-bold">{part}</strong> : part)
                                                : comment.content
                                             }
                                          </div>
                                      </div>
                                  </div>
                              )})}
                          </div>
                      )}

                      {/* Comment Input */}
                      <form onSubmit={(e) => handleCommentSubmit(e, post.id)} className="flex items-center gap-3 relative mt-4">
                          <input 
                              type="text"
                              placeholder="Write a comment..."
                              value={commentInputs[post.id] || ''}
                              onChange={(e) => setCommentInputs(prev => ({...prev, [post.id]: e.target.value}))}
                              className="flex-1 bg-black/30 border border-white/10 rounded-full py-2.5 px-5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                          />
                          <button 
                              type="submit"
                              disabled={submittingCommentId === post.id || !(commentInputs[post.id] || '').trim()}
                              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:hover:bg-indigo-600"
                          >
                              {submittingCommentId === post.id ? (
                                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                              )}
                          </button>
                      </form>
                  </div>
              </motion.div>
          ))}
          {posts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <span className="text-4xl mb-4 opacity-50">🧭</span>
                  <p>No posts yet. Be the first to start a discussion!</p>
              </div>
          )}
          </AnimatePresence>
       </div>
    </div>
  );
}
