import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';

const PRIMARY_ADMIN_EMAIL = 'sontary@renti.co';
const VALID_STATUSES = ['pending', 'reviewing', 'resolved', 'declined'];

function json(data, status = 200) { return Response.json(data, { status }); }
function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}
function isPrimaryAdmin(user) {
  const email = (user?.email || '').toLowerCase();
  return email === PRIMARY_ADMIN_EMAIL;
}
function suggestionStore(){ return getStore('agent-suggestions'); }

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!sameOrigin(req)) return json({ error: 'Invalid request origin' }, 403);

  const user = await getUser();
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!isPrimaryAdmin(user)) return json({ error: 'Only the Primary Admin can update suggestions.' }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const id = String(body?.id || '').trim();
  const status = String(body?.status || '').trim().toLowerCase();
  if (!id) return json({ error: 'Missing suggestion id.' }, 400);
  if (!VALID_STATUSES.includes(status)) return json({ error: 'Invalid status.' }, 400);

  const store = suggestionStore();
  const existing = await store.get(id, { type: 'json' });
  if (!existing) return json({ error: 'Suggestion not found.' }, 404);

  const updated = { ...existing, status, updatedAt: new Date().toISOString() };
  await store.setJSON(id, updated);

  return json({ ok: true, suggestion: updated });
};
