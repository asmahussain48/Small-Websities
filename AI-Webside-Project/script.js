// ══════════════════════════════════════════════
//  SPEECH RECOGNITION  (FREE — Web Speech API)
// ══════════════════════════════════════════════
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, isRec = false, finalTx = '';
let selectedLang = 'en-US';

// Populate language selector
const LANGS = [
  ['en-US','English (US)'],['en-GB','English (UK)'],['en-AU','English (Australia)'],
  ['en-IN','English (India)'],['en-PK','English (Pakistan)'],
  ['ur-PK','Urdu (Pakistan)'],['hi-IN','Hindi (India)'],
  ['ar-SA','Arabic'],['fr-FR','French'],['de-DE','German'],
  ['es-ES','Spanish'],['zh-CN','Chinese (Simplified)'],['ja-JP','Japanese'],
];
window.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('langSel');
  if(sel){
    LANGS.forEach(([val,label]) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = label;
      if(val === 'en-US') o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { selectedLang = sel.value; };
  }
  if(!SR){
    document.getElementById('nsBanner').classList.add('show');
    const btn = document.getElementById('recBtn');
    btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed';
    btn.onclick = () => toast('Use Google Chrome for voice recording', 'err');
  }
});

function toggleRec(){ isRec ? stopRec() : startRec(); }

function startRec(){
  if(!SR){ toast('Use Google Chrome for voice recording', 'err'); return; }

  // Always create a fresh instance
  try{ if(recognition){ recognition.abort(); } } catch(e){}
  recognition = new SR();
  recognition.continuous    = true;
  recognition.interimResults= true;
  recognition.maxAlternatives = 1;
  recognition.lang = selectedLang;

  recognition.onstart = () => {
    isRec = true;
    document.getElementById('recBtn').classList.add('on');
    document.getElementById('recBtnTxt').textContent = '■ Stop Recording';
    document.getElementById('recPill').classList.add('live');
    document.getElementById('recLabel').textContent = 'LIVE';
    toast('Recording started — speak clearly!', 'ok');
  };

  recognition.onresult = (e) => {
    if(!e || !e.results) return;
    let interim = '';
    for(let i = e.resultIndex; i < e.results.length; i++){
      const result = e.results[i];
      if(!result || !result[0]) continue;          // ← FIX: null guard
      const transcript = result[0].transcript;     // ← FIX: always use [0]
      if(typeof transcript !== 'string') continue; // ← FIX: type guard
      if(result.isFinal){
        finalTx += transcript + ' ';
        updateTx();
      } else {
        interim += transcript;
      }
    }
    const el = document.getElementById('interimTxt');
    if(el) el.textContent = interim ? '🎤 ' + interim : '';
  };

  recognition.onerror = (e) => {
    const err = e ? e.error : 'unknown';
    if(err === 'not-allowed'){
      toast('Microphone access denied — allow mic in browser settings', 'err');
      stopRec();
    } else if(err === 'no-speech'){
      // silent — no-speech is normal during pauses
    } else if(err === 'network'){
      toast('Network error — check your internet connection', 'err');
    } else if(err === 'audio-capture'){
      toast('No microphone found — plug in a mic and try again', 'err');
      stopRec();
    } else {
      toast('Speech error: ' + err, 'err');
    }
  };

  // Auto-restart to keep recording continuously
  recognition.onend = () => {
    if(isRec){
      try{ recognition.start(); } catch(e){}
    }
  };

  try{
    recognition.start();
  } catch(e){
    toast('Could not start microphone: ' + (e.message||e), 'err');
    isRec = false;
  }
}

function stopRec(){
  isRec = false;
  try{ if(recognition){ recognition.abort(); recognition = null; } } catch(e){}
  document.getElementById('recBtn').classList.remove('on');
  document.getElementById('recBtnTxt').textContent = '▶ Start Recording';
  document.getElementById('recPill').classList.remove('live');
  document.getElementById('recLabel').textContent = 'idle';
  const el = document.getElementById('interimTxt');
  if(el) el.textContent = '';
  toast('Recording stopped');
}

function updateTx(){
  const b = document.getElementById('txBox');
  if(!b) return;
  b.value = (finalTx || '').trim();
  b.scrollTop = b.scrollHeight;
  updateWC();
}

function clearTx(){
  if(!confirm('Clear the entire transcript?')) return;
  finalTx = '';
  const b = document.getElementById('txBox');
  if(b) b.value = '';
  const it = document.getElementById('interimTxt');
  if(it) it.textContent = '';
  updateWC();
  toast('Transcript cleared');
}

