import { Server } from 'socket.io';
import { verifyToken } from './lib/auth.js';
import { q, now } from './db.js';
import { config } from './config.js';

let io = null;

// tripId -> Map(userId -> { sockets: Set<socketId>, editing: string|null })
const presence = new Map();

export function emitTrip(tripId, type, data = {}, by = null) {
  io?.to(`trip:${tripId}`).emit('trip:event', { tripId, type, data, by, at: now() });
}

export function emitUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitAdmins(event, payload) {
  io?.to('admins').emit(event, payload);
}

export function onlineUserCount() {
  if (!io) return 0;
  const users = new Set();
  for (const socket of io.sockets.sockets.values()) if (socket.data.userId && socket.data.role !== 'admin') users.add(socket.data.userId);
  return users.size;
}

function presenceList(tripId) {
  const map = presence.get(tripId);
  if (!map) return [];
  return [...map.entries()].map(([userId, p]) => ({ user_id: userId, editing: p.editing }));
}

function broadcastPresence(tripId) {
  io?.to(`trip:${tripId}`).emit('presence', { tripId, users: presenceList(tripId) });
}

function leaveTrip(socket, tripId) {
  socket.leave(`trip:${tripId}`);
  const map = presence.get(tripId);
  const entry = map?.get(socket.data.userId);
  if (entry) {
    entry.sockets.delete(socket.id);
    if (!entry.sockets.size) map.delete(socket.data.userId);
    if (!map.size) presence.delete(tripId);
  }
  socket.data.trips.delete(tripId);
  broadcastPresence(tripId);
}

export function kickFromTrip(tripId, userId) {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId === userId && socket.data.trips?.has(tripId)) leaveTrip(socket, tripId);
  }
}

export function initRealtime(httpServer) {
  const origins = config.corsOrigins;
  io = new Server(httpServer, { cors: { origin: origins.includes('*') ? true : origins }, maxHttpBufferSize: 1e6 });

  io.use((socket, next) => {
    const payload = verifyToken(socket.handshake.auth?.token);
    if (!payload) return next(new Error('unauthorized'));
    const user = q.get('SELECT id, role, status, name FROM users WHERE id = ?', payload.sub);
    if (!user || user.status === 'suspended') return next(new Error('unauthorized'));
    socket.data.userId = user.id;
    socket.data.role = user.role;
    socket.data.trips = new Set();
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    if (socket.data.role === 'admin') socket.join('admins');

    socket.on('trip:join', ({ tripId } = {}, ack) => {
      const member = q.get('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?', tripId, userId);
      if (!member) return ack?.({ ok: false });
      socket.join(`trip:${tripId}`);
      socket.data.trips.add(tripId);
      if (!presence.has(tripId)) presence.set(tripId, new Map());
      const map = presence.get(tripId);
      if (!map.has(userId)) map.set(userId, { sockets: new Set(), editing: null });
      map.get(userId).sockets.add(socket.id);
      broadcastPresence(tripId);
      ack?.({ ok: true, users: presenceList(tripId) });
    });

    socket.on('trip:leave', ({ tripId } = {}) => {
      if (socket.data.trips.has(tripId)) leaveTrip(socket, tripId);
    });

    socket.on('presence:editing', ({ tripId, target } = {}) => {
      const entry = presence.get(tripId)?.get(userId);
      if (!entry) return;
      entry.editing = typeof target === 'string' ? target.slice(0, 80) : null;
      broadcastPresence(tripId);
    });

    socket.on('typing', ({ tripId, channel } = {}) => {
      if (!socket.data.trips.has(tripId)) return;
      socket.to(`trip:${tripId}`).emit('typing', { tripId, channel, user_id: userId });
    });

    socket.on('location:update', ({ tripId, lat, lng } = {}) => {
      if (!socket.data.trips.has(tripId)) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const member = q.get('SELECT share_location FROM trip_members WHERE trip_id = ? AND user_id = ?', tripId, userId);
      if (!member?.share_location) return;
      q.run(
        `INSERT INTO live_locations (trip_id, user_id, lat, lng, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(trip_id, user_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at`,
        tripId, userId, lat, lng, now(),
      );
      io.to(`trip:${tripId}`).emit('trip:event', { tripId, type: 'location', data: { user_id: userId, lat, lng, updated_at: now() }, by: userId });
    });

    socket.on('disconnect', () => {
      for (const tripId of [...socket.data.trips]) leaveTrip(socket, tripId);
    });
  });

  return io;
}
