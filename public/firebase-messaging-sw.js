// public/firebase-messaging-sw.js  ← PURA FILE ISSE REPLACE KAR DE

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Apna Firebase config daal dena
firebase.initializeApp({
 apiKey: "AIzaSyAiHAhRvakTIAkJCxsfYBVMo-TfTmQwFnA",
  authDomain: "astroguru-chat.firebaseapp.com",
  projectId: "astroguru-chat",
  storageBucket: "astroguru-chat.firebasestorage.app",
  messagingSenderId: "709987887042",
  appId: "1:709987887042:web:2eac33a465a2399c16d85b",
});

const messaging = firebase.messaging();

// Background notification — sirf simple dikhao
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Job!";
  const body = payload.notification?.body || "Customer ko call karo";

  self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'new-job-' + Date.now(),
    data: payload.data,
    silent: false,
    requireInteraction: false
  });
});

// Notification click handler — direct call
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const phone = event.notification.data?.customerPhone;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {

      // If app is open → send phone & trigger dialer
      if (clientList.length > 0) {
        const client = clientList[0];
        client.focus();
        client.postMessage({ phone });
        return;
      }

      // If app is NOT open → open call.html for auto call
      return clients.openWindow('/call.html?autoCall=' + phone);
    })
  );
});
