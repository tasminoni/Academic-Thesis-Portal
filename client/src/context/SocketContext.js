import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Resolve Socket URL from env or current origin
      const socketUrl = process.env.REACT_APP_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : undefined);

      // Initialize socket connection with robust reconnection
      const newSocket = io(socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      const userRoomId = user?._id || user?.id;

      // Set up event listeners
      newSocket.on('connect', () => {
        console.log('Socket.io connected to server with ID:', newSocket.id);
        if (userRoomId) {
          newSocket.emit('join', userRoomId);
        }
        setSocket(newSocket);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket.io disconnected from server');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error);
      });

      newSocket.on('reconnect_attempt', (attempt) => {
        console.log('Socket.io reconnect attempt:', attempt);
      });

      newSocket.on('reconnect', (attempt) => {
        console.log('Socket.io reconnected after attempts:', attempt);
        if (userRoomId) {
          newSocket.emit('join', userRoomId);
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket.io disconnected. Reason:', reason);
      });

      // Handle real-time notifications
      newSocket.on('new_notification', (notification) => {
        console.log('Received real-time notification:', notification);
        setNotifications(prev => [notification, ...prev]);
        
        // Show toast notification
        if (notification.title && notification.message) {
          // You can integrate with a toast library here
          console.log(`New notification: ${notification.title} - ${notification.message}`);
        }
      });

      // Cleanup on unmount or user change
      return () => {
        newSocket.close();
        setSocket(null);
      };
    } else {
      // Clean up socket if user logs out
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [isAuthenticated, user]);

  const sendMessage = (receiverId, message) => {
    if (socket) {
      console.log('Sending message via socket to:', receiverId, message);
      socket.emit('send_message', { receiverId, message });
    } else {
      console.log('Socket not connected, cannot send message');
    }
  };

  const sendTyping = (receiverId, isTyping) => {
    if (socket) {
      socket.emit('typing', { receiverId, isTyping });
    }
  };

  const value = {
    socket,
    sendMessage,
    sendTyping,
    onlineUsers,
    notifications
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 