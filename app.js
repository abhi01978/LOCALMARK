const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============== CITY DETECTION (MUST BE HERE) ===============
function detectCityFromPhone(phone) {
  if (!phone) return "Ghaziabad";
  const num = phone.toString().slice(-10);
  if (['9810','9811','9910','9812'].some(c => num.startsWith(c))) return "Delhi";
  if (['9999','8800','9818'].some(c => num.startsWith(c))) return "Noida";
  if (['9560','120','0120'].some(c => num.startsWith(c))) return "Ghaziabad";
  if (['9971','9813'].some(c => num.startsWith(c))) return "Greater Noida";
  if (num.startsWith('9760')) return "Hapur";
  return "Ghaziabad";
}

// =============== JWT AUTH MIDDLEWARE ===============
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ msg: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ msg: "Invalid token" });
    req.user = user;
    next();
  });
};

// =============== DATABASE ===============
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const User = require('./models/User');
const Booking = require('./models/Booking');

// =============== FIREBASE ADMIN (FOR SENDING NOTIFICATIONS) ===============
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

// =============== ROUTES ===============

app.get(['/signup', '/login', '/services'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', req.path.slice(1) + '.html'));
});

// Signup & Login (tera wahi code — bilkul sahi hai)
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, phone, email, password, role, businessName, serviceCategory } = req.body;

    console.log("Signup Request Body:", req.body);

    // YE THA GALAT → user.length
    // let user = await User.findOne({ phone });
    // if (user.length > 0) return res.status(400)...

    // YE HAI SAHI
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    console.log("Service Category received:", serviceCategory);

    const user = new User({
      fullName,
      phone,
      email: email || null,
      password,
      role: role || 'customer',
      businessName: role === 'provider' ? businessName : null,
      serviceCategory: role === 'provider' ? serviceCategory : null
    });

    await user.save();

    console.log("User saved! serviceCategory =", user.serviceCategory);

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        businessName: user.businessName,
        serviceCategory: user.serviceCategory
      }
    });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true, token,
      user: { id: user._id, fullName: user.fullName, phone: user.phone, role: user.role, businessName: user.businessName, serviceCategory: user.serviceCategory }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Providers List
