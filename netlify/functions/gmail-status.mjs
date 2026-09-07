import { requireAgent,json,loadToken,getAccessToken } from './gmail-common.mjs';
export default async()=>{
  try{
    const auth=await requireAgent(); if(auth.error)return auth.error;
    const token=await loadToken(auth.email); if(!token?.refresh_token)return json({connected:false,email:auth.email});
    try{await getAccessToken(auth.email);return json({connected:true,email:auth.email,connectedAt:token.connected_at||null});}
    catch{return json({connected:false,email:auth.email,needsReconnect:true});}
  }catch(error){console.error('gmail-status failed',error);return json({error:'Could not check Gmail connection right now.'},500);}
};
