import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
  return transporter;
}

function statusMessage(previousStatus, status, note) {
  const noteText = note ? ` Note: ${note}` : '';
  return `Your complaint status changed from ${previousStatus} to ${status}.${noteText}`;
}

async function notifyRecipients({ complaint, recipientIds, title, message, metadata }) {
  const recipients = await User.find({ _id: { $in: recipientIds }, isActive: true }).select('name email');
  await Promise.all(recipients.map(async (recipient) => {
    await createInAppNotification(recipient._id, complaint, title, message, metadata);
    await createEmailNotification(recipient, complaint, title, message, metadata);
  }));
}

async function createInAppNotification(recipient, complaint, title, message, metadata) {
  return Notification.create({
    recipient,
    complaint: complaint._id,
    type: 'in_app',
    status: 'sent',
    title,
    message,
    metadata,
    sentAt: new Date()
  });
}

async function createEmailNotification(recipient, complaint, title, message, metadata) {
  const notification = await Notification.create({
    recipient: recipient._id,
    complaint: complaint._id,
    type: 'email',
    status: 'pending',
    title,
    message,
    metadata
  });
  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    notification.status = 'failed';
    notification.failureReason = 'SMTP is not configured';
    await notification.save();
    return notification;
  }

  try {
    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipient.email,
      subject: title,
      text: message
    });
    notification.status = 'sent';
    notification.sentAt = new Date();
  } catch (error) {
    notification.status = 'failed';
    notification.failureReason = error.message.slice(0, 1000);
  }
  await notification.save();
  return notification;
}

export async function notifyComplaintStatusChange({ complaint, previousStatus, status, note }) {
  const recipientIds = [String(complaint.createdBy)];
  if (complaint.assignedTo && String(complaint.assignedTo) !== recipientIds[0]) {
    recipientIds.push(String(complaint.assignedTo));
  }
  const title = `Complaint status updated: ${status}`;
  const message = statusMessage(previousStatus, status, note);
  await notifyRecipients({
    complaint,
    recipientIds,
    title,
    message,
    metadata: { eventType: 'status_changed', previousStatus, status }
  });
}

export async function notifyComplaintSubmitted({ complaint }) {
  await notifyRecipients({
    complaint,
    recipientIds: [String(complaint.createdBy?._id || complaint.createdBy)],
    title: 'Complaint submitted',
    message: `Your complaint "${complaint.title}" was submitted successfully.`,
    metadata: { eventType: 'submitted', status: 'submitted' }
  });
}

export async function notifyVolunteerAssigned({ complaint, volunteerId, reassigned = false }) {
  await notifyRecipients({
    complaint,
    recipientIds: [String(volunteerId)],
    title: reassigned ? 'Complaint reassigned to you' : 'Complaint assigned to you',
    message: reassigned
      ? `Complaint "${complaint.title}" has been reassigned to you.`
      : `Complaint "${complaint.title}" has been assigned to you.`,
    metadata: { eventType: reassigned ? 'reassigned' : 'assigned', status: 'assigned' }
  });
}

export async function notifyComplaintResolved({ complaint, previousStatus, note }) {
  const recipientIds = [String(complaint.createdBy?._id || complaint.createdBy)];
  const assignedVolunteerId = complaint.assignedVolunteer?._id || complaint.assignedVolunteer;
  if (assignedVolunteerId && String(assignedVolunteerId) !== recipientIds[0]) {
    recipientIds.push(String(assignedVolunteerId));
  }
  await notifyRecipients({
    complaint,
    recipientIds,
    title: 'Complaint resolved',
    message: statusMessage(previousStatus, 'resolved', note),
    metadata: { eventType: 'resolved', previousStatus, status: 'resolved' }
  });
}

export async function listNotifications({ page, limit, complaintId, unread }, req) {
  const filter = {
    recipient: new mongoose.Types.ObjectId(req.user.sub),
    type: 'in_app'
  };
  if (complaintId) filter.complaint = new mongoose.Types.ObjectId(complaintId);
  if (unread) filter.status = { $ne: 'read' };

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .populate('complaint', 'title status category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter)
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function markNotificationRead(id, req) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Notification id must be valid');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: req.user.sub, type: 'in_app' },
    { $set: { status: 'read', readAt: new Date() } },
    { new: true }
  );
  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return notification;
}