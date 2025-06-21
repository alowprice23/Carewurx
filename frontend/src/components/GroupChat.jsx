import React, { useState, useEffect, useCallback } from 'react';
// import { firebase } from '../services/firebase'; // Assuming client-side firebase for auth, firestore
// import { useParams } from 'react-router-dom'; // If using room IDs in route

const GroupChat = ({ currentUserId, activeRoomId }) => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);

  // TODO: Fetch chat rooms user is a member of
  // useEffect(() => {
  //   if (!currentUserId) return;
  //   setLoadingRooms(true);
  //   const unsubscribe = firebase.firestore().collection('chatRooms')
  //     .where('members', 'array-contains', currentUserId)
  //     .orderBy('lastMessageAt', 'desc')
  //     .onSnapshot(snapshot => {
  //       const fetchedRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  //       setRooms(fetchedRooms);
  //       setLoadingRooms(false);
  //     }, err => {
  //       console.error("Error fetching chat rooms:", err);
  //       setError("Could not load chat rooms.");
  //       setLoadingRooms(false);
  //     });
  //   return unsubscribe;
  // }, [currentUserId]);

  // TODO: Fetch messages for the selected room (or activeRoomId prop)
  // useEffect(() => {
  //   if (!selectedRoom?.id && !activeRoomId) {
  //     setMessages([]);
  //     return;
  //   }
  //   const roomIdToFetch = activeRoomId || selectedRoom?.id;
  //   setLoadingMessages(true);
  //   const unsubscribe = firebase.firestore().collection('chatRooms').doc(roomIdToFetch)
  //     .collection('chatMessages')
  //     .orderBy('timestamp', 'asc')
  //     .limit(50) // Basic pagination
  //     .onSnapshot(snapshot => {
  //       const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  //       setMessages(fetchedMessages);
  //       setLoadingMessages(false);
  //     }, err => {
  //       console.error(`Error fetching messages for room ${roomIdToFetch}:`, err);
  //       setError(`Could not load messages for room ${selectedRoom?.name || roomIdToFetch}.`);
  //       setLoadingMessages(false);
  //     });
  //   return unsubscribe;
  // }, [selectedRoom, activeRoomId]);

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    setError(null);
    // If not using activeRoomId prop for routing, clear messages or let useEffect handle it
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || (!selectedRoom?.id && !activeRoomId) || !currentUserId) return;

    const roomId = activeRoomId || selectedRoom?.id;
    const messageData = {
      text: newMessage,
      senderId: currentUserId,
      // senderName: firebase.auth().currentUser?.displayName || 'User', // Get sender name
      timestamp: null, // To be replaced by firebase.firestore.FieldValue.serverTimestamp(),
      type: 'text',
    };

    setNewMessage('');
    try {
      // await firebase.firestore().collection('chatRooms').doc(roomId)
      //   .collection('chatMessages').add({
      //     ...messageData,
      //     timestamp: firebase.firestore.FieldValue.serverTimestamp()
      //   });
      // await firebase.firestore().collection('chatRooms').doc(roomId).update({
      //   lastMessageText: messageData.text.substring(0, 50),
      //   lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      // });
      console.log("Message send logic to be implemented with Firebase", messageData);
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message.");
      setNewMessage(messageData.text); // Restore message on error
    }
  };

  // TODO: Implement UI for creating new chat rooms, adding members, etc.

  return (
    <div className="group-chat-container">
      <div className="room-list-panel">
        <h4>Chat Rooms</h4>
        {loadingRooms && <p>Loading rooms...</p>}
        {rooms.length === 0 && !loadingRooms && <p>No chat rooms found.</p>}
        <ul>
          {rooms.map(room => (
            <li
              key={room.id}
              onClick={() => handleSelectRoom(room)}
              className={selectedRoom?.id === room.id || activeRoomId === room.id ? 'active' : ''}
            >
              {room.name || 'Unnamed Room'}
              {/* <span className="last-message">{room.lastMessageText}</span> */}
            </li>
          ))}
        </ul>
        {/* <button>+ New Chat Room</button> */}
      </div>

      <div className="chat-panel">
        {(!selectedRoom && !activeRoomId) ? (
          <div className="no-room-selected">Select a room to start chatting.</div>
        ) : (
          <>
            <div className="chat-header">
              <h3>{selectedRoom?.name || activeRoomId || 'Chat'}</h3>
            </div>
            <div className="messages-area">
              {loadingMessages && <p>Loading messages...</p>}
              {messages.length === 0 && !loadingMessages && <p>No messages yet. Say hi!</p>}
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.senderId === currentUserId ? 'sent' : 'received'}`}>
                  <span className="sender-name">{msg.senderName || 'User'}</span>
                  <p>{msg.text}</p>
                  <span className="timestamp">
                    {/* {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : 'Sending...'} */}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="message-input-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={loadingMessages || (!selectedRoom && !activeRoomId)}
              />
              <button type="submit" disabled={!newMessage.trim() || loadingMessages || (!selectedRoom && !activeRoomId)}>
                Send
              </button>
            </form>
          </>
        )}
        {error && <p className="error-message">{error}</p>}
      </div>
      <style jsx>{`
        /* Basic styling - to be expanded */
        .group-chat-container {
          display: flex;
          height: 600px; /* Example height */
          border: 1px solid #ccc;
        }
        .room-list-panel {
          width: 250px;
          border-right: 1px solid #ccc;
          padding: 10px;
          display: flex;
          flex-direction: column;
        }
        .room-list-panel ul {
          list-style: none;
          padding: 0;
          margin: 0;
          overflow-y: auto;
          flex-grow: 1;
        }
        .room-list-panel li {
          padding: 8px 10px;
          cursor: pointer;
          border-radius: 4px;
        }
        .room-list-panel li:hover {
          background-color: #f0f0f0;
        }
        .room-list-panel li.active {
          background-color: #e0e0e0;
          font-weight: bold;
        }
        .chat-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 10px;
        }
        .chat-header {
          border-bottom: 1px solid #ccc;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .messages-area {
          flex-grow: 1;
          overflow-y: auto;
          margin-bottom: 10px;
          display: flex;
          flex-direction: column-reverse; /* Show latest messages at the bottom */
        }
        .message {
          margin-bottom: 8px;
          padding: 8px 12px;
          border-radius: 15px;
          max-width: 70%;
        }
        .message.sent {
          background-color: #dcf8c6;
          align-self: flex-end;
          border-bottom-right-radius: 5px;
        }
        .message.received {
          background-color: #f1f0f0;
          align-self: flex-start;
          border-bottom-left-radius: 5px;
        }
        .sender-name {
          font-size: 0.8em;
          color: #555;
          display: block;
          margin-bottom: 2px;
        }
        .timestamp {
          font-size: 0.7em;
          color: #999;
          display: block;
          text-align: right;
        }
        .message-input-form {
          display: flex;
        }
        .message-input-form input {
          flex-grow: 1;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 20px 0 0 20px;
        }
        .message-input-form button {
          padding: 10px 15px;
          border: 1px solid #ccc;
          border-left: none;
          background-color: #007bff;
          color: white;
          cursor: pointer;
          border-radius: 0 20px 20px 0;
        }
        .no-room-selected {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #777;
        }
        .error-message {
          color: red;
          padding: 5px;
        }
      `}</style>
    </div>
  );
};

export default GroupChat;
