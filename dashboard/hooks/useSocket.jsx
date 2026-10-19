// hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'https://api.numericexport.com', {
      path: '/socket.io/',
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    return () => { socketInstance.disconnect(); };
  }, []);

  return socket;
}