function onTxEdit(){
  const b = document.getElementById('txBox');
  finalTx = b ? (b.value || '') : '';
  updateWC();
}

function updateWC(){
  const t = (document.getElementById('txBox').value || '').trim();
  const w = t ? t.split(/\s+/).filter(Boolean).length : 0;
  const label = w + (w===1?' word':' words');
  const e1 = document.getElementById('wcTxt');
  const e2 = document.getElementById('wc2');
  if(e1) e1.textContent = label;
  if(e2) e2.textContent = label + ' transcribed';
}

// ══════════════════════════════════════════════
//  AI CHAT  (FREE — Anthropic Claude via artifact API)
// ══════════════════════════════════════════════
let busy = false;
let history = [];

function onKey(e){
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
}
function autoH(el){
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 90) + 'px';
}
function quickAsk(q){
  document.getElementById('chatIn').value = q;
  send();
}

async function send(){
  const inp = document.getElementById('chatIn');
  const q = inp.value.trim();
  if(!q || busy) return;

  const tx = document.getElementById('txBox').value.trim();

  // hide empty state
  const es = document.getElementById('emptyState');
  if(es) es.style.display = 'none';

  addMsg('user', q);
  inp.value = ''; inp.style.height = 'auto';

  const tid = addTyping();
  busy = true;
  document.getElementById('sendBtn').disabled = true;

  // Build the prompt
  const SYSTEM = `You are LectureAI — a brilliant, friendly AI study assistant helping a student understand their class lecture in real time.

YOUR MISSION:
- Help students understand topics from their lecture recording/transcript
- Create beautifully structured study notes they can actually use
- Fill gaps with accurate general knowledge when the transcript is incomplete
- Be like a brilliant tutor who was in the same class

RESPONSE FORMATTING (ALWAYS follow this):
- Use ## for main topic headings
- Use ### for sub-headings
- Use **bold** for ALL key terms, important concepts, and definitions
- Use bullet points ( - ) for lists of points
- Use numbered lists for steps or sequences
- When creating notes: Heading → Definition → Key Points → Example → Summary
- Keep language clear, simple, student-friendly
- Highlight what's most likely to appear in an exam

BEHAVIOR:
- If transcript is provided: Answer primarily from it, supplement with general knowledge
- If no transcript: Answer from general knowledge, mention you're doing so
- Always be encouraging and supportive
- If asked to explain something complex, break it into simple steps`;

  let userMsg = '';
  if(tx && tx.length > 10){
    userMsg = `📋 LECTURE TRANSCRIPT (use this as primary source):\n"""\n${tx}\n"""\n\n❓ MY QUESTION: ${q}`;
  } else {
    userMsg = `❓ MY QUESTION: ${q}\n\n(No lecture transcript provided — please answer from your general knowledge)`;
  }

  history.push({ role: 'user', content: userMsg });
  const msgs = history.slice(-12); // keep last 6 exchanges

  try{
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'ANTHROPIC_API_KEY_PLACEHOLDER',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: SYSTEM,
        messages: msgs
      })
    });

    const data = await res.json();
    removeEl(tid);

    if(data.error){
      history.pop();
      // Fallback to local AI when API not available
      const localAnswer = localAI(q, tx);
      addMsg('ai', localAnswer, true);
      history.push({ role: 'assistant', content: localAnswer });
    } else {
      const ans = data.content[0].text;
      addMsg('ai', ans, true);
      history.push({ role: 'assistant', content: ans });
    }
  } catch(e){
    removeEl(tid);
    history.pop();
    // Fallback to local AI
    const localAnswer = localAI(q, tx);
    addMsg('ai', localAnswer, true);
  }

  busy = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('chatIn').focus();
}

// ══════════════════════════════════════════════
//  LOCAL AI FALLBACK (works 100% offline/free)
//  Smart rule-based engine that generates notes
//  from the transcript without any external API
// ══════════════════════════════════════════════
function localAI(question, transcript){
  const q = question.toLowerCase();
  const tx = transcript.toLowerCase();
  const txOrig = transcript;

  // ── detect intent ──
  const isNotes   = /notes?|summariz|write|create|make|generate|cheat|revision|revise/.test(q);
  const isExplain = /explain|what is|what are|describe|tell me|help me understand|how does|define/.test(q);
  const isSummary = /summar|overview|gist|brief|recap|what (was|were|did)/.test(q);
  const isKey     = /key|important|main|crucial|must (know|remember)|exam|points?/.test(q);
  const isLast    = /just|last|recent|latest|teacher|taught|said/.test(q);

  // ── extract sentences from transcript ──
  function getSentences(){
    if(!txOrig || txOrig.trim().length < 10) return [];
    return txOrig.split(/[.!?]+/).map(s=>s.trim()).filter(s=>s.length>15);
  }

  function getTopicFromQ(){
    return question.replace(/explain|what is|what are|describe|tell me about|help me understand|how does|define|the|a |an /gi,'').trim();
  }

  // ── find relevant sentences from transcript ──
  function findRelevant(query, maxSentences=6){
    const sentences = getSentences();
    if(!sentences.length) return [];
    const keywords = query.toLowerCase().split(/\s+/).filter(w=>w.length>3);
    const scored = sentences.map(s => {
      const sl = s.toLowerCase();
      let score = keywords.reduce((acc,k) => acc + (sl.includes(k)?1:0), 0);
      return { s, score };
    });
    return scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,maxSentences).map(x=>x.s);
  }

  // ── detect topic from transcript ──
  function detectTopics(){
    if(!txOrig || txOrig.length < 20) return [];
    // look for noun phrases after "today we", "this topic", "is called", "known as"
    const patterns = [
      /today (we |I )?(will |are |)(learn|discuss|cover|talk about|study) ([a-z ]+)/gi,
      /topic (is|of) ([a-z ]+)/gi,
      /([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*) is (a |an |the )/g,
      /called ([a-zA-Z ]+)/gi,
    ];
    const topics = new Set();
    patterns.forEach(p => {
      let m;
      while((m=p.exec(txOrig))!==null){
        const t = (m[4]||m[2]||m[1]||'').trim();
        if(t && t.length>3 && t.length<50) topics.add(t);
      }
    });
    return [...topics].slice(0,5);
  }

  // ── extract words that appear to be definitions ──
  function extractDefinitions(){
    if(!txOrig) return [];
    const patterns = [
      /([A-Za-z ]+) is (defined as|a|an|the) ([^.!?]+)/g,
      /([A-Za-z ]+) refers to ([^.!?]+)/g,
      /([A-Za-z ]+) means ([^.!?]+)/g,
    ];
    const defs = [];
    patterns.forEach(p => {
      let m;
      while((m=p.exec(txOrig))!==null && defs.length<5){
        defs.push(`**${m[1].trim()}** — ${m[m.length-1].trim()}`);
      }
    });
    return defs;
  }

  const sentences = getSentences();
  const topics = detectTopics();
  const defs = extractDefinitions();
  const relevant = findRelevant(question);
  const topic = getTopicFromQ();
  const hasTx = txOrig && txOrig.trim().length > 20;

  // ── GENERATE NOTES ──
  if(isNotes || isSummary && hasTx){
    let out = `## 📝 Lecture Notes\n\n`;
    if(topics.length){
      out += `### Topics Covered\n`;
      topics.forEach(t => out += `- ${t}\n`);
      out += '\n';
    }
    if(defs.length){
      out += `### Key Definitions\n`;
      defs.forEach(d => out += `- ${d}\n`);
      out += '\n';
    }
    if(sentences.length){
      out += `### Main Points from the Lecture\n`;
      sentences.slice(0,8).forEach(s => out += `- ${s}.\n`);
      out += '\n';
    }
    if(!hasTx){
      out += `> ⚠️ No transcript found. Start recording your lecture, then ask me to create notes again — I'll use the actual lecture content!\n\n`;
      out += `### General Study Tips\n- **Active recall** — test yourself after each topic\n- **Spaced repetition** — review notes after 1 day, 3 days, 1 week\n- **Mind maps** — connect concepts visually\n- **Teach it back** — explain topics in your own words`;
    }
    return out;
  }

  // ── KEY POINTS ──
  if(isKey){
    let out = `## ⭐ Key Points to Remember\n\n`;
    if(relevant.length){
      out += `*From your lecture:*\n\n`;
      relevant.forEach((s,i) => out += `${i+1}. ${s}\n`);
      if(defs.length){ out += `\n### Important Terms\n`; defs.forEach(d=>out+=`- ${d}\n`); }
    } else {
      out += `*No transcript yet — here are universal study principles:*\n\n`;
      out += `1. **Understand, don't memorize** — grasp the concept before memorizing facts\n`;
      out += `2. **Connect to existing knowledge** — link new topics to things you already know\n`;
      out += `3. **Practice with examples** — theory becomes clear when applied\n`;
      out += `4. **Identify the 20%** — find the core ideas that explain 80% of the topic\n`;
      out += `5. **Ask "why" not just "what"** — understanding the reason makes recall easier\n`;
    }
    return out;
  }

  // ── EXPLAIN / LAST TOPIC ──
  if(isExplain || isLast){
    let out = '';
    if(relevant.length && hasTx){
      out += `## 📖 Explanation: ${topic || 'From Your Lecture'}\n\n`;
      out += `*Based on your lecture transcript:*\n\n`;
      relevant.forEach(s => out += `- ${s}\n`);
      out += `\n### What This Means\n`;
      out += `The lecture covers **${topics.length ? topics[0] : 'this topic'}**. `;
      out += `Here are the core ideas to understand:\n\n`;
      if(defs.length){ defs.forEach(d => out+=`- ${d}\n`); }
      else { out += `- Review the transcript points above carefully\n- Ask a specific follow-up question for deeper explanation\n`; }
    } else {
      out += `## 📖 Explanation: ${topic}\n\n`;
      out += `> Start recording your lecture for AI-powered explanations using the actual class content!\n\n`;
      out += `### General Explanation\n`;
      out += `To understand **${topic}**, consider:\n\n`;
      out += `- **What it is** — the core definition and concept\n`;
      out += `- **Why it matters** — its significance in the subject\n`;
      out += `- **How it works** — the mechanism or process involved\n`;
      out += `- **Examples** — real-world applications or instances\n\n`;
      out += `💡 *Once you have your lecture transcript, ask me again — I'll explain it using exactly what your teacher taught!*`;
    }
    return out;
  }

  // ── GENERIC: search transcript for answer ──
  if(hasTx && relevant.length){
    let out = `## 💬 Answer\n\n`;
    out += `*From your lecture transcript:*\n\n`;
    relevant.forEach(s => out += `- ${s}\n`);
    out += `\n---\n*Ask a more specific question for a detailed explanation, or ask me to "create notes" for full structured notes.*`;
    return out;
  }

  // ── DEFAULT ──
  return `## 💬 Ready to Help!\n\nI'm your AI study assistant. Here's what I can do:\n\n- 📝 **Create notes** — "Create notes from the lecture"\n- 📖 **Explain topics** — "Explain what was just taught"\n- ⭐ **Key points** — "What are the key points?"\n- 📋 **Summarize** — "Summarize the lecture so far"\n- ❓ **Answer questions** — Ask anything about the topic\n\n**To get started:**\n1. Click **▶ Start Recording** and capture your lecture\n2. Or **type/paste** your notes in the left panel\n3. Then ask me anything!\n\n> 💡 *The more transcript content there is, the better and more accurate my answers will be.*`;
}