app.get('/api/providers', async (req, res) => {
  try {
    const { category = 'all' } = req.query;
    const filter = { role: 'provider', serviceCategory: { $exists: true, $ne: null } };
    if (category !== 'all') filter.serviceCategory = category;

    const providers = await User.find(filter).select('fullName businessName phone serviceCategory');
    res.json({ providers });
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

// =============== BOOK NOW - ULTRA DEBUG MODE ===============
app.post('/api/book-now', authenticateToken, async (req, res) => {
  console.log('\n=== BOOK NOW REQUEST AAYA ===');
  console.log('Customer ID:', req.user.id);
  console.log('Request Body:', req.body);

  try {
    const { category } = req.body;
    if (!category) {
      console.log('Category missing!');
      return res.status(400).json({ success: false, msg: "Category missing" });
    }

    const customer = await User.findById(req.user.id);
    if (!customer) {
      console.log('Customer not found in DB');
      return res.status(400).json({ success: false, msg: "Customer not found" });
    }
    console.log('Customer found:', customer.fullName, customer.phone);

    const booking = new Booking({
      customerId: customer._id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      serviceCategory: category,
      status: 'pending'
    });
    await booking.save();
    console.log('Booking saved in DB:', booking._id);

    // YE HAI 100% WORKING QUERY (MongoDB bug fix)
    const allProviders = await User.find({
      role: 'provider',
      serviceCategory: category
    }).select('fullName phone fcmToken businessName');

    // Filter only those who have valid FCM token
    const providers = allProviders.filter(p => 
      p.fcmToken && 
      typeof p.fcmToken === 'string' && 
      p.fcmToken.trim().length > 20
    );

    console.log(`Total providers in ${category}: ${allProviders.length}`);
    console.log(`Online providers (with FCM token): ${providers.length}`);

    if (providers.length === 0) {
      console.log('No providers online right now!');
      return res.json({ 
        success: true, 
        bookingId: booking._id, 
        warning: "No providers online" 
      });
    }

    let sentCount = 0;
    for (const provider of providers) {
      console.log(`Sending to: ${provider.fullName} (${provider.phone})`);
      console.log('FCM Token:', provider.fcmToken.substring(0, 40) + '...');

      try {
        await admin.messaging().send({
          token: provider.fcmToken,
          notification: {
            title: "New Job!",
            body: `${customer.fullName} needs ${category} in ${detectCityFromPhone(customer.phone)}`
          },
          data: {
            type: 'new_booking',
            bookingId: booking._id.toString(),
            customerName: customer.fullName,
            customerPhone: customer.phone,
            category: category
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default'
              }
            }
          }
        });

        console.log(`SUCCESS: Notification sent to ${provider.phone}`);
        sentCount++;

      } catch (error) {
        console.log(`FAILED for ${provider.phone}: ${error.message}`);

        // Agar token invalid ho gaya ho to delete kar do
        if (error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token') {
          console.log('Invalid token, removing from DB...');
          await User.updateOne(
            { _id: provider._id },
            { $unset: { fcmToken: "" } }
          );
        }
      }
    }

    console.log(`FINAL RESULT: ${sentCount}/${providers.length} notifications sent\n`);

    res.json({
      success: true,
      bookingId: booking._id,
      sentTo: sentCount,
      message: sentCount > 0 ? "Providers notified!" : "No one online"
    });

  } catch (err) {
    console.log('BOOK NOW CRASHED:', err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// =============== SAVE FCM TOKEN - DEBUG ===============
// YE PURA ROUTE REPLACE KAR DE
app.post('/api/save-fcm-token', authenticateToken, async (req, res) => {
  try {
    const { token: fcmToken } = req.body;

    if (!fcmToken || fcmToken.length < 50) {
      console.log('Invalid FCM token received');
      return res.status(400).json({ success: false, msg: "Invalid token" });
    }

    console.log(`Saving FCM token for User ID: ${req.user.id}`);
    console.log('Token (first 50):', fcmToken.substring(0, 50) + '...');

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { fcmToken: fcmToken },
      { new: true }
    ).select('fullName phone fcmToken role');

    if (updatedUser) {
      console.log(`FCM Token SUCCESSFULLY SAVED for ${updatedUser.fullName} (${updatedUser.phone})`);
      console.log('Token in DB:', updatedUser.fcmToken?.substring(0, 40) + '...');
    } else {
      console.log('User not found while saving FCM token!');
    }

    res.json({ success: true, saved: !!updatedUser });

  } catch (err) {
    console.log('Save FCM Token ERROR:', err.message);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// server.js mein ye route add kar de
app.post('/api/accept-booking', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const provider = await User.findById(req.user.id);
    
    if (provider.role !== 'provider') {
      return res.status(403).json({ msg: "Only providers can accept" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ msg: "Booking not found" });

    // Agar pehle se kisi ne accept kar liya
    if (booking.status === 'accepted') {
      return res.json({ 
        alreadyAccepted: true, 
        message: "Kisi aur provider ne accept kar liya!" 
      });
    }

    // Accept kar diya
    booking.status = 'accepted';
    booking.acceptedBy = provider._id;
    await booking.save();

    console.log(`Booking accepted by ${provider.fullName}`);

    // Customer ko notification bhej
    const customer = await User.findById(booking.customerId);
    if (customer?.fcmToken) {
      await admin.messaging().send({
        token: customer.fcmToken,
        notification: {
          title: "Booking Confirmed!",
          body: `${provider.fullName} (${provider.businessName || provider.fullName}) ne aapki booking accept kar li. Wo aapko call karenge!`
        },
        data: { type: 'booking_accepted' }
      });
    }

    // Baaki providers ko "kisi aur ne le liya" bhej
    const otherProviders = await User.find({
      role: 'provider',
      serviceCategory: booking.serviceCategory,
      _id: { $ne: provider._id },
      fcmToken: { $exists: true, $ne: null }
    });

    for (const p of otherProviders) {
      if (p.fcmToken) {
        await admin.messaging().send({
          token: p.fcmToken,
          notification: {
            title: "Job Miss Ho Gaya!",
            body: `Ek ${booking.serviceCategory} ki booking kisi aur provider ne le li.`
          },
          data: { type: 'job_taken' }
        });
      }
    }

    // Provider ko customer details bhej
    res.json({
      success: true,
      customer: {
        name: booking.customerName,
        phone: booking.customerPhone
      },
      message: "Booking accepted! Customer ko call kar do!"
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
});
// =============== ACCEPT BOOKING (Provider Side) ===============
app.post('/api/accept-booking', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const provider = await User.findById(req.user.id);
    if (provider.role !== 'provider') return res.status(403).json({ msg: "Access denied" });

    const booking = await Booking.findById(bookingId);
    if (!booking || booking.status !== 'pending') {
      return res.status(400).json({ msg: "Already taken" });
    }

    booking.status = 'accepted';
    booking.acceptedBy = provider._id;
    await booking.save();

    // Notify Customer
    const customer = await User.findById(booking.customerId);
    if (customer?.fcmToken) {
      await admin.messaging().send({
        token: customer.fcmToken,
        notification: { title: "Booking Confirmed!", body: `Your ${booking.serviceCategory} is confirmed! Provider will call soon.` },
        data: { type: 'booking_accepted', bookingId: booking._id.toString(), category: booking.serviceCategory }
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error" });
  }
});

// =============== START SERVER ===============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open: http://localhost:${PORT}/services`);
});