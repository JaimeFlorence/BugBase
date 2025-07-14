import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSocket } from '@/contexts/SocketContext';

export function ConnectionStatus() {
  const { isConnected, socket } = useSocket();

  if (!socket) {
    return null;
  }

  return (
    <Badge variant={isConnected ? 'default' : 'destructive'} className="gap-1">
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Live
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </Badge>
  );
}