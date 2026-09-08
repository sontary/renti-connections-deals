import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';

const PRIMARY_ADMIN_EMAIL = 'sontary@renti.co';

function json(data, status = 200) { return Response.json(data, { status }); }
function isPrimaryAdmin(user) {
  const email = (user?.email || '').toLowerCase();
  return email === PRIMARY_ADMIN_EMAIL;
}
function suggestionStore(){ return getStore('agent-suggestions'); }

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const user = await getUser();
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (!isPrimaryAdmin(user)) return json({ error: 'Only the Primary Admin can view suggestions.' }, 403);

  const store = suggestionStore();
  const { blobs } = await store.list();
  const records = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  const suggestions = records
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json({ suggestions });
};
