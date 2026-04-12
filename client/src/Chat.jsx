import React, { useState, useEffect } from "react";
import socket from "./socket";

function Chat() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [showChat, setShowChat] = useState(false);

  const joinRoom = async () => {
    if (username !== "" && room !== "") {
      socket.emit("join_room", room);
      setShowChat(true);
      
      try {
        const response = await fetch('http://localhost:5000/api/messages');
        const allMessages = await response.json();
        // Since the current API implementation returns ALL messages, not filtered by room, 
        // we'll just display them for verification. In a real app, we'd filter by room.
        setMessageList(allMessages); 
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    }
  };

  const sendMessage = async () => {
    if (message !== "") {
      const messageData = {
        room: room,
        author: username,
        message: message,
        email: `${username}@example.com`, // Simulating email
        image: "https://via.placeholder.com/150", 
        time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),
      };

      await socket.emit("send_message", messageData);
      setMessage("");
    }
  };

  useEffect(() => {
    const handleReceiveMessage = (data) => {
      setMessageList((list) => [...list, data]);
    };
    
    socket.on("receive_message", handleReceiveMessage);
    
    return () => {
        socket.off("receive_message", handleReceiveMessage);
    }
  }, [socket]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {!showChat ? (
        <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
          <h3 className="text-2xl font-bold mb-4 text-center">Join A Chat</h3>
          <input
            type="text"
            placeholder="John..."
            className="w-full p-2 border border-gray-300 rounded mb-4"
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            type="text"
            placeholder="Room ID..."
            className="w-full p-2 border border-gray-300 rounded mb-4"
            onChange={(event) => setRoom(event.target.value)}
          />
          <button 
            onClick={joinRoom}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition"
          >
            Join A Room
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full max-w-2xl bg-white rounded shadow-lg overflow-hidden h-[80vh]">
          <div className="bg-blue-600 p-4 text-white">
            <p className="text-xl font-bold">Live Chat - Room: {room}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messageList.map((messageContent, index) => {
              const isMe = messageContent.sender?.name === username || messageContent.author === username; // Handle both optimistic and DB returns if needed, but here we rely on server emit
              return (
                <div
                  key={index}
                  className={`flex mb-4 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`p-3 rounded-lg max-w-xs ${isMe ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"}`}>
                    <div className="font-bold text-xs mb-1">{messageContent.sender?.name || messageContent.author}</div>
                    <p>{messageContent.content}</p>
                    <div className="text-xs text-right mt-1 opacity-70">
                        {new Date(messageContent.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-gray-200 flex">
            <input
              type="text"
              value={message}
              placeholder="Hey..."
              className="flex-1 p-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(event) => setMessage(event.target.value)}
              onKeyPress={(event) => {
                event.key === "Enter" && sendMessage();
              }}
            />
            <button 
                onClick={sendMessage}
                className="bg-green-500 text-white px-6 rounded-r hover:bg-green-600 transition"
            >
                &#9658;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
