import { Server } from 'socket.io';
import { verifyToken } from '../config/jwt.js';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';

let io;
const connectionAttempts = new Map();

function allowConnection(address) {
  const now = Date.now();
  const recent = (connectionAttempts.get(address) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 60) return false;
  recent.push(now);
  connectionAttempts.set(address, recent);
  if (connectionAttempts.size > 5000) {
    for (const [key, attempts] of connectionAttempts) if (!attempts.some((time) => now - time < 60_000)) connectionAttempts.delete(key);
  }
  return true;
}

export function initializeRealtime(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 100 * 1024,
    pingInterval: 25000,
    pingTimeout: 20000
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const claims = verifyToken(token);
      const user = await User.findOne({ _id: claims.sub, isActive: true }).select('role').lean();
      if (!user || user.role !== claims.role) return next(new Error('Account is unavailable'));
      socket.data.user = { sub: String(claims.sub), role: user.role };
      if (!allowConnection(socket.handshake.address || 'unknown')) return next(new Error('Too many realtime connections. Please retry shortly.'));
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });
  io.on('connection', (socket) => {
    const { sub, role } = socket.data.user;
    socket.data.roomJoinStartedAt = Date.now();
    socket.data.roomJoinCount = 0;
    socket.join(`user:${sub}`);
    socket.join(`role:${role}`);
    socket.on('complaint:join', async (complaintId, acknowledge = () => {}) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      const now = Date.now();
      if (now - socket.data.roomJoinStartedAt > 60_000) { socket.data.roomJoinStartedAt = now; socket.data.roomJoinCount = 0; }
      socket.data.roomJoinCount += 1;
      if (socket.data.roomJoinCount > 30) { reply({ success: false, error: 'Too many room subscriptions' }); return; }
      try {
        if (typeof complaintId !== 'string' || !/^[a-f\d]{24}$/i.test(complaintId)) {
          reply({ success: false, error: 'Invalid complaint id' });
          return;
        }
        const complaint = await Complaint.findById(complaintId).select('createdBy assignedTo assignedVolunteer');
        const assignedId = complaint?.assignedVolunteer || complaint?.assignedTo;
        if (!complaint || (role !== 'admin' && String(complaint.createdBy) !== String(sub) && String(assignedId) !== String(sub))) {
          reply({ success: false, error: 'Not authorized for this complaint' });
          return;
        }
        socket.join(`complaint:${complaintId}`);
        reply({ success: true });
      } catch {
        reply({ success: false, error: 'Could not subscribe to complaint updates' });
      }
    });
  });
  return io;
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToRole(role, event, payload) {
  io?.to(`role:${role}`).emit(event, payload);
}

export function removeUserFromComplaintRoom(userId, complaintId) {
  io?.in(`user:${userId}`).socketsLeave(`complaint:${complaintId}`);
}

export function publishComplaintUpdate(complaint, eventType = 'complaint:updated') {
  if (!io || !complaint?._id) return;
  const payload = {
    complaintId: String(complaint._id),
    status: complaint.status,
    eventType,
    updatedAt: complaint.updatedAt || new Date().toISOString()
  };
  io.to(`complaint:${complaint._id}`).emit(eventType, payload);
  io.to('role:admin').emit('dashboard:updated', payload);
  const volunteerId = complaint.assignedVolunteer?._id || complaint.assignedVolunteer || complaint.assignedTo?._id || complaint.assignedTo;
  if (volunteerId) emitToUser(volunteerId, eventType, payload);
  const citizenId = complaint.createdBy?._id || complaint.createdBy;
  if (citizenId) emitToUser(citizenId, eventType, payload);
}
