// Service worker for payload-less Web Push: on a push "tickle", fetch the ticket and show a notification.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "Beautifood";
      let body = "There's an update on your queue ticket.";
      try {
        const url = await (await caches.open("bf")).match("ticket-url").then((r) => (r ? r.text() : null));
        const t = url ? await (await fetch(url)).json() : null;
        if (t?.status === "called") {
          title = `${t.number}: your table is ready!`;
          body = "Please come to the host stand.";
        } else if (t?.status === "seated") {
          title = `${t.number}: enjoy your meal`;
          body = "Open your table's menu to order.";
        }
      } catch (e) {}
      await self.registration.showNotification(title, { body, tag: "bf-ticket", renotify: true, icon: "/icon-192.png" });
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.ticketUrl) event.waitUntil(caches.open("bf").then((c) => c.put("ticket-url", new Response(event.data.ticketUrl))));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow("/"))));
});