// ══════════════════════════════════════════════
//  RENDER HELPERS
// ══════════════════════════════════════════════
function addMsg(role, text, isAI=false){
  const c = document.getElementById('chatMsgs');
  const d = document.createElement('div');
  d.className = 'msg ' + (role==='user'?'user':'ai');
  const who = document.createElement('div');
  who.className = 'msg-who';
  who.textContent = role==='user' ? 'You' : 'LectureAI';
  const b = document.createElement('div');
  b.className = 'msg-b';
  b.innerHTML = isAI ? md(text) : esc(text);
  d.appendChild(who); d.appendChild(b);
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

function addTyping(){
  const c = document.getElementById('chatMsgs');
  const id = 'ty_' + Date.now();
  const d = document.createElement('div');
  d.id = id; d.className = 'msg ai';
  d.innerHTML = `<div class="msg-who">LectureAI</div><div class="typing-wrap"><div class="td"></div><div class="td"></div><div class="td"></div></div>`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
  return id;
}
function removeEl(id){ const e=document.getElementById(id); if(e) e.remove(); }
function esc(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function md(text){
  let t = esc(text);
  t = t.replace(/```[\w]*\n?([\s\S]*?)```/g,'<pre><code>$1</code></pre>');
  t = t.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  t = t.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  t = t.replace(/^# (.+)$/gm,'<h2>$1</h2>');
  t = t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g,'<em>$1</em>');
  t = t.replace(/`(.+?)`/g,'<code>$1</code>');
  t = t.replace(/^---$/gm,'<hr>');
  t = t.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  t = t.replace(/^[\-\*] (.+)$/gm,'<li>$1</li>');
  t = t.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  t = t.replace(/(<li>[^<]*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  t = t.split(/\n\n+/).map(block => {
    block = block.trim();
    if(/^<[hupbl]|^<li/.test(block)) return block;
    return `<p>${block.replace(/\n/g,' ')}</p>`;
  }).join('');
  return t;
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
let toastT;
function toast(msg, type=''){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastT);
  toastT = setTimeout(()=>el.classList.remove('show'), 2800);
}
