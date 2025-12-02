// public/firebase-messaging-sw.js
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
  if (payload.data?.type === 'new_booking') {
    const customerPhone = payload.data.customerPhone;

    return self.registration.showNotification("New Job Alert!", {
      body: `${payload.notification.body}`,
      icon: "/icon-192.png",
      badge: "/badge.png",
      tag: payload.data.bookingId, // duplicate prevent
      actions: [
        {
          action: 'call',
          title: 'Call Now',
          icon: '/phone-icon.png'
        }
      ],
      data: { phone: customerPhone, bookingId: payload.data.bookingId }
    });
  }
});

// Notification click → direct call
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'call' || !event.action) {
    const phone = event.notification.data.phone;
    clients.matchAll().then(clientsArr => {
      if (clientsArr.length > 0) {
        clientsArr[0].postMessage({ action: 'CALL_CUSTOMER', phone });
      } else {
        // fallback
        clients.openWindow(`tel:${phone}`);
      }
    });
  }
});
