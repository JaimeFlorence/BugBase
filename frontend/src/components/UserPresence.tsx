import { useState, useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface OnlineUser {
  id: string;
  username: string;
  fullName?: string;
}

interface UserPresenceProps {
  bugId?: string;
  projectId?: string;
}

export function UserPresence({ bugId, projectId }: UserPresenceProps) {
  const { socket, joinRoom, leaveRoom } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!socket) return;

    const roomName = bugId ? `bug:${bugId}` : projectId ? `project:${projectId}` : 'global';
    
    // Join presence room
    joinRoom(`${roomName}:presence`);

    // Listen for presence updates
    socket.on('presence:users', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on('presence:user_joined', (user: OnlineUser) => {
      setOnlineUsers(prev => {
        if (prev.some(u => u.id === user.id)) return prev;
        return [...prev, user];
      });
    });

    socket.on('presence:user_left', (userId: string) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== userId));
    });

    return () => {
      socket.off('presence:users');
      socket.off('presence:user_joined');
      socket.off('presence:user_left');
      leaveRoom(`${roomName}:presence`);
    };
  }, [socket, bugId, projectId, joinRoom, leaveRoom]);

  if (onlineUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="gap-1">
        <Users className="h-3 w-3" />
        {onlineUsers.length} online
      </Badge>
      
      {/* Show first few users */}
      <div className="flex -space-x-2">
        {onlineUsers.slice(0, 3).map((user) => (
          <div
            key={user.id}
            className="w-6 h-6 rounded-full bg-green-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium text-white"
            title={user.fullName || user.username}
          >
            {(user.fullName || user.username).charAt(0).toUpperCase()}
          </div>
        ))}
        {onlineUsers.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium text-white">
            +{onlineUsers.length - 3}
          </div>
        )}
      </div>
    </div>
  );
}