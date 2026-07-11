// api/contact.js — Vercel Serverless Function für business-angel-invest.eu
// RESEND_API_KEY als Vercel Environment Variable hinterlegen

const ALLOWED_ORIGINS = [
  'https://www.business-angel-invest.eu',
  'https://business-angel-invest.eu',
]

function sanitize(str){if(typeof str!=='string')return '';return str.replace(/[<>]/g,'').trim().slice(0,2000);}
const rateLimitMap=new Map();
function isRateLimited(ip){const now=Date.now();const entry=rateLimitMap.get(ip)||{count:0,resetAt:now+3600000};if(now>entry.resetAt){entry.count=0;entry.resetAt=now+3600000;}entry.count++;rateLimitMap.set(ip,entry);return entry.count>3;}

// Catches bot-generated random tokens that are short enough to slide past a simple
// length check but look nothing like a real word: very few vowels AND unnaturally
// frequent upper/lowercase switching. Both conditions required together to avoid
// flagging real oddly-cased words (e.g. "McDonald").
// E-Mail-Blockliste — normalisiert Gmail-Punkte/Plus-Tags, damit Bots sie nicht
// durch e.dip.a.ju.l.o.d.ev.8.5@gmail.com vs. ed.ip.ajulo.de.v85@gmail.com umgehen.
const BLOCKED_EMAILS = new Set([
  'edipajulodev85@gmail.com',
]);
function normalizeEmail(email) {
  const e = (email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at === -1) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  local = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
  }
  return local + '@' + (domain === 'googlemail.com' ? 'gmail.com' : domain);
}

function isGibberish(str) {
  const words = (str || '').split(/\s+/).filter(w => w.length >= 6);
  const vowelChars = 'aeiouyAEIOUYäöüÄÖÜàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ';
  for (const word of words) {
    const letters = word.replace(/[^a-zA-ZäöüÄÖÜßàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ]/g, '');
    if (letters.length < 6) continue;
    let vowels = 0;
    for (const ch of letters) if (vowelChars.includes(ch)) vowels++;
    const vowelRatio = vowels / letters.length;
    let transitions = 0;
    for (let i = 1; i < letters.length; i++) {
      const prevUpper = letters[i - 1] === letters[i - 1].toUpperCase() && letters[i - 1] !== letters[i - 1].toLowerCase();
      const curUpper = letters[i] === letters[i].toUpperCase() && letters[i] !== letters[i].toLowerCase();
      if (prevUpper !== curUpper) transitions++;
    }
    const transitionRatio = transitions / (letters.length - 1);
    // Tiered threshold: longer strings need a less extreme vowel-ratio to be flagged,
    // since genuine long words (esp. German compounds) always carry a healthy vowel
    // share, while short strings need a stricter cutoff to avoid catching real
    // camelCase brand names (McDonald, PayPal, JavaScript...).
    const vowelThreshold = letters.length >= 14 ? 0.28 : (letters.length >= 11 ? 0.22 : 0.16);
    if (vowelRatio < vowelThreshold && transitionRatio > 0.3) return true;
  }
  if (/\S{61,}/.test(str || '')) return true;
  return false;
}

