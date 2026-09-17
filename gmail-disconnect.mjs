import { requireAgent,json,tokenStore } from './gmail-common.mjs';
export default async(req)=>{
  try{
    const auth=await requireAgent();if(auth.error)return auth.error;
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    await tokenStore().delete(auth.email).catch(()=>{});
    return json({ok:true});
  }catch(error){console.error('gmail-disconnect failed',error);return json({error:'Could not disconnect Gmail right now.'},500);}
};
