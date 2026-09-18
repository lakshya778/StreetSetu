import mongoose from 'mongoose';

export const COMPLAINT_CATEGORIES = [
  'roads',
  'street_lighting',
  'waste_management',
  'water_supply',
  'drainage',
  'public_safety',
  'parks',
  'sanitation',
  'other'
];

export const COMPLAINT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const COMPLAINT_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'];
export const VOLUNTEER_WORKFLOW_STATUSES = ['assigned', 'in_progress', 'resolved'];

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileName: { type: String, trim: true },
    size: { type: Number, min: 0 },
    storageKey: { type: String, trim: true }
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ['created', 'assigned', 'reassigned', 'status_changed'],
      default: 'status_changed'
    },
    status: { type: String, enum: COMPLAINT_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedVolunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true, maxlength: 1000 },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, required: true, enum: COMPLAINT_CATEGORIES, index: true },
    priority: { type: String, enum: COMPLAINT_PRIORITIES, default: 'medium', index: true },
    status: { type: String, enum: COMPLAINT_STATUSES, default: 'submitted', index: true },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) => coordinates.length === 2
            && coordinates[0] >= -180 && coordinates[0] <= 180
            && coordinates[1] >= -90 && coordinates[1] <= 90,
          message: 'Location coordinates must be [longitude, latitude]'
        }
      }
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      index: true
    },
    address: { type: String, trim: true, maxlength: 500 },
    attachments: { type: [attachmentSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedVolunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    verifiedByCitizen: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    severityScore: { type: Number, default: 50, min: 0, max: 100 },
    isDuplicate: { type: Boolean, default: false },
    masterComplaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
    escalated: { type: Boolean, default: false, index: true },
    escalatedAt: { type: Date },
    statusHistory: { type: [statusHistorySchema], default: [] }
  },
  { timestamps: true }
);

complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ createdBy: 1, createdAt: -1 });
complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });
complaintSchema.index({ wardId: 1, createdAt: -1 });

export default mongoose.model('Complaint', complaintSchema);