module.exports=async function handler(req,res){
  const origin=req.headers.origin||'';
  if(ALLOWED_ORIGINS.includes(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const ip=req.headers['x-forwarded-for']?.split(',')[0].trim()||'unknown';
  if(isRateLimited(ip))return res.status(429).json({error:'Zu viele Anfragen. Bitte später erneut versuchen.'});

  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{body={};}}
  if(!body||typeof body!=='object')return res.status(400).json({error:'Ungültige Anfrage.'});
  // Honeypot
  if(body['_hp']&&body['_hp'].trim()!=='')return res.status(200).json({ok:true});
  if(!body['_ts']||(Date.now()-parseInt(body['_ts'],10))<3000)return res.status(200).json({ok:true});

  const vorname   =sanitize(body.vorname   ||'');
  const nachname  =sanitize(body.nachname  ||'');
  const email     =sanitize(body.email     ||'');
  const telefon   =sanitize(body.telefon   ||'');
  const investart =sanitize(body.investart ||'');
  const kapital   =sanitize(body.kapital   ||'');
  const vorhaben  =sanitize(body.vorhaben  ||'');

  // Gibberish-Bot-Erkennung (kurze Zufallsstrings) — silent success wie Honeypot
  if (isGibberish(vorhaben) || isGibberish(vorname) || BLOCKED_EMAILS.has(normalizeEmail(email))) return res.status(200).json({ok:true});
  const name = `${vorname} ${nachname}`.trim();

  if(!email)return res.status(400).json({error:'E-Mail-Adresse ist erforderlich.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Ungültige E-Mail-Adresse.'});

  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey)return res.status(500).json({error:'Konfigurationsfehler.'});

  const ts=new Date().toLocaleString('de-DE');

  const htmlInternal=`<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;margin:0 auto">
<h2 style="color:#0a2240;border-bottom:2px solid #c9a84c;padding-bottom:.5rem">Kontaktanfrage Business Angels – business-angel-invest.eu</h2>
<table style="width:100%;border-collapse:collapse;margin:1rem 0">
  <tr><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc;font-weight:bold;width:160px">Name</td><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc">${name||'–'}</td></tr>
  <tr><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc;font-weight:bold">E-Mail</td><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc"><a href="mailto:${email}">${email}</a></td></tr>
  <tr><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc;font-weight:bold">Telefon</td><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc">${telefon||'–'}</td></tr>
  <tr><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc;font-weight:bold">Investment-Art</td><td style="padding:.5rem .8rem;border-bottom:1px solid #e8e4dc">${investart||'–'}</td></tr>
  <tr><td style="padding:.5rem .8rem;font-weight:bold">Kapitalbedarf</td><td style="padding:.5rem .8rem">${kapital||'–'}</td></tr>
</table>
<p><strong>Vorhaben:</strong></p>
<div style="background:#f5f3ee;border-left:3px solid #c9a84c;padding:1rem;white-space:pre-wrap">${(vorhaben||'–').replace(/\n/g,'<br>')}</div>
<p style="font-size:11px;color:#aaa;margin-top:2rem;border-top:1px solid #e2ddd5;padding-top:.5rem">business-angel-invest.eu · IP: ${ip} · ${ts}</p>
</body></html>`;

  const htmlConfirm=`<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;margin:0 auto">
<h2 style="color:#0a2240;border-bottom:2px solid #c9a84c;padding-bottom:.5rem">Vielen Dank für Ihre Anfrage</h2>
<p>Sehr geehrte/r ${name||'Interessent/in'},</p>
<p>wir haben Ihre Anfrage erhalten und melden uns innerhalb von 48 Stunden bei Ihnen.</p>
<p style="margin:1rem 0"><strong>Ihr Anliegen:</strong><br>${investart?`Investment-Art: ${investart}<br>`:''}${kapital?`Kapitalbedarf: ${kapital}<br>`:''}</p>
<p style="margin-top:1.5rem">Mit freundlichen Grüßen<br>
<strong>PAN21 Business Angel Netzwerk</strong><br>
<a href="mailto:angel@pan21.com">angel@pan21.com</a><br>
<a href="tel:03056844500">030-56844500</a><br>
<a href="https://business-angel-invest.eu">business-angel-invest.eu</a></p>
</body></html>`;

  try{
    // Intern an angel@pan21.com
    const r=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:'Business Angel Invest <angel@pan21.com>',
        to:['angel@pan21.com'],
        reply_to:email,
        subject:'Kontaktanfrage Business Angels',
        html:htmlInternal,
      }),
    });
    const rt=await r.text();console.log('Resend intern:',r.status,rt);
    if(!r.ok)return res.status(500).json({error:'Sendefehler. Bitte schreiben Sie an angel@pan21.com.'});

    // Bestätigung an Besucher
    fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:'Business Angel Invest <angel@pan21.com>',
        to:[email],
        subject:'Ihre Anfrage bei Business-Angel-Invest.eu',
        html:htmlConfirm,
      }),
    }).catch(e=>console.log('Confirm error:',e.message));

    return res.status(200).json({ok:true,message:'Vielen Dank! Wir melden uns innerhalb von 48 Stunden.'});
  }catch(err){
    console.error(err.message);
    return res.status(500).json({error:'Verbindungsfehler. Bitte schreiben Sie an angel@pan21.com oder rufen Sie 030-56844500 an.'});
  }
};
