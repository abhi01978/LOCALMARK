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

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Job!";
  const options = {
    body: payload.notification?.body || "Tap to call customer",
    icon: "/icon-192.png",
    badge: "/badge.png",
    tag: payload.data?.bookingId,
    data: { phone: payload.data?.customerPhone },
    actions: [{ action: "call", title: "Call Now" }]
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const phone = event.notification.data?.phone;
  if (phone) {
    clients.openWindow(`tel:${phone}`);
  }
});
