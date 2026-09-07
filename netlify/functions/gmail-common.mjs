import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

export const DOMAIN='@renti.co';
export const GMAIL_SCOPES='openid email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic';

export function json(data,status=200){return Response.json(data,{status,headers:{'cache-control':'no-store'}});}
export function allowedEmail(email){return typeof email==='string'&&email.trim().toLowerCase().endsWith(DOMAIN);}
export async function requireAgent(){
  const user=await getUser();
  if(!user||!allowedEmail(user.email)) return {error:json({error:'Please sign in with your approved Renti account.'},401)};
  return {user,email:user.email.trim().toLowerCase()};
}
export function oauthConfig(){
  const clientId=process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret=process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const base=process.env.URL;
  if(!clientId||!clientSecret||!base) return null;
  return {clientId,clientSecret,redirectUri:`${base.replace(/\/$/,'')}/.netlify/functions/gmail-oauth-callback`};
}
export function stateStore(){return getStore('gmail-oauth-state');}
export function tokenStore(){return getStore('gmail-agent-tokens');}
export function threadStore(){return getStore('gmail-comparison-threads');}
export function safeKey(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
export function decodeJwtPayload(token){
  try{const p=token.split('.')[1];return JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));}catch{return null;}
}
export async function loadToken(email){return await tokenStore().get(email,{type:'json'});}
export async function saveToken(email,data){await tokenStore().setJSON(email,data);}
export async function getAccessToken(email){
  const cfg=oauthConfig(); if(!cfg) throw new Error('Gmail OAuth is not configured.');
  const token=await loadToken(email); if(!token?.refresh_token) throw new Error('Gmail is not connected for this agent.');
  if(token.access_token&&token.expires_at&&Date.now()<token.expires_at-60000) return {accessToken:token.access_token,token};
  const body=new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:token.refresh_token,grant_type:'refresh_token'});
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data=await r.json(); if(!r.ok) throw new Error(data.error_description||data.error||'Could not refresh Gmail access.');
  const updated={...token,access_token:data.access_token,expires_at:Date.now()+(Number(data.expires_in||3600)*1000),scope:data.scope||token.scope};
  await saveToken(email,updated); return {accessToken:data.access_token,token:updated};
}
export function base64url(text){return Buffer.from(text,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function htmlEscape(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
