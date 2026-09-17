import crypto from 'node:crypto';
import { oauthConfig, saveToken, decodeJwtPayload, allowedEmail, loadToken } from './gmail-common.mjs';

function redirect(url){ return new Response(null,{status:302,headers:{location:url}}); }
function verifyState(state, secret) {
  try {
    const [payload, sig] = String(state || '').split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.email || Date.now() - Number(data.createdAt || 0) > 10 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

export default async(req)=>{
  try {
    const base = process.env.URL || new URL(req.url).origin;
    const u = new URL(req.url); const error = u.searchParams.get('error');
    if(error) return redirect(`${base}/?gmail=error&reason=${encodeURIComponent(error)}`);
    const code=u.searchParams.get('code'), state=u.searchParams.get('state');
    if(!code||!state) return redirect(`${base}/?gmail=error&reason=missing_callback_data`);
    const cfg=oauthConfig(); if(!cfg) return redirect(`${base}/?gmail=error&reason=oauth_not_configured`);
    const saved = verifyState(state, cfg.clientSecret);
    if(!saved) return redirect(`${base}/?gmail=error&reason=expired_or_invalid_state`);
    const expected=String(saved.email).toLowerCase();
    const body=new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,code,grant_type:'authorization_code',redirect_uri:cfg.redirectUri});
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
    const data=await r.json(); if(!r.ok) return redirect(`${base}/?gmail=error&reason=${encodeURIComponent(data.error_description||data.error||'token_exchange_failed')}`);
    const id=decodeJwtPayload(data.id_token||''); const googleEmail=String(id?.email||'').toLowerCase();
    if(!allowedEmail(googleEmail)||googleEmail!==expected) return redirect(`${base}/?gmail=wrong-account`);
    const existing=await loadToken(expected);
    await saveToken(expected,{...existing,...data,refresh_token:data.refresh_token||existing?.refresh_token,expires_at:Date.now()+(Number(data.expires_in||3600)*1000),connected_at:Date.now()});
    return redirect(`${base}/?gmail=connected`);
  } catch (error) {
    console.error('gmail-oauth-callback failed', error);
    const base = process.env.URL || new URL(req.url).origin;
    return redirect(`${base}/?gmail=error&reason=${encodeURIComponent(error?.message||'callback_failed')}`);
  }
};
