import crypto from 'node:crypto';
import { requireAgent, json, oauthConfig, GMAIL_SCOPES } from './gmail-common.mjs';

function makeState(email, secret) {
  const payload = Buffer.from(JSON.stringify({ email, createdAt: Date.now() }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export default async () => {
  try {
    const auth = await requireAgent();
    if (auth.error) return auth.error;
    const cfg = oauthConfig();
    if (!cfg) return json({ error: 'Gmail OAuth environment variables are not configured yet.' }, 503);
    const state = makeState(auth.email, cfg.clientSecret);
    const q = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline',
      prompt: 'consent select_account',
      include_granted_scopes: 'true',
      state,
      login_hint: auth.email,
    });
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}` });
  } catch (error) {
    console.error('gmail-oauth-start failed', error);
    return json({ error: `Could not start Gmail connection: ${error?.message || 'Unknown server error'}` }, 500);
  }
};
