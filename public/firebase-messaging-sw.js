importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAiHAhRvakTIAkJCxsfYBVMo-TfTmQwFnA",
  authDomain: "astroguru-chat.firebaseapp.com",
  projectId: "astroguru-chat",
  storageBucket: "astroguru-chat.firebasestorage.app",
  messagingSenderId: "709987887042",
  appId: "1:709987887042:web:2eac33a465a2399c16d85b"
});

const messaging = firebase.messaging();
// Background notification click → direct call
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Job!";
  const options = {
    body: payload.notification?.body,
    icon: '/icon.png',
    badge: '/badge.png',
    tag: payload.data?.bookingId,
    data: payload.data,          // yeh important hai
    actions: [
      { action: 'call', title: 'Call Customer', icon: '/call-icon.png' },
      { action: 'ignore', title: 'Ignore' }
    ]
  };

  self.registration.showNotification(title, options);
});

// Notification click pe direct call
// NOTIFICATION CLICK → DIRECT CALL LAG JAYEGI!
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const phone = event.notification.data?.customerPhone;

  if (event.action === 'call' && phone) {
    // DIRECT CALL LAG JAYEGI — KOI PAGE NAHI KHULEGA!
    clients.openWindow(`tel:${phone}`);
  } 
  else if (event.action === 'later' || !event.action) {
    // Agar sirf notification tap kiya (bina button ke) ya "later" dabaya
    // To kuch mat khol — ya agar chahe to apna main page khol sakta hai
    // Abhi ke liye kuch nahi khol rahe — sirf call option hai
  }
});
