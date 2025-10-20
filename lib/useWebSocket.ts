import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useCanvasStore } from './store';

export function useWebSocket(portalId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if we have a portal ID
    if (!portalId) {
      console.log('⏸️ No portal ID, skipping WebSocket connection');
      return;
    }

    console.log('🔌 Connecting to WebSocket for portal:', portalId);
    
    // Connect to server
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    // On connection
    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket:', socket.id);
      
      // Join the portal room
      socket.emit('join_portal', portalId);
    });

    // When another user joins
    socket.on('user_joined', (data) => {
      console.log('👋 User joined portal:', data.userId);
      // TODO: Show user presence indicator in UI
    });

    // When a node is created (by anyone, including us)
    socket.on('node_created', (data) => {
      console.log('🆕 Node created event received:', data);
      
      // Add node to local state via store
      useCanvasStore.getState().addNodeFromWebSocket(data);
    });

    // Handle errors
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    // Clean up on unmount
    return () => {
      console.log('🔌 Disconnecting from WebSocket');
      socket.disconnect();
    };
  }, [portalId]);

  // Function to emit node creation
  const createNode = (nodeData: any) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('📤 Emitting create_node:', nodeData);
      socketRef.current.emit('create_node', {
        ...nodeData,
        portalId: portalId
      });
    } else {
      console.warn('⚠️ Socket not connected, cannot create node');
    }
  };

  return { 
    createNode,
    isConnected: socketRef.current?.connected || false 
  };
}