import crypto from 'node:crypto';
import { requireAgent,json,getAccessToken,threadStore,safeKey,base64url,htmlEscape } from './gmail-common.mjs';

async function gmailSignature(accessToken,email){
  const r=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs/${encodeURIComponent(email)}`,{headers:{authorization:`Bearer ${accessToken}`}});
  if(!r.ok)return '';
  const d=await r.json(); return d.signature||'';
}
function stripPlaceholder(html){return String(html||'').replace(/<div class="agent-signature"[^>]*>[\s\S]*?Gmail signature will be inserted here when Gmail is connected\.[\s\S]*?<\/div>/i,'');}
function mime({to,subject,html,messageId,inReplyTo,references}){
  const headers=[`To: ${to}`,`Subject: ${subject}`,'MIME-Version: 1.0','Content-Type: text/html; charset="UTF-8"','Content-Transfer-Encoding: 8bit',`Message-ID: ${messageId}`];
  if(inReplyTo)headers.push(`In-Reply-To: ${inReplyTo}`); if(references)headers.push(`References: ${references}`);
  return `${headers.join('\r\n')}\r\n\r\n${html}`;
}
export default async(req)=>{
  const auth=await requireAgent(); if(auth.error)return auth.error;
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  let b;try{b=await req.json();}catch{return json({error:'Invalid request.'},400);}
  const to=String(b.to||'').trim(),address=String(b.address||'').trim(),requestedSubject=String(b.subject||'').trim(),signatureMode=String(b.signatureMode||'gmail');
  if(!to||!/^\S+@\S+\.\S+$/.test(to))return json({error:'A valid customer email is required.'},400);
  if(!address)return json({error:'Property address is required.'},400);
  if(!requestedSubject)return json({error:'Subject is required.'},400);
  let html=String(b.html||'').trim(); if(!html)return json({error:'Email content is empty.'},400);
  const {accessToken}=await getAccessToken(auth.email);
  if(signatureMode==='gmail'){
    html=stripPlaceholder(html);
    const sig=await gmailSignature(accessToken,auth.email);
    const fallback=`<p style="margin:18px 0 0;">Ngā mihi,<br><strong>${htmlEscape(auth.user?.user_metadata?.full_name||auth.user?.user_metadata?.name||auth.email.split('@')[0])}</strong><br>Renti Connections</p>`;
    const signatureBlock=sig?`<div style="margin-top:18px">${sig}</div>`:fallback;
    if(html.includes('<!-- RENTI_SIGNATURE_SLOT -->')) html=html.replace('<!-- RENTI_SIGNATURE_SLOT -->',signatureBlock);
    else html+=signatureBlock;
  }
  const key=`${auth.email}|${to.toLowerCase()}|${address.toLowerCase().replace(/\s+/g,' ')}`;
  const store=threadStore(); const threadKey=safeKey(key); const prior=await store.get(threadKey,{type:'json'});
  const subject=prior?.subject||requestedSubject;
  const domain='renti.co'; const msgId=`<renti-${crypto.randomUUID()}@${domain}>`;
  const raw=base64url(mime({to,subject,html,messageId:msgId,inReplyTo:prior?.lastMessageId||'',references:prior?.references||prior?.lastMessageId||''}));
  const body={raw}; if(prior?.threadId)body.threadId=prior.threadId;
  const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json(); if(!r.ok)return json({error:data?.error?.message||'Gmail could not send the comparison.'},r.status||500);
  const refs=[prior?.references,prior?.lastMessageId].filter(Boolean).join(' ').trim();
  await store.setJSON(threadKey,{threadId:data.threadId,subject,to,address,lastMessageId:msgId,references:refs||msgId,updatedAt:new Date().toISOString()});
  return json({ok:true,messageId:data.id,threadId:data.threadId,threaded:!!prior?.threadId,subjectUsed:subject});
};
