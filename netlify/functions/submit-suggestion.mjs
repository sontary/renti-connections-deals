import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { requireAgent, json, getAccessToken, base64url, htmlEscape } from './gmail-common.mjs';

const PRIMARY_ADMIN_EMAIL = 'sontary@renti.co';

function suggestionStore(){ return getStore('agent-suggestions'); }

function mime({ to, subject, html, messageId }){
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    `Message-ID: ${messageId}`,
  ];
  return `${headers.join('\r\n')}\r\n\r\n${html}`;
}

async function notifyPrimaryAdmin(auth, message){
  // Best-effort only — if the submitting agent hasn't connected Gmail themselves,
  // or the send fails for any reason, the suggestion is still safely stored either
  // way. A missed notification is recoverable (it's sitting in the Suggestions tab);
  // a lost suggestion would not be.
  try{
    const { accessToken } = await getAccessToken(auth.email);
    const agentName = auth.user?.user_metadata?.full_name || auth.user?.user_metadata?.name || auth.email.split('@')[0];
    const when = new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' });
    const html = `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#243128;max-width:560px;">
      <p style="margin:0 0 12px;">New suggestion from <strong>${htmlEscape(agentName)}</strong> (${htmlEscape(auth.email)}), ${htmlEscape(when)}:</p>
      <div style="padding:12px 14px;border:1px solid #e5dfd2;border-left:3px solid #ff6537;border-radius:8px;background:#fffaf5;">${htmlEscape(message)}</div>
      <p style="margin:16px 0 0;color:#5c675e;font-size:11.5px;">Manage this in the Suggestions tab in the portal.</p>
    </div>`;
    const msgId = `<renti-suggestion-${crypto.randomUUID()}@renti.co>`;
    const raw = base64url(mime({ to: PRIMARY_ADMIN_EMAIL, subject: `New agent suggestion from ${agentName}`, html, messageId: msgId }));
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    return r.ok;
  }catch{
    return false;
  }
}

function sameOrigin(req){
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export default async (req) => {
  const auth = await requireAgent();
  if (auth.error) return auth.error;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!sameOrigin(req)) return json({ error: 'Invalid request origin' }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const message = String(body?.message || '').trim();
  const privateNote = body?.private === true;
  if (!message) return json({ error: 'Write something before sending.' }, 400);
  if (message.length > 2000) return json({ error: 'Keep it under 2000 characters.' }, 400);
  if (privateNote && auth.email.toLowerCase() !== PRIMARY_ADMIN_EMAIL) return json({ error: 'Only the Primary Admin can create private notes.' }, 403);

  const agentName = auth.user?.user_metadata?.full_name || auth.user?.user_metadata?.name || auth.email.split('@')[0];
  const id = crypto.randomUUID();
  const record = {
    id,
    agentEmail: auth.email,
    agentName,
    message,
    private: privateNote,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await suggestionStore().setJSON(id, record);
  const notified = privateNote ? false : await notifyPrimaryAdmin(auth, message);

  return json({ ok: true, id, notified });
};
