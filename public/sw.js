self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "A new community site is live." };
  }
  const target = typeof data.url === "string" && data.url.startsWith("https://") ? data.url : "https://base31.org/";
  event.waitUntil(self.registration.showNotification(data.title || "A new site is live on base31", {
    body: data.body || "Discover the newest community site in the base31 directory.",
    icon: "/icons/base31-icon-192.png",
    badge: "/icons/base31-icon-192.png",
    tag: data.tag || "base31-new-site",
    data: { url: target },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url || "https://base31.org/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if (client.url === target && "focus" in client) return client.focus();
    }
    return clients.openWindow ? clients.openWindow(target) : undefined;
  }));
});
