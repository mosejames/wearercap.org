// Recipient and message are always derived from verified identity and earned badges.
const names={10:'Memory maker',50:'Moment keeper',100:'House storyteller',250:'Friendship champion',500:'Vault legend'};
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const account=process.env.TWILIO_ACCOUNT_SID, token=process.env.TWILIO_AUTH_TOKEN, service=process.env.TWILIO_MESSAGING_SERVICE_SID;
  const available=!!(account && token && service);
  if(req.method==='GET') return res.status(200).json({available});
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!available) return res.status(503).json({error:'Milestone texts are not configured yet.'});
  const authorization=req.headers.authorization;
  if(!authorization?.startsWith('Bearer ')) return res.status(401).json({error:'Sign in first.'});
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const rpc=async(name,body={})=>{
    const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error('Unable to access milestone messages.');
    const text=await response.text(); return text?JSON.parse(text):null;
  };
  let accepted=0;
  try {
    for(let i=0;i<5;i++) {
      const job=await rpc('vault_take_badge_text'); if(!job) break;
      if(!names[job.milestone]) throw new Error('Invalid milestone.');
      const body=new URLSearchParams({To:`+${job.phone.replace(/\D/g,'')}`,MessagingServiceSid:service,Body:`Ami Vault: You earned ${names[job.milestone]}! ${job.milestone} photos shared, so many memories kept. Our family is better with you in it. See your badge: https://wearercap.org/ami-vault/#/me Reply STOP to opt out.`});
      const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${account}:${token}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      if(!response.ok) {
        await rpc('vault_finish_badge_text',{p_milestone:job.milestone,p_provider_id:String(result.code || ''),p_failed:true});
        if(result.code===21610) await rpc('vault_set_badge_text_preference',{p_enabled:false});
        return res.status(502).json({error:'The text provider could not accept the milestone message.'});
      }
      await rpc('vault_finish_badge_text',{p_milestone:job.milestone,p_provider_id:result.sid,p_failed:false}); accepted++;
    }
    return res.status(200).json({accepted});
  } catch { return res.status(502).json({error:'Milestone text status is uncertain. Your badge is saved.'}); }
}
