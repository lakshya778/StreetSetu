const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 180,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 20,
  },
  category: {
    type: String,
    required: true,
    enum: ['water', 'sanitation', 'road', 'streetlight', 'garbage', 'drainage', 'public_safety', 'other'],
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
  },
  wardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
  },
  neighbourhoodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
  },
  reporterUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedToUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'assigned', 'in_progress', 'resolved', 'rejected', 'escalated'],
    default: 'submitted',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  source: {
    type: String,
    enum: ['citizen', 'volunteer', 'officer', 'admin', 'api'],
    default: 'citizen',
  },
  addressText: {
    type: String,
    default: '',
  },
  imageUrls: [{ type: String }],
  videoUrls: [{ type: String }],
  aiClassification: {
    category: { type: String, default: null },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    summary: { type: String, default: '' },
    duplicateMatchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }],
  },
  slaDeadline: {
    type: Date,
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

complaintSchema.index({ complaintNumber: 1 }, { unique: true });
complaintSchema.index({ status: 1 });
complaintSchema.index({ priority: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ departmentId: 1 });
complaintSchema.index({ wardId: 1 });
complaintSchema.index({ neighbourhoodId: 1 });
complaintSchema.index({ reporterUserId: 1 });
complaintSchema.index({ assignedToUserId: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ locationId: 1 });
complaintSchema.index({ title: 'text', description: 'text', addressText: 'text' });

module.exports = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);
