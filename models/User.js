const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// उन सभी संभावित कैटेगरीज को परिभाषित करें जो आपके फ्रंटएंड (services.html) में हैं।
// इससे डेटाबेस में स्पेलिंग की गलतियां कम होंगी।
const validCategories = [
    'Electrician', 
    'Plumber', 
    'AC Repair', 
    'Carpenter', 
    'Painter', 
    'Cleaning', 
    'Pest Control', 
    'Beauty'
];

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { 
    type: String, 
    required: true, 
    unique: true,
    match: [/^\d{10}$/, 'Enter valid 10-digit phone number']
  },
  email: { type: String, trim: true, lowercase: true, sparse: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'provider'], default: 'customer' },
  businessName: { type: String, trim: true },
  
  // ✅ NEW FIELD: Service Category
  // यह फील्ड केवल 'provider' के लिए आवश्यक हो सकता है।
  serviceCategory: { 
    type: String, 
    enum: validCategories, // केवल ये वैल्यूज ही स्वीकार्य होंगी
    trim: true 
  },
  fcmToken: { type: String, default: null },
  
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

// Pre-save hook for password hashing (unchanged)
userSchema.pre('save', async function() {
  // Check if the password field is being modified
  if (!this.isModified('password')) {
    return; // Stop and proceed to save if password is not modified
  } 
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);