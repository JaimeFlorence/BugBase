import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from '@/components/ui/toaster';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  emit: (event: string, data?: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    if (!user || !token) {
      // Disconnect socket if user is not authenticated
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(process.env.NODE_ENV === 'production' 
      ? 'https://api.bugbase.app' 
      : 'http://localhost:5000', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to real-time updates.',
        type: 'error',
      });
    });

    // Bug-related events
    newSocket.on('bug:updated', (data) => {
      toast({
        title: 'Bug Updated',
        description: `${data.bugTitle} has been updated.`,
        type: 'info',
      });
    });

    newSocket.on('bug:commented', (data) => {
      toast({
        title: 'New Comment',
        description: `New comment on ${data.bugTitle}.`,
        type: 'info',
      });
    });

    newSocket.on('bug:assigned', (data) => {
      if (data.assigneeId === user.id) {
        toast({
          title: 'Bug Assigned',
          description: `You have been assigned to ${data.bugTitle}.`,
          type: 'info',
        });
      }
    });

    newSocket.on('bug:status_changed', (data) => {
      toast({
        title: 'Status Changed',
        description: `${data.bugTitle} status changed to ${data.newStatus}.`,
        type: 'info',
      });
    });

    // Project-related events
    newSocket.on('project:member_added', (data) => {
      if (data.userId === user.id) {
        toast({
          title: 'Project Invitation',
          description: `You have been added to ${data.projectName}.`,
          type: 'success',
        });
      }
    });

    // Notification events
    newSocket.on('notification', (data) => {
      toast({
        title: data.title,
        description: data.message,
        type: data.type || 'info',
      });
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user, token]);

  const joinRoom = (room: string) => {
    if (socket) {
      socket.emit('join_room', room);
      console.log(`Joined room: ${room}`);
    }
  };

  const leaveRoom = (room: string) => {
    if (socket) {
      socket.emit('leave_room', room);
      console.log(`Left room: ${room}`);
    }
  };

  const emit = (event: string, data?: any) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    emit,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}