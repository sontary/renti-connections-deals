import { getStore } from '@netlify/blobs';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const store = getStore('provider-catalog');
    const published = await store.get('published', { type: 'json' });
    return json({ catalog: published?.catalog || null, revision: published?.revision || 0, publishedAt: published?.publishedAt || null });
  } catch (error) {
    console.error('provider-catalog failed', error);
    return json({ error: 'Could not load the provider catalogue.' }, 500);
  }
};
