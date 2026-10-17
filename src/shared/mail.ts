/**
 * The sender for all outgoing mail (Cloudflare Email Sending). `void deploy` sets up
 * Email Routing and Email Sending on this address's domain, so use a domain you control.
 * Each restaurant's mail shows its own name as the display name on this address.
 */
export const MAIL_FROM = { name: "Beautifood", email: "receipts@mail.beautifood.app" };
