import { random } from './security.mjs';
export const production = process.env.NODE_ENV === 'production';
export const realMail = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
// Memory-only mailbox for loopback development. Never exposed in production.
export const mailbox = [];
export async function sendMail(to, subject, message) {
  if (!realMail) {
    if (production) throw new Error('E-mail não configurado.');
    mailbox.push({ id: random(), to, subject, message, created: Date.now() });
    if (mailbox.length > 50) mailbox.shift();
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text: message }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Não foi possível enviar o e-mail. Tente novamente mais tarde.');
}
export function clearMailbox(to) { for (let i = mailbox.length - 1; i >= 0; i--) if (mailbox[i].to === to) mailbox.splice(i, 1); }
