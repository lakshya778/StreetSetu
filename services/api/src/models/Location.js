const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120,
  },
  type: {
    type: String,
    required: true,
    enum: ['ward', 'neighbourhood', 'street', 'landmark', 'building', 'area'],
  },
  parentLocationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
  },
  city: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  state: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  country: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  addressText: {
    type: String,
    default: '',
    trim: true,
  },
  geometry: {
    type: {
      type: String,
      enum: ['Point', 'Polygon', 'MultiPolygon', 'LineString'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

locationSchema.index({ parentLocationId: 1, type: 1, city: 1 });
locationSchema.index({ type: 1, city: 1, state: 1 });
locationSchema.index({ geometry: '2dsphere' });
locationSchema.index({ name: 'text', addressText: 'text' });

module.exports = mongoose.models.Location || mongoose.model('Location', locationSchema);
