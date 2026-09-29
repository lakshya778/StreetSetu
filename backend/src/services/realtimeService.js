import { Server } from 'socket.io';
import { verifyToken } from '../config/jwt.js';
import Complaint from '../models/Complaint.js';

let io;

export function initializeRealtime(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 100 * 1024,
    pingInterval: 25000,
    pingTimeout: 20000
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.data.user = verifyToken(token);
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });
  io.on('connection', (socket) => {
    const { sub, role } = socket.data.user;
    socket.join(`user:${sub}`);
    socket.join(`role:${role}`);
    socket.on('complaint:join', async (complaintId, acknowledge = () => {}) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      try {
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
