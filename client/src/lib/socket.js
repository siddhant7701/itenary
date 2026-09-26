import { io } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { API_ORIGIN, getToken } from './api';

let socket = null;
let socketToken = null;

/** Shared, lazily-connected socket for the traveller session. */
export function getSocket() {
  const token = getToken('user');
  if (!token) return null;
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io(API_ORIGIN || undefined, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
  return socket;
}

/** Separate socket for the admin panel (live SOS / booking alerts). */
let adminSocket = null;
export function getAdminSocket() {
  const token = getToken('admin');
  if (!token) return null;
  if (adminSocket && adminSocket.auth?.token === token) return adminSocket;
  adminSocket?.disconnect();
  adminSocket = io(API_ORIGIN || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
  return adminSocket;
}

export function resetSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(event, handler, { admin = false } = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = admin ? getAdminSocket() : getSocket();
    if (!s) return;
    const fn = (...args) => ref.current(...args);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event, admin]);
}

/** Whether the realtime connection is up (for presence indicators / offline banner). */
export function useSocketStatus() {
  const [connected, setConnected] = useState(() => !!getSocket()?.connected);
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on('connect', on);
    s.on('disconnect', off);
    setConnected(s.connected);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);
  return connected;
}
