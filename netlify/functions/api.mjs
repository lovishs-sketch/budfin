import {getStore} from '@netlify/blobs';
import {createHmac,createHash,randomUUID,randomInt,timingSafeEqual} from 'node:crypto';
const E=process.env,SECRET=E.SESSION_SECRET||'',DOM=(E.ALLOWED_DOMAIN||'iitr.ac.in').toLowerCase(),ADM=(E.ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
const st=()=>getStore({name:'budfin',consistency:'strong'});
const json=(o,s=200,h={})=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const err=(m,s=400)=>json({error:m},s);
const sha=s=>createHash('sha256').update(s).digest('hex'),sign=p=>createHmac('sha256',SECRET).update(p).digest('base64url'),uidOf=e=>sha('u:'+e).slice(0,16);
const mint=email=>{const p=Buffer.from(JSON.stringify({e:email,x:Date.now()+30*864e5})).toString('base64url');return p+'.'+sign(p)};
function who(req){const m=/(?:^|;\s*)bf=([^;]+)/.exec(req.headers.get('cookie')||'');if(!m||!SECRET)return null;const [p,s]=m[1].split('.');if(!p||!s)return null;const a=Buffer.from(sign(p)),b=Buffer.from(s);if(a.length!=b.length||!timingSafeEqual(a,b))return null;let o;try{o=JSON.parse(Buffer.from(p,'base64url'))}catch{return null}if(o.x<Date.now())return null;return{email:o.e,id:uidOf(o.e),admin:ADM.includes(o.e)}}
const COLS=['profiles','groups','members','ideas','ideaIn','replies','lf','meetups','reports','config'],BYF=['groups','ideas','replies','lf','meetups','reports'],UF=['members','ideaIn'];
const key=(c,id,g)=>c=='msgs'?`msgs/${g}/${id}`:`${c}/${id}`;
async function rows(pre){const s=st(),{blobs}=await s.list({prefix:pre});const r=await Promise.all(blobs.slice(0,600).map(async b=>{const d=await s.get(b.key,{type:'json'});return d&&{id:b.key.split('/').pop(),...d}}));return r.filter(Boolean)}
async function canMsg(me,g){if(!/^[\w-]{1,200}$/.test(g))return false;if(g.startsWith('dm_'))return g.slice(3).split('_').includes(me.id);if(g.startsWith('g_'))return !!(await st().get('members/'+g.slice(2)+'_'+me.id));return false}
async function seed(){const s=st();if(await s.get('meta/seeded'))return;const o={_o:'seed',by:'seed'},G=[['s1','Sunset Football','⚽','Gym','Friendly 5-a-side match','Today · 6:00 PM','Sports ground',10,1,['football','fitness']],['s2','Chai Point Gang','☕','Chill','Chai and chill break','Now','Canteen / Chai point',8,1,['chai','anime']],['s3','End-Sem Study Circle','📚','Study','Group revision: Physics','Today · 8:00 PM','Cautley Library',8,0,['physics','chess']],['s4','Campus Builders','🛠️','Build','Weekend hack session','Sat · 4:00 PM','Main Building',12,0,['web dev','startups']],['s5','Lo-fi Jam Room','🎸','Music','Open jam, bring any instrument','Tomorrow · 7:00 PM','Other',8,0,['guitar','lo-fi']],['s6','Foodies of IITR','🍜','Food','Try a new café near campus','Sun · 1:00 PM','Other',10,0,['chai','cooking']],['s7','Canal Walkers','🌿','Chill','Evening walk by the canal','Today · 6:30 PM','Ganga Canal bank',6,1,['photography','poetry']]];
 for(const [id,n,em,p,act,when,pl,cap,live,int] of G)await s.setJSON('groups/'+id,{...o,n,em,p,act,when,pl,cap,live,int,ts:Date.now()});
 await s.setJSON('ideas/i1',{...o,t:'Campus carpool app for Delhi trips',b:'Match students heading to Delhi or Dehradun on the same day and split the fare.',ts:Date.now()});
 await s.setJSON('lf/l1',{...o,k:'lost',cat:'Bottle',col:'Blue',sz:'Medium',br:'Milton',loc:'Cautley Library',d:'steel bottle with a dent near the cap',ts:Date.now()});
 await s.setJSON('lf/l2',{...o,k:'found',cat:'ID card',col:'White',sz:'Small',br:'',loc:'Main Building',d:'IITR student ID card, name Ravi',ts:Date.now()});
 await s.set('meta/seeded','1')}
async function write(me,b){const{op,col}=b;if(![...COLS,'msgs'].includes(col))return err('bad collection');const s=st();let data=b.data&&typeof b.data=='object'?{...b.data}:{};for(const k of Object.keys(data))if(k[0]=='_')delete data[k];if(JSON.stringify(data).length>4000)return err('Too large');
 if(col=='msgs'){const g=String(data.g||'');if(op!='add'||!await canMsg(me,g))return err('Forbidden',403);const i=randomUUID().slice(0,12);await s.setJSON(key('msgs',i,g),{g,u:me.id,t:String(data.t||'').slice(0,500),ts:Date.now()});return json({id:i})}
 const nid=op=='add'?randomUUID().slice(0,12):b.id;if(!/^[\w-]{1,100}$/.test(nid||''))return err('Bad id');const k=key(col,nid),old=await s.get(k,{type:'json'});
 if(op=='delete'){if(!old)return json({ok:1});if(!(me.admin||old._o==me.id))return err('Forbidden',403);await s.delete(k);return json({ok:1})}
 if(col=='config'&&!me.admin)return err('Forbidden',403);if(col=='profiles'&&nid!=me.id)return err('Forbidden',403);
 if(old&&!(me.admin||old._o==me.id))return err('Forbidden',403);if(!old&&op=='update')return err('Not found',404);
 if(old){delete data.by;delete data.u;delete data.g}else{
  if(BYF.includes(col))data.by=me.id;
  if(UF.includes(col)){if(!nid.endsWith('_'+me.id))return err('Forbidden',403);data.u=me.id;const parent=nid.slice(0,-me.id.length-1);
   if(col=='members'){const gr=await s.get('groups/'+parent,{type:'json'});if(!gr)return err('No such group');if((await s.list({prefix:'members/'+parent+'_'})).blobs.length>=gr.cap)return err('Group is full');data.g=parent}else data.i=parent}
  if(col=='meetups'&&!await s.get('members/'+data.g+'_'+me.id))return err('Join the group first',403)}
 if(col=='profiles'&&data.lat!=null)data.seen=Date.now();
 await s.setJSON(k,op=='update'&&old?{...old,...data}:{...data,_o:old?old._o:me.id});return json({id:nid})}
export default async req=>{try{const p=new URL(req.url).pathname.replace(/^\/api\/?/,''),b=req.method=='POST'?await req.json().catch(()=>({})):{};
 if(!SECRET)return err('Server not configured: set SESSION_SECRET',500);const s=st();
 if(p=='auth/request'){const e=String(b.email||'').trim().toLowerCase();if(!/^[^@\s]+@[a-z0-9.-]+$/.test(e)||!(e.endsWith('@'+DOM)||e.endsWith('.'+DOM)))return err('Use your @'+DOM+' email');
  const k='otp/'+uidOf(e),o=await s.get(k,{type:'json'});if(o&&Date.now()-o.t<45e3)return err('Wait a moment before requesting another code',429);
  const code=String(randomInt(1e5,1e6));await s.setJSON(k,{h:sha(code+SECRET+e),x:Date.now()+6e5,n:0,t:Date.now()});
  if(E.RESEND_API_KEY){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+E.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:E.MAIL_FROM,to:[e],subject:'Your BudFin code: '+code,text:'Your BudFin sign-in code is '+code+'. It expires in 10 minutes.'})});if(!r.ok)return err('Could not send email',502);return json({ok:1})}
  if(E.DEV_OTP=='1')return json({ok:1,dev:code});return err('Email sending is not configured',500)}
 if(p=='auth/verify'){const e=String(b.email||'').trim().toLowerCase(),k='otp/'+uidOf(e),o=await s.get(k,{type:'json'});if(!o||o.x<Date.now()||o.n>=5)return err('Code expired. Request a new one.');
  if(sha(String(b.code||'')+SECRET+e)!=o.h){await s.setJSON(k,{...o,n:o.n+1});return err('Wrong code')}await s.delete(k);
  return json({ok:1},200,{'set-cookie':`bf=${mint(e)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`})}
 const me=who(req);if(!me)return err('Sign in required',401);
 if(p=='me')return json({id:me.id,email:me.email,admin:me.admin});
 if(p=='sync'){await seed();const out={};for(const c of (b.cols||[]).filter(c=>COLS.includes(c)))out[c]=c=='reports'&&!me.admin?[]:await rows(c+'/');return json(out)}
 if(p=='db'){if(b.op=='list'){const g=String(b.where?.g||'');if(b.col!='msgs'||!await canMsg(me,g))return err('Forbidden',403);return json({rows:(await rows('msgs/'+g+'/')).sort((a,c)=>a.ts-c.ts).slice(-100)})}return write(me,b)}
 if(p=='ai'){if(!E.ANTHROPIC_API_KEY)return err('AI not configured',501);const k='ai/'+me.id+'-'+Math.floor(Date.now()/36e5),n=+(await s.get(k)||0);if(n>=20)return err('Hourly AI limit reached',429);await s.set(k,String(n+1));
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':E.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:E.AI_MODEL||'claude-haiku-5-5',max_tokens:300,messages:[{role:'user',content:String(b.prompt||'').slice(0,2000)}]})});const j=await r.json();return json({text:(j.content||[]).map(x=>x.text||'').join('')})}
 return err('Not found',404)}catch(x){return err('Server error',500)}};
export const config={path:'/api/*'};
