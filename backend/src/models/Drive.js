import mongoose from 'mongoose';

const participationEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  joinedAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const driveSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    locationText: { type: String, required: true, trim: true, maxlength: 240 },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    date: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    participantHistory: { type: [participationEventSchema], default: [] },
    status: { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming', index: true }
  },
  { timestamps: true }
);

driveSchema.index({ status: 1, date: 1 });
driveSchema.index({ 'participantHistory.user': 1 });

export default mongoose.model('Drive', driveSchema);
