// models/Booking.js  ← YE SABSE SAFE AUR FINAL VERSION HAI

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  serviceCategory: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'cancelled', 'completed'], 
    default: 'pending' 
  },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acceptedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// MIDDLEWARE PURA DELETE KAR DIYA — KOI CHANCE NAHI ERROR KA
// koi pre('save') nahi hai ab

module.exports = mongoose.model('Booking', bookingSchema);