import { FIREBASE_CONFIG, GIPHY_KEY, TURN_USERNAME, TURN_CREDENTIAL } from './config.js';
/* flami - group-first realtime chat (Firebase Spark, fully free) */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment, writeBatch, deleteField } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let signingUp = false;
const db = getFirestore(app);

/* ---------- tiny framework ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const buzz = (ms=12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch(e){} };
function toast(msg) {
  const t = el(`<div class="toast"></div>`);
  t.textContent = msg;
  root.append(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 2600);
}
/* small, clear UI sounds (WebAudio, no assets) */
let sfxCtx=null;
function sfx(kind){
  try{
    sfxCtx=sfxCtx||new (window.AudioContext||window.webkitAudioContext)();
    const ac=sfxCtx; if(ac.state==='suspended')ac.resume().catch(()=>{});
    const t=ac.currentTime;
    const tone=(f0,f1,dur,vol,type='sine',when=0)=>{const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t+when);o.frequency.exponentialRampToValueAtTime(f1,t+when+dur);g.gain.setValueAtTime(0.0001,t+when);g.gain.exponentialRampToValueAtTime(vol,t+when+0.014);g.gain.exponentialRampToValueAtTime(0.0001,t+when+dur);o.connect(g);g.connect(ac.destination);o.start(t+when);o.stop(t+when+dur+0.02);};
    if(kind==='send')tone(460,760,0.09,0.05);
    else if(kind==='recv')tone(820,590,0.1,0.045);
    else if(kind==='tap')tone(660,660,0.045,0.03);
    else if(kind==='join'){tone(520,780,0.1,0.045);tone(780,1040,0.12,0.04,'sine',0.1);}
    else if(kind==='leave')tone(700,380,0.14,0.05);
  }catch(e){}
}
const fmtTime = (ts) => { if (!ts) return ''; const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date(); const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const yest = new Date(now); yest.setDate(now.getDate()-1);
  if (d.toDateString() === yest.toDateString()) return '1d';
  const diff = (now - d)/864e5;
  if (diff < 7) return d.toLocaleDateString([], {weekday:'short'});
  return d.toLocaleDateString([], {day:'numeric',month:'short'}); };
const fmtClock = (ts) => { const d = ts && ts.toDate ? ts.toDate() : new Date(ts||Date.now()); return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); };
const GRADS = ['linear-gradient(135deg,#FF7A59,#FF4D8D)','linear-gradient(135deg,#39C6FF,#5468FF)','linear-gradient(135deg,#FFB020,#FF5E3A)','linear-gradient(135deg,#38E1B0,#2FA8FF)','linear-gradient(135deg,#B16BFF,#FF5CC8)','linear-gradient(135deg,#5CC8FF,#7CFFCB)'];
const gradFor = (seed='') => GRADS[[...seed].reduce((a,c)=>a+c.charCodeAt(0),0)%GRADS.length];
const initials = (name='?') => esc(name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase());
const fakeEmail = (uname) => uname.toLowerCase().replace(/[^a-z0-9_.-]/g,'') + '@flami.chat';
/* Avatar with a real photo when one exists, gradient initials otherwise. */
const avatarHtml = (seed, name, photo, style='') => photo
  ? `<div class="avatar av-img" style="${style}"><img src="${photo}" alt="" draggable="false"></div>`
  : `<div class="avatar" style="background:${gradFor(seed)};${style}">${initials(name)}</div>`;
/* Square-crop and shrink a picked image to a small data URI (profile/group photos). */
async function prepAvatar(file, size=256) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  cv.getContext('2d').drawImage(bmp, (bmp.width-s)/2, (bmp.height-s)/2, s, s, 0, 0, size, size);
  let q = .78, uri = '';
  for (let i=0;i<5;i++) {
    const blob = await new Promise(r => cv.toBlob(r,'image/jpeg',q));
    if (!blob) throw new Error('encode');
    uri = await new Promise(res => { const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob); });
    if (uri.length <= 140000) break;
    q -= .13;
  }
  if (uri.length > 140000) return null;
  return uri;
}
function pickImageFile(cb) {
  const f = el('<input type="file" accept="image/*" style="display:none">');
  document.body.append(f);
  f.onchange = () => { const file = f.files[0]; f.remove(); if (file) cb(file); };
  f.click();
}
const svg = (p, s=20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  flame: svg('<path d="M12 3c1 5 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 4 2-2 2-6 1-9Z"/>',38),
  chat: svg('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 20l1.1-4.1A8.4 8.4 0 1 1 21 11.5Z"/>',19),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a1.7 1.7 0 0 0-.3 1.9V9c.3.6.9 1 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>',21),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  mic: svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',21),
  micBig: svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',32),
  send: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',21),
  gif: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8.5 10.5h.01M15.5 10.5h.01"/><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/>'),
  play: '<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5Z"/></svg>',
  pause: '<svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/></svg>',
  check: svg('<path d="M20 6 9 17l-5-5"/>',14),
  dblcheck: svg('<path d="M18 6 7 17l-4-4"/><path d="m22 9-7.5 7.5"/>',15),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',17),
  chevL: svg('<path d="m15 18-6-6 6-6"/>',14),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',19),
  voice: svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>',13),
  img: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-4.5-4.5L9 18"/>',14),
  photo: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-4.5-4.5L9 18"/>',19),
  reply: svg('<path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',17),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',17),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',17),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>',15),
  down: svg('<path d="M12 5v14m0 0 6-6m-6 6-6-6"/>',16),
  phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2Z"/>',19),
  phoneOff: svg('<path d="M10.7 13.3a16 16 0 0 1-2.6-2.5m-3-3A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 10m5.9 5.9a19.8 19.8 0 0 0 5.8 1 2 2 0 0 1 2.2 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1M2 2l20 20"/>',21),
  micOff: svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 .7 1.9M15 10.6V5a3 3 0 0 0-5.7-1.3"/><path d="M19 10v2a7 7 0 0 1-.5 2.6M5 10v2a7 7 0 0 0 12 5"/><path d="M12 19v3"/><path d="m3 3 18 18"/>',17),
  pin: svg('<path d="M12 17v5"/><path d="M9 3h6l1 7 3 3v2H5v-2l3-3 1-7Z"/>',17),
  camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',16),
  up: svg('<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',16)
};

const state = {
  user: null, profile: null, chats: [], profiles: {}, openChat: null,
  unsub: {}, online: {}, typing: {}, view: 'home', sheet: null,
  call: null, callDocs: {}, callUnsubs: {}, dismissedCalls: {},
  msgData: {}, imgCache: {}, replyTo: null, totalUnread: 0,
  pins: [], editing: null, msgOlder: [], msgLatest: [], msgHasMore: false, msgOldest: null,
};
const root = $('#app');

/* ---------- auth screens ---------- */
function showAuth(mode='login') {
  root.innerHTML = `
  <div class="auth morph-in">
    <div class="auth-glow"></div>
    <div class="auth-logo">flami</div>
    <div class="auth-tag">your crew, one flame</div>
    <h1>${mode==='login' ? 'Welcome back' : 'Create your account'}</h1>
    <p class="hint">${mode==='login' ? 'Sign in with your account name' : 'Pick an account name people can find you by'}</p>
    <div class="field"><label>ACCOUNT NAME</label><input class="inp" id="a-user" placeholder="e.g. ayaan.r" autocapitalize="none" autocomplete="username"></div>
    ${mode==='signup' ? `<div class="field"><label>DISPLAY NAME</label><input class="inp" id="a-name" placeholder="e.g. Ayaan Reshi"></div>`:''}
    <div class="field"><label>PASSWORD</label><input class="inp" id="a-pass" type="password" placeholder="${mode==='signup' ? 'at least 6 characters':'your password'}" autocomplete="${mode==='signup'?'new-password':'current-password'}"></div>
    ${mode==='signup' ? `<div class="field"><label>EMAIL <span style="color:var(--muted);font-weight:400">(optional contact email)</span></label><input class="inp" id="a-email" type="email" placeholder="you@example.com" autocapitalize="none"></div>`:''}
    <div class="err" id="a-err"></div>
    <button class="btn-primary" id="a-go">${mode==='login' ? 'Sign in' : 'Create account'}</button>
    <div class="auth-switch">${mode==='login' ? `New to flami? <b id="a-sw">Create an account</b>` : `Have an account? <b id="a-sw">Sign in</b>`}</div>
  </div>`;
  $('#a-sw').onclick = () => { buzz(8); showAuth(mode==='login'?'signup':'login'); };
  $('#a-go').onclick = () => doAuth(mode);
  $('#a-pass').addEventListener('keydown', e => { if (e.key==='Enter') doAuth(mode); });
  setTimeout(()=>$('#a-user')?.focus(), 350);
}
async function doAuth(mode) {
  const err = $('#a-err'); err.textContent = '';
  const uname = $('#a-user').value.trim().toLowerCase();
  const pass = $('#a-pass').value;
  const btn = $('#a-go'); btn.disabled = true;
  const fail = (m) => { err.textContent = m; btn.disabled = false; $('.auth').classList.add('shake'); setTimeout(()=>$('.auth').classList.remove('shake'),450); };
  if (!/^[a-z0-9][a-z0-9_.-]{2,19}$/.test(uname) || uname.includes('..') || uname.endsWith('.')) return fail('Account name: 3-20 letters, numbers, _ . -');
  if (pass.length < 6) return fail('Password needs at least 6 characters');
  try {
    if (mode === 'signup') {
      const name = $('#a-name').value.trim();
      const emailOpt = $('#a-email').value.trim();
      if (!name) return fail('Add a display name');
      if(emailOpt && !$('#a-email').checkValidity()) return fail('Check your email address');
      const taken = await getDoc(doc(db,'usernames',uname));
      if (taken.exists()) return fail('That account name is taken');
      signingUp = true;
      const cred = await createUserWithEmailAndPassword(auth, fakeEmail(uname), pass);
      await setDoc(doc(db,'usernames',uname), { uid: cred.user.uid });
      await setDoc(doc(db,'profiles',cred.user.uid), {
        username: uname, name: name.slice(0,60),
        createdAt: serverTimestamp(), lastSeen: serverTimestamp()
      });
      if (emailOpt) await setDoc(doc(db,'privateProfiles',cred.user.uid), {email:emailOpt});
      signingUp = false;
      await bootUser(cred.user);
      showWelcome();
    } else {
      await signInWithEmailAndPassword(auth, fakeEmail(uname), pass);
    }
    buzz(20);
  } catch(e) {
    signingUp = false;
    const m = String(e.code||e.message);
    fail(m.includes('email-already') ? 'That account name is taken'
      : m.includes('wrong-password') || m.includes('invalid-credential') || m.includes('user-not-found') ? 'Wrong account name or password'
      : m.includes('network') ? 'Network problem, try again' : 'Something went wrong ['+m+']');
  }
}

/* ---------- app shell ---------- */
function startApp() {
  root.innerHTML = `<div class="shell"><div class="screen" id="scr"></div>
    <nav class="nav" id="nav">
      <div class="nav-pill" id="nav-pill"></div>
      <button class="nav-tab" data-tab="chats">${I.chat}<span class="lbl">Chats</span><span class="nav-badge" id="nav-badge" style="display:none"></span></button>
      <button class="nav-tab" data-tab="people">${I.users}<span class="lbl">People</span></button>
      <button class="nav-tab" data-tab="search">${I.search}<span class="lbl">Search</span></button>
      <button class="nav-tab" data-tab="settings">${I.gear}<span class="lbl">Settings</span></button>
    </nav></div>`;
  $$('.nav-tab').forEach(t => t.onclick = () => { buzz(10); sfx('tap'); switchTab(t.dataset.tab); });
  switchTab('chats');
  subscribeChats();
  heartbeat();
  updNavBadge();
}
function updNavBadge(){
  const b=$('#nav-badge'); if(!b)return;
  const n=state.totalUnread||0;
  b.style.display=n?'flex':'none';
  b.textContent=n>99?'99+':n;
}
function switchTab(tab) {
  state.view = tab;
  const tabs = $$('.nav-tab');
  tabs.forEach(t => t.classList.toggle('on', t.dataset.tab===tab));
  const on = tabs.findIndex(t => t.dataset.tab===tab);
  const pill = $('#nav-pill');
  const t = tabs[on];
  if (t) { pill.style.left = '10px'; pill.style.transform=`translateX(${on*100}%)`; pill.style.width = 'calc((100% - 20px) / 4)'; pill.style.opacity = 1; }
  const scr = $('#scr');
  const render = () => { if (tab==='chats') renderChatList(); else if (tab==='people') renderPeople(); else if (tab==='search') renderSearch(); else renderSettings(); };
  if (document.startViewTransition) document.startViewTransition(render); else render();
}

/* ---------- chat list (groups first) ---------- */
function subscribeChats() {
  const q = query(collection(db,'chats'), where('members','array-contains', state.user.uid));
  state.unsub.chats && state.unsub.chats();
  state.unsub.chats = onSnapshot(q, async snap => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const missing = new Set();
    chats.forEach(c => (c.members||[]).forEach(m => { if (!state.profiles[m]) missing.add(m); }));
    await Promise.all([...missing].map(async uid => {
      const p = await getDoc(doc(db,'profiles',uid));
      state.profiles[uid] = p.exists() ? p.data() : { name:'Unknown', username:'?' };
    }));
    chats.sort((a,b) => (b.updatedAt?.toMillis?.()||0) - (a.updatedAt?.toMillis?.()||0));
    state.chats = chats;
    state.loadedOnce = true;
    state.totalUnread = chats.reduce((n,c)=>n+((c.unread&&c.unread[state.user.uid])||0),0);
    updNavBadge();
    watchCallDocs();
    if (state.view === 'chats' && !state.openChat && $('#scr')) renderChatList();
  });
}
function chatDisplay(c) {
  if (c.type === 'group') return { name: c.name || 'Group', sub: `${(c.members||[]).length} members`, grad: gradFor(c.id), init: initials(c.name||'G'), photo: c.photo||null };
  const other = (c.members||[]).find(m => m !== state.user.uid);
  const p = state.profiles[other] || { name:'Chat' };
  return { name: p.name, sub: '@'+p.username, grad: gradFor(other||'?'), init: initials(p.name), other, photo: p.photo||null };
}
function renderChatList() {
  const scr = $('#scr');
  scr.innerHTML = `
    <div class="home-head"><div class="home-title">flami</div>
      <button class="icon-btn grad press" id="new-chat">${I.edit}</button></div>
    <div class="search-pill" id="go-search">${I.search}<input placeholder="Search people or chats" readonly></div>
    <div class="chat-list" id="clist"></div>`;
  $('#go-search').onclick = () => { buzz(8); switchTab('search'); };
  $('#new-chat').onclick = () => { buzz(10); openNewChatSheet(); };
  const list = $('#clist');
  if (!state.chats.length) {
    if (!state.loadedOnce) {
      list.innerHTML = Array.from({length:5},()=>`<div class="chat-item skel-item"><div class="skel skel-av"></div><div class="chat-meta"><div class="skel skel-line" style="width:55%"></div><div class="skel skel-line" style="width:80%;margin-top:8px"></div></div></div>`).join('');
      return;
    }
    list.innerHTML = `<div class="empty-list"><div class="big">${I.flame}</div>
      <p><b style="color:var(--txt)">No chats yet</b><br>Create a group for your crew,<br>or find people by account name.</p></div>`;
    return;
  }
  state.loadedOnce = true;
  let html = '', i = 0;
  const item = (c) => {
    const d = chatDisplay(c);
    const prev = previewFor(c);
    const unread = (c.unread && c.unread[state.user.uid]) || 0;
    const pinned = (state.pins||[]).includes(c.id);
    return `<div class="chat-item" data-id="${c.id}" style="animation-delay:${Math.min(i++*40,300)}ms">
      ${unread ? `<div class="ring">` : ''}${avatarHtml(c.type==='group'?c.id:(d.other||'?'), d.name, d.photo)}${unread?'</div>':''}
      <div class="chat-meta"><div class="chat-row"><span class="chat-name">${esc(d.name)}</span>${pinned?`<span class="pin-mark">${I.pin}</span>`:''}<span class="chat-time ${unread?'hot':''}">${fmtTime(c.updatedAt)}</span></div>
      <div class="chat-prev">${prev}</div></div>
      <div class="chat-right">${unread?`<span class="badge">${unread>99?'99+':unread}</span>`:''}</div></div>`;
  };
  const pins = state.pins||[];
  const pinnedChats = state.chats.filter(c => pins.includes(c.id));
  const rest = state.chats.filter(c => !pins.includes(c.id));
  const groups = rest.filter(c => c.type==='group');
  const dms = rest.filter(c => c.type!=='group');
  if (pinnedChats.length) { html += `<div class="sect-label">Pinned</div>` + pinnedChats.map(item).join(''); }
  if (groups.length) { html += `<div class="sect-label">Groups</div>` + groups.map(item).join(''); }
  if (dms.length) { html += `<div class="sect-label">Private</div>` + dms.map(item).join(''); }
  list.innerHTML = html;
  $$('.chat-item', list).forEach(n => {
    n.onclick = () => { if (state._swallowTap) return; buzz(10); openChat(n.dataset.id); };
    n.addEventListener('contextmenu', e => { e.preventDefault(); const c = state.chats.find(x=>x.id===n.dataset.id); if (c) openChatMenu(c); });
    let lp = null;
    n.addEventListener('touchstart', () => { lp = setTimeout(() => { state._swallowTap=true; setTimeout(()=>state._swallowTap=false,350); const c = state.chats.find(x=>x.id===n.dataset.id); if (c) openChatMenu(c); }, 500); }, {passive:true});
    ['touchmove','touchend','touchcancel'].forEach(ev => n.addEventListener(ev, () => clearTimeout(lp), {passive:true}));
  });
}
/* Per-chat menu from the list: pin to the top (kept in your private profile). */
function openChatMenu(c) {
  buzz(14);
  closeSheets();
  const pinned = (state.pins||[]).includes(c.id);
  const ov = el(`<div class="sheet-overlay msg-menu-ov"></div>`);
  const sh = el(`<div class="sheet msg-menu"><div class="menu-list">
    <button class="menu-item" data-a="pin">${I.pin}<span>${pinned?'Unpin chat':'Pin chat'}</span></button>
  </div></div>`);
  root.append(ov, sh);
  ov.onclick = closeSheets;
  $$('.menu-item', sh).forEach(b => b.onclick = async () => {
    closeSheets();
    if (b.dataset.a !== 'pin') return;
    try {
      if (pinned) { state.pins = (state.pins||[]).filter(x => x!==c.id); await updateDoc(doc(db,'privateProfiles',state.user.uid), {pins: arrayRemove(c.id)}); }
      else { state.pins = [...(state.pins||[]), c.id]; await setDoc(doc(db,'privateProfiles',state.user.uid), {pins: arrayUnion(c.id)}, {merge:true}); }
      buzz(10); renderChatList();
    } catch(e) { toast('Could not update the pin. Check connection.'); }
  });
}
function previewFor(c) {
  const t = state.typing[c.id];
  if (t && t !== state.user.uid) { const p = state.profiles[t]; return `<span class="typing">${c.type==='group' ? esc(p?.name?.split(' ')[0]||'someone')+' is ' : ''}typing…</span>`; }
  const m = c.lastMsg;
  if (!m) return `<span style="color:var(--muted)">Say hi</span>`;
  const who = c.type==='group' && m.sender !== state.user.uid ? `<b style="color:#C9C9D6;font-weight:600">${esc((state.profiles[m.sender]?.name||'?').split(' ')[0])}:</b>&nbsp;` : '';
  const you = c.type!=='group' && m.sender === state.user.uid ? `<span style="color:var(--muted)">You:&nbsp;</span>` : '';
  if (m.type==='voice') return who + you + `<span style="display:flex;align-items:center;gap:6px;color:var(--acc-soft)">${I.voice} Voice note · 0:${String(m.dur||0).padStart(2,'0')}</span>`;
  if (m.type==='gif') return who + you + `<span style="display:flex;align-items:center;gap:6px">${I.img} GIF</span>`;
  if (m.type==='image') return who + you + `<span style="display:flex;align-items:center;gap:6px">${I.img} Photo${m.text?` · ${esc(m.text.slice(0,30))}`:''}</span>`;
  if (m.type==='game') return who + esc(m.text||'Game invite');
  if (m.type==='watch') return who + esc(m.text||'🎬 Watch party');
  if (m.type==='call') return who + you + `<span style="display:flex;align-items:center;gap:6px">${I.phone} ${esc(m.text||'Voice call')}${m.dur?` · ${fmtDur(m.dur*1000)}`:''}</span>`;
  return who + you + esc(m.text||'');
}

/* ---------- people & search ---------- */
async function renderPeople() { renderSearch('people'); }
async function renderSearch(mode='search') {
  const scr = $('#scr');
  scr.innerHTML = `
    <div class="home-head"><div class="home-title">${mode==='people'?'People':'Search'}</div></div>
    <div class="search-pill">${I.search}<input id="q" placeholder="Find by account name" autocomplete="off"></div>
    <div class="chat-list" id="results"><div class="empty-list"><div class="big">${I.search}</div><p>Type an account name like <b style="color:var(--acc-soft)">@ayaan.r</b><br>to find your people.</p></div></div>`;
  const q = $('#q'); q.focus();
  let deb;
  q.oninput = () => { clearTimeout(deb); deb = setTimeout(()=>runSearch(q.value.trim().toLowerCase()), 260); };
}
async function runSearch(term) {
  const box = $('#results'); if (!box) return;
  if (!term) { box.innerHTML = `<div class="empty-list"><div class="big">${I.search}</div><p>Type an account name like <b style="color:var(--acc-soft)">@ayaan.r</b><br>to find your people.</p></div>`; return; }
  const snap = await getDocs(query(collection(db,'profiles'), orderBy('username'), where('username','>=',term.replace(/^@/,'')), where('username','<=',term.replace(/^@/,'')+''), limit(20)));
  const rows = snap.docs.map(d=>({uid:d.id,...d.data()})).filter(p=>p.uid!==state.user.uid);
  const matchingChats=state.chats.filter(c=>chatDisplay(c).name.toLowerCase().includes(term.replace(/^@/,'')));
  const chatHits=matchingChats.map(c=>{const cd=chatDisplay(c);return `<div class="person chat-hit" data-chat="${c.id}">${avatarHtml(c.type==='group'?c.id:(cd.other||'?'), cd.name, cd.photo)}<div><div class="nm">${esc(cd.name)}</div><div class="hd">${c.type==='group'?'Group':'Private chat'}</div></div></div>`;}).join('');
  if (!rows.length && !matchingChats.length) { box.innerHTML = `<div class="empty-list"><p>No one found for “${esc(term)}”</p></div>`; return; }
  box.innerHTML = chatHits + rows.map(p => `
    <div class="person" data-uid="${p.uid}" data-name="${esc(p.name)}">
      ${avatarHtml(p.uid, p.name, p.photo||null)}
      <div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}</div><div class="hd">@${esc(p.username)}</div></div>
      <div class="st add press">Message</div></div>`).join('');
  $$('.person', box).forEach(n => n.onclick = () => { buzz(10); n.dataset.chat?openChat(n.dataset.chat):openDM(n.dataset.uid); });
}

/* ---------- settings ---------- */
function renderSettings() {
  const p = state.profile || {};
  $('#scr').innerHTML = `
    <div class="home-head"><div class="home-title">Settings</div></div>
    <div class="chat-list">
      <div style="display:flex;align-items:center;gap:15px;padding:18px 12px">
        <button class="avatar av-edit press" id="edit-photo" aria-label="Change profile photo" style="${p.photo?'':`background:${gradFor(state.user.uid)};`}width:64px;height:64px;border-radius:23px;font-size:22px">${p.photo?`<img src="${p.photo}" alt=""><span class="av-cam">${I.camera}</span>`:`${initials(p.name)}<span class="av-cam">${I.camera}</span>`}</button>
        <div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:700;display:flex;align-items:center;gap:8px"><span id="set-name">${esc(p.name||'')}</span><button class="icon-btn press" id="edit-name" style="width:32px;height:32px;border-radius:11px;color:var(--acc-soft)">${I.edit}</button></div>
        <div style="color:var(--acc-soft);font-weight:600;font-size:13.5px;margin-top:2px">@${esc(p.username||'')}</div>
        ${p.email?`<div style="color:var(--muted);font-size:12.5px;margin-top:2px">${esc(p.email)}</div>`:''}</div>
      </div>
      <div class="sect-label">App</div>
      <div class="person" id="signout"><div class="avatar" style="background:linear-gradient(135deg,#FF5C5C,#B13BFF)">⏻</div>
        <div style="flex:1"><div class="nm" style="color:var(--danger)">Sign out</div></div></div>
      <div style="text-align:center;color:var(--muted);font-size:11.5px;margin-top:40px">flami · free plan only, no billing enabled</div>
    </div>`;
  $('#signout').onclick = async () => { buzz(10); await auth.signOut(); location.reload(); };
  $('#edit-name').onclick = () => openNameEditor();
  $('#edit-photo').onclick = () => openPhotoEditor();
}
/* Profile photo: change or remove. Stored as a small data URI on the profile doc. */
function openPhotoEditor(){
  buzz(10); closeSheets();
  const has = !!state.profile.photo;
  const ov = el(`<div class="sheet-overlay"></div>`);
  const sh = el(`<div class="sheet">
    <div class="rec-grab" style="align-self:center"></div>
    <h2>Profile photo</h2><div class="sub">Shown in chats, calls and games</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn-primary" id="pe-change">${has?'Change photo':'Add a photo'}</button>
      ${has?`<button class="btn-primary" id="pe-remove" style="background:var(--card2);box-shadow:none">Remove photo</button>`:''}
    </div>
  </div>`);
  root.append(ov, sh); ov.onclick = closeSheets;
  $('#pe-change',sh).onclick = () => pickImageFile(async file => {
    try {
      const uri = await prepAvatar(file);
      if (!uri) { toast('That photo is too detailed. Try another one.'); return; }
      await updateDoc(doc(db,'profiles',state.user.uid), {photo: uri});
      state.profile.photo = uri; state.profiles[state.user.uid] = state.profile;
      closeSheets(); renderSettings(); toast('Photo updated'); buzz(14);
    } catch(e) { toast('Could not save photo. Check connection.'); }
  });
  if (has) $('#pe-remove',sh).onclick = async () => {
    try {
      await updateDoc(doc(db,'profiles',state.user.uid), {photo: deleteField()});
      delete state.profile.photo;
      closeSheets(); renderSettings(); toast('Photo removed'); buzz(10);
    } catch(e) { toast('Could not remove photo. Check connection.'); }
  };
}
/* One-time welcome tips after signup. */
function showWelcome(){
  try { localStorage.setItem('flamiWelcomed','1'); } catch(e){}
  closeSheets();
  const ov = el(`<div class="sheet-overlay"></div>`);
  const sh = el(`<div class="sheet">
    <div class="rec-grab" style="align-self:center"></div>
    <h2 style="text-align:center;margin-top:6px">Welcome to flami</h2>
    <div class="wl">
      <div class="wl-row">${I.users}<span><b>Find your crew</b> by account name in Search, then start a group.</span></div>
      <div class="wl-row">${I.mic}<span><b>Hold the mic</b> to record a voice note, release to send.</span></div>
      <div class="wl-row">${I.phone}<span><b>Tap the phone icon</b> in a chat to start a voice call.</span></div>
      <div class="wl-row"><span class="wl-spark">✦</span><span><b>Party games</b> live inside group chats.</span></div>
    </div>
    <button class="btn-primary" id="w-go" style="margin-top:16px">Let's go</button>
  </div>`);
  root.append(ov, sh);
  const done = () => { buzz(10); closeSheets(); };
  ov.onclick = done; $('#w-go', sh).onclick = done;
}
function openNameEditor(){
  buzz(10); closeSheets();
  const ov = el(`<div class="sheet-overlay"></div>`);
  const sh = el(`<div class="sheet">
    <div class="rec-grab" style="align-self:center"></div>
    <h2>Display name</h2><div class="sub">This is what friends see in chats, calls and games</div>
    <input class="inp" id="ne-inp" maxlength="60" value="${esc(state.profile.name||'')}" placeholder="Your name">
    <button class="btn-primary" id="ne-save" style="margin-top:16px">Save</button>
  </div>`);
  root.append(ov, sh); ov.onclick = closeSheets;
  const inp=$('#ne-inp',sh); setTimeout(()=>{inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);},300);
  const save=async()=>{
    const name=inp.value.trim(); if(!name){inp.focus();return;}
    $('#ne-save',sh).disabled=true;
    try{
      await updateDoc(doc(db,'profiles',state.user.uid),{name:name.slice(0,60)});
      state.profile.name=name.slice(0,60); state.profiles[state.user.uid]=state.profile;
      closeSheets(); renderSettings(); toast('Name updated'); buzz(14);
    }catch(e){$('#ne-save',sh).disabled=false;toast('Could not save. Check connection.');}
  };
  $('#ne-save',sh).onclick=save;
  inp.onkeydown=e=>{if(e.key==='Enter')save();};
}

/* ---------- new chat / group sheet ---------- */
async function openNewChatSheet(targetGroup=null) {
  closeSheets();
  const ov = el(`<div class="sheet-overlay"></div>`);
  const sh = el(`<div class="sheet">
    <div class="rec-grab" style="align-self:center"></div>
    <h2>${targetGroup?'Add members':'New chat'}</h2><div class="sub">${targetGroup?'Choose people for '+esc(targetGroup.name):'Start a private chat or make a group'}</div>
    <div style="display:flex;gap:9px;margin:6px 0 4px">
      <div class="gif-chip on" data-m="dm">${I.chat} Private</div>
      <div class="gif-chip" data-m="group">${I.users} Group</div>
    </div>
    <div id="grp-name" style="display:none"><input class="inp" id="gn" placeholder="Group name, e.g. Night Team" style="margin-top:10px"></div>
    <div class="search-pill" style="margin:14px 0 4px">${I.search}<input id="nc-q" placeholder="Find people by account name"></div>
    <div class="people-list" id="nc-res"></div>
    <button class="btn-primary" id="nc-go" style="display:none;margin-top:14px">Create group</button>
  </div>`);
  root.append(ov, sh);
  ov.onclick = closeSheets;
  let mode = targetGroup ? 'group' : 'dm';
  if(targetGroup) { $$('.gif-chip',sh).forEach(n=>n.style.display='none'); }
  const picked = new Map();
  $$('.gif-chip', sh).forEach(c => c.onclick = () => {
    buzz(8); mode = c.dataset.m;
    $$('.gif-chip', sh).forEach(x => x.classList.toggle('on', x===c));
    $('#grp-name', sh).style.display = mode==='group' ? 'block':'none';
    refresh();
  });
  const refresh = () => {
    $('#nc-go', sh).style.display = (mode==='group' && picked.size) ? 'flex':'none';
    $$('.person > :last-child', sh).forEach(st => {
      const uid = st.closest('.person').dataset.uid;
      if (mode==='group') { st.className = 'check-dot' + (picked.has(uid)?' on':''); st.innerHTML = picked.has(uid)?I.check:''; } else {st.className='st add press';st.textContent='Message';}
    });
  };
  $('#nc-go', sh).onclick = async () => {
    if($('#nc-go',sh).disabled)return;
    if(!targetGroup && !$('#gn',sh).value.trim()){ $('#gn',sh).focus();return; }
    $('#nc-go',sh).disabled=true;
    try {
    if(targetGroup) { await updateDoc(doc(db,'chats',targetGroup.id),{members:arrayUnion(...picked.keys())}); closeSheets(); toast('Members added'); return; }
    const name = $('#gn', sh).value.trim().slice(0,80);
    if (!name) { $('#gn', sh).focus(); return; }
    buzz(20);
    const members = [state.user.uid, ...picked.keys()];
    const ref = await addDoc(collection(db,'chats'), {
      type:'group', name, members, admins:[state.user.uid],
      createdBy: state.user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMsg: null, unread: {}
    });
    closeSheets(); openChat(ref.id);
    }catch(e){$('#nc-go',sh).disabled=false;toast('Could not update group. Check connection.');}
  };
  if(targetGroup) $('#nc-go',sh).textContent='Add members';
  let deb;
  $('#nc-q', sh).oninput = (e) => { clearTimeout(deb); deb = setTimeout(async () => {
    const term = e.target.value.trim().toLowerCase().replace(/^@/,'');
    const res = $('#nc-res', sh);
    if (!term) { res.innerHTML=''; return; }
    const snap = await getDocs(query(collection(db,'profiles'), orderBy('username'), where('username','>=',term), where('username','<=',term+''), limit(12)));
    res.innerHTML = snap.docs.map(d=>({uid:d.id,...d.data()})).filter(p=>p.uid!==state.user.uid && !targetGroup?.members.includes(p.uid)).map(p => `
      <div class="person" data-uid="${p.uid}">${avatarHtml(p.uid, p.name, p.photo||null)}
      <div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}</div><div class="hd">@${esc(p.username)}</div></div>
      <div class="${mode==='group' ? 'check-dot'+(picked.has(p.uid)?' on':'') : 'st add press'}">${mode==='group' ? (picked.has(p.uid)?I.check:'') : 'Message'}</div></div>`).join('');
    $$('.person', res).forEach(n => n.onclick = () => {
      buzz(10);
      if (mode==='dm') { closeSheets(); openDM(n.dataset.uid); }
      else { picked.has(n.dataset.uid) ? picked.delete(n.dataset.uid) : picked.set(n.dataset.uid, 1); refresh();
        $$('.person', res).forEach(x => { const st = $('.check-dot', x); if (st) { const u = x.dataset.uid; st.classList.toggle('on', picked.has(u)); st.innerHTML = picked.has(u)?I.check:''; } });
      }
    });
  }, 260); };
}
function closeSheets() { $$('.sheet-overlay,.sheet,.gif-overlay,.rec-overlay,.msg-menu-ov,.photo-ov,.lightbox').forEach(n => n.remove()); state.sheet = null; }

/* ---------- open / create DM ---------- */
async function openDM(otherUid) {
  const existing = state.chats.find(c => c.type==='dm' && (c.members||[]).includes(otherUid));
  if (existing) return openChat(existing.id);
  const q = query(collection(db,'chats'), where('members','array-contains', state.user.uid));
  const snap = await getDocs(q);
  const found = snap.docs.find(d => d.data().type==='dm' && (d.data().members||[]).includes(otherUid));
  if (found) return openChat(found.id);
  const ref = await addDoc(collection(db,'chats'), {
    type:'dm', members:[state.user.uid, otherUid], admins:[state.user.uid],
    createdBy: state.user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMsg: null, unread: {}
  });
  openChat(ref.id);
}
/* ---------- chat view ---------- */
let msgUnsub = null, chatUnsub = null, typingTimer = null, recState = null;
async function openChat(chatId) {
  if (!state.chats.some(c=>c.id===chatId)) { const d=await getDoc(doc(db,'chats',chatId)); if(d.exists()) state.chats.push({id:d.id,...d.data()}); }
  msgUnsub && msgUnsub(); chatUnsub && chatUnsub();
  state.openChat = chatId;
  state.msgData = {}; state.replyTo = null; state.editing = null; state.firstMsgLoad = true;
  const render = () => {
    const c = state.chats.find(x => x.id===chatId) || {};
    const d = chatDisplay(c);
    root.innerHTML = `<div class="shell"><div class="screen">
      <div class="chat-head">
        <button class="icon-btn press" id="back">${I.back}</button>
        <div class="shared-av">${avatarHtml(c.type==='group'?c.id:(d.other||'?'), d.name, d.photo)}</div>
        <div class="chat-title" id="head-t"><div class="n">${esc(d.name)}</div><div class="s ${state.online[d.other]?'':'off'}" id="head-status">${c.type==='group' ? esc(d.sub) : (state.online[d.other] ? 'online' : '@'+esc(state.profiles[d.other]?.username||''))}</div></div>
        <button class="icon-btn press" id="csearch" aria-label="Search in this chat">${I.search}</button>
        <button class="icon-btn press" id="call-btn" aria-label="Voice call">${I.phone}</button>
        ${c.type==='group' ? `<button class="icon-btn press" id="watch-btn" aria-label="Watch party">🎬</button><button class="icon-btn press" id="game-btn" aria-label="Party games">✦</button><button class="icon-btn press" id="ginfo">${I.users}</button>` : ''}
      </div>
      <div class="csearch-bar" id="csearch-bar" style="display:none"></div>
      <div class="thread" id="thread"></div>
      <button class="scroll-fab" id="scroll-fab" aria-label="Jump to latest">${I.down}</button>
      <div class="reply-bar" id="reply-bar" style="display:none"></div>
      <div class="composer">
        <div class="com-field">
          <button class="com-act press" id="photo-btn" aria-label="Send a photo">${I.photo}</button>
          <button class="com-act press" id="gif-btn" aria-label="Send a GIF">${I.gif}</button>
          <textarea id="inp" maxlength="5000" rows="1" placeholder="Message" aria-label="Message"></textarea>
        </div>
        <button class="mic-fab" id="mic" aria-label="Voice note or send">${I.mic}</button>
      </div>
    </div></div>`;
    $('#back').onclick = () => { buzz(8); msgUnsub&&msgUnsub(); chatUnsub&&chatUnsub(); state.openChat=null; csState=null; startApp(); };
    $('#csearch').onclick = () => toggleChatSearch(chatId);
    $('#call-btn').onclick = () => { buzz(10); joinCall(chatId); };
    updateCallBtn();
    $('#game-btn') && ($('#game-btn').onclick = () => openParty(chatId));
    $('#watch-btn') && ($('#watch-btn').onclick = () => openWatch(chatId));
    $('#ginfo') && ($('#ginfo').onclick = () => openGroupInfo(state.chats.find(x=>x.id===chatId)||c));
    const inp = $('#inp');
    inp.oninput = () => { inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,120)+'px'; sendTyping(); updMic(); };
    inp.onkeydown = (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } };
    let pressT, held=false;
    $('#mic').onclick=()=>{if(held){held=false;return;}onMicTap()};
    $('#mic').onpointerdown=e=>{if($('#inp').value.trim())return;const point={x:e.clientX,y:e.clientY};pressT=setTimeout(()=>{held=true;startRecording(point)},240)};
    $('#mic').onpointerup=()=>clearTimeout(pressT);
    $('#mic').onpointercancel=()=>clearTimeout(pressT);
    $('#gif-btn').onclick = openGifPicker;
    $('#photo-btn').onclick = () => { buzz(10); pickPhoto(); };
    $('#scroll-fab').onclick = () => { buzz(8); const th=$('#thread'); th.scrollTo({top:th.scrollHeight,behavior:'smooth'}); };
    const th = $('#thread');
    th.onscroll = () => {
      const up = th.scrollHeight - th.scrollTop - th.clientHeight > 380;
      $('#scroll-fab').classList.toggle('show', up);
      if (!up) $('#scroll-fab').classList.remove('new');
    };
    updMic();
    subscribeMessages(chatId);
    watchChat(chatId);
    updateDoc(doc(db,'chats',chatId),{[`presence.${state.user.uid}`]:Date.now()}).catch(()=>{});
    markRead(chatId);
  };
  if (document.startViewTransition) document.startViewTransition(render); else render();
}
function updMic() {
  const has = $('#inp') && $('#inp').value.trim().length > 0;
  $('#mic').innerHTML = has ? I.send : I.mic;
  $('#mic').classList.toggle('send', !!has);
}

/* ---------- in-chat search (over loaded messages) ---------- */
let csState = null;
function toggleChatSearch(chatId) {
  buzz(8);
  const bar = $('#csearch-bar'); if (!bar) return;
  if (csState) { csState = null; bar.style.display='none'; bar.innerHTML=''; $$('.msg.cs-hit').forEach(n=>n.classList.remove('cs-hit')); return; }
  csState = { matches: [], idx: -1 };
  bar.style.display = 'flex';
  bar.innerHTML = `${I.search}<input id="cs-inp" placeholder="Search in this chat" autocomplete="off">
    <span id="cs-count"></span>
    <button class="icon-btn press" id="cs-up" aria-label="Previous match">${I.up}</button>
    <button class="icon-btn press" id="cs-down" aria-label="Next match">${I.down}</button>
    <button class="icon-btn press" id="cs-x" aria-label="Close search">${I.x}</button>`;
  const inp = $('#cs-inp', bar); inp.focus();
  const jump = () => {
    $$('.msg.cs-hit').forEach(n=>n.classList.remove('cs-hit'));
    const m = csState.matches[csState.idx];
    const count = $('#cs-count', bar);
    if (!m) { count.textContent = csState.matches.length ? '' : (inp.value.trim()?'0':''); return; }
    count.textContent = `${csState.idx+1}/${csState.matches.length}`;
    const node = $(`.msg[data-id="${m}"]`);
    if (node) { node.scrollIntoView({behavior:'smooth',block:'center'}); node.classList.add('cs-hit'); }
  };
  inp.oninput = () => {
    const term = inp.value.trim().toLowerCase();
    csState.matches = term ? Object.entries(state.msgData)
      .filter(([,m]) => (m.type==='text'||m.type==='image') && (m.text||'').toLowerCase().includes(term))
      .sort((a,b) => (a[1].createdAt?.toMillis?.()||0)-(b[1].createdAt?.toMillis?.()||0))
      .map(([id]) => id) : [];
    csState.idx = csState.matches.length - 1;
    jump();
  };
  $('#cs-up', bar).onclick = () => { if(csState.matches.length){ csState.idx=(csState.idx-1+csState.matches.length)%csState.matches.length; jump(); } };
  $('#cs-down', bar).onclick = () => { if(csState.matches.length){ csState.idx=(csState.idx+1)%csState.matches.length; jump(); } };
  $('#cs-x', bar).onclick = () => toggleChatSearch(chatId);
  inp.onkeydown = e => { if (e.key==='Enter') { e.preventDefault(); $('#cs-down', bar).click(); } if (e.key==='Escape') toggleChatSearch(chatId); };
}

/* ---------- replies & editing ---------- */
function startReply(m, id) {
  state.editing = null;
  state.replyTo = { id, sender:m.sender, type:m.type, text:m.text||'', dur:m.dur||null, gifUrl:m.gifUrl||null };
  renderReplyBar();
  setTimeout(()=>$('#inp')?.focus(), 80);
}
function cancelReply() { state.replyTo = null; state.editing = null; renderReplyBar(); }
function startEdit(m, id) {
  state.replyTo = null;
  state.editing = { id, orig: m.text||'' };
  renderReplyBar();
  const inp = $('#inp');
  if (inp) { inp.value = m.text||''; inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,120)+'px'; updMic(); setTimeout(()=>inp.focus(),80); }
}
async function saveEdit() {
  const inp = $('#inp'); const ed = state.editing; if (!ed) return;
  const text = inp.value.trim();
  if (!text) { toast('A message cannot be empty. Delete it instead.'); return; }
  if (text === ed.orig) { inp.value=''; inp.style.height='auto'; updMic(); cancelReply(); return; }
  buzz(14);
  inp.value=''; inp.style.height='auto'; updMic();
  state.editing = null; renderReplyBar();
  try { await updateDoc(doc(db,'chats',state.openChat,'messages',ed.id), { text: text.slice(0,5000), edited: true }); }
  catch(e) { state.editing = ed; inp.value = text; updMic(); renderReplyBar(); toast('Could not edit. Check connection.'); }
}
function renderReplyBar() {
  const bar = $('#reply-bar'); if (!bar) return;
  if (state.editing) {
    bar.style.display='flex';
    bar.innerHTML = `<div class="rb-accent"></div><div class="rb-txt"><b>Edit message</b><span>${esc((state.editing.orig||'').slice(0,90))}</span></div>
      <button class="icon-btn press" id="rb-x" aria-label="Cancel edit">${I.x}</button>`;
    $('#rb-x',bar).onclick = () => { buzz(6); const inp=$('#inp'); if(inp){inp.value='';inp.style.height='auto';updMic();} cancelReply(); };
    return;
  }
  const r = state.replyTo;
  if (!r) { bar.style.display='none'; bar.innerHTML=''; return; }
  const who = r.sender===state.user.uid ? 'You' : (state.profiles[r.sender]?.name||'?').split(' ')[0];
  const what = r.type==='voice' ? 'Voice note · 0:'+String(r.dur||0).padStart(2,'0') : r.type==='gif' ? 'GIF' : r.type==='image' ? 'Photo' : (r.text||'').slice(0,90);
  bar.style.display='flex';
  bar.innerHTML = `<div class="rb-accent"></div><div class="rb-txt"><b>${esc(who)}</b><span>${esc(what)}</span></div>
    <button class="icon-btn press" id="rb-x" aria-label="Cancel reply">${I.x}</button>`;
  $('#rb-x',bar).onclick = () => { buzz(6); cancelReply(); };
}

/* ---------- send ---------- */
async function sendText() {
  const inp = $('#inp'); const text = inp.value.trim();
  if (!text) return;
  if (state.editing) { saveEdit(); return; }
  buzz(14); sfx('send');
  inp.value=''; inp.style.height='auto'; updMic();
  try {await postMsg({ type:'text', text }); await updateDoc(doc(db,'chats',state.openChat),{[`typing.${state.user.uid}`]:0});}catch(e){inp.value=text;updMic();toast('Could not send. Check connection and try again.');}
}
/* Media (photos, voice audio) lives in chats/<cid>/media/<msgId> so the message
   list stays light on slow connections; media is fetched only when shown/played. */
async function postMsg(m) {
  const chatId = state.openChat;
  const payload = { ...m, sender: state.user.uid, createdAt: serverTimestamp(), reads: { [state.user.uid]: true } };
  delete payload._media;
  if (state.replyTo) payload.replyTo = { id: state.replyTo.id, sender: state.replyTo.sender, type: state.replyTo.type, text: (state.replyTo.text||'').slice(0,140), dur: state.replyTo.dur||null, gifUrl: state.replyTo.gifUrl||null };
  const mref = doc(collection(db,'chats',chatId,'messages'));
  if (m._media) {
    payload.mediaId = mref.id;
    await setDoc(doc(db,'chats',chatId,'media',mref.id), { data: m._media.data, mime: m._media.mime, sender: state.user.uid, createdAt: serverTimestamp() });
  }
  await setDoc(mref, payload);
  cancelReply();
  const updates = { updatedAt: serverTimestamp(), lastMsg: { type:m.type, text: m.text || null, dur: m.dur || null, sender: state.user.uid, at: Date.now() } };
  const c = state.chats.find(x=>x.id===chatId);
  (c?.members||[]).forEach(uid => { if (uid !== state.user.uid) updates[`unread.${uid}`] = increment(1); });
  await updateDoc(doc(db,'chats',chatId), updates);
}
async function markRead(chatId) {
  try { await updateDoc(doc(db,'chats',chatId), { [`unread.${state.user.uid}`]: 0 }); } catch(e){}
}
function watchChat(chatId) {
  chatUnsub = onSnapshot(doc(db,'chats',chatId), d => {
    const c = d.data(); if (!c) return;
    const t = c.typing || {};
    const hadTyping = !!state.typing[chatId];
    delete state.typing[chatId];
    Object.entries(t).forEach(([uid, at]) => {
      if (uid !== state.user.uid && Date.now() - at < 4000) state.typing[chatId] = uid;
    });
    if (!!state.typing[chatId] !== hadTyping) updTypingBubble(chatId);
    const othersOnline = (c.presence||{});
    (c.members||[]).forEach(m => { state.online[m] = othersOnline[m] && Date.now() - othersOnline[m] < 120000; });
    const s = $('#head-status');
    if (s) {
      if (state.typing[chatId] && Date.now() - (t[state.typing[chatId]]||0) < 4000) {
        const p = state.profiles[state.typing[chatId]];
        s.textContent = c.type==='group' ? `${p?.name?.split(' ')[0]||'someone'} is typing…` : 'typing…';
        s.className = 's'; s.style.color = 'var(--acc-soft)';
        clearTimeout(state._tt); state._tt = setTimeout(()=>{ delete state.typing[chatId]; updTypingBubble(chatId); if(state.openChat===chatId && $('#head-status')) { $('#head-status').textContent=c.type==='group'?`${c.members.length} members`:'online'; $('#head-status').style.color=''; } }, 4200);
      } else if (c.type==='group') { s.textContent = `${(c.members||[]).length} members`; s.style.color=''; s.className='s off'; }
      else { const other = (c.members||[]).find(m=>m!==state.user.uid); s.textContent = state.online[other] ? 'online' : '@'+(state.profiles[other]?.username||''); s.className = 's' + (state.online[other]?'':' off'); s.style.color=''; }
    }
  });
}
function updTypingBubble(chatId){
  const th=$('#thread'); if(!th||state.openChat!==chatId)return;
  const ex=$('.typing-bub',th);
  if(state.typing[chatId]){ if(!ex){ th.insertAdjacentHTML('beforeend','<div class="typing-bub"><i></i><i></i><i></i></div>'); th.scrollTop=th.scrollHeight; } }
  else ex?.remove();
}
let lastTypingSent = 0;
async function sendTyping() {
  const now = Date.now();
  if (now - lastTypingSent < 2500) return;
  lastTypingSent = now;
  try { await updateDoc(doc(db,'chats',state.openChat), { [`typing.${state.user.uid}`]: now }); } catch(e){}
}

/* ---------- messages ---------- */
/* The live listener follows only the latest MSG_PAGE messages; older history loads
   in pages on demand. Opening a chat on slow data no longer pulls the whole thread. */
const MSG_PAGE = 60;
function subscribeMessages(chatId) {
  state.msgOlder = []; state.msgLatest = []; state.msgHasMore = false; state.msgOldest = null; state._olderHasMore = true;
  const q = query(collection(db,'chats',chatId,'messages'), orderBy('createdAt','desc'), limit(MSG_PAGE));
  msgUnsub = onSnapshot(q, snap => {
    const th = $('#thread'); if (!th) return;
    const stick = th.scrollHeight - th.scrollTop - th.clientHeight < 120;
    let gotFresh = false;
    snap.docChanges().forEach(ch => { if (ch.type==='added' && !state.firstMsgLoad && ch.doc.data().sender!==state.user.uid) gotFresh = true; });
    state.msgLatest = [...snap.docs].reverse();
    if (!state.msgOlder.length) state.msgHasMore = snap.docs.length >= MSG_PAGE;
    renderMessages(chatId, { stick, gotFresh });
  });
}
async function loadEarlier(chatId) {
  if (!state.msgOldest || !state._olderHasMore) return;
  const btn = $('#load-earlier'); if (btn) { btn.disabled = true; btn.textContent = 'Loading\u2026'; }
  try {
    const q = query(collection(db,'chats',chatId,'messages'), orderBy('createdAt','desc'), startAfter(state.msgOldest), limit(MSG_PAGE));
    const snap = await getDocs(q);
    const older = [...snap.docs].reverse();
    state.msgOlder = [...older, ...state.msgOlder];
    state._olderHasMore = snap.docs.length >= MSG_PAGE;
    state.msgHasMore = state._olderHasMore;
    renderMessages(chatId, { keepAnchor: true });
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Load earlier messages'; }
    toast('Could not load older messages. Check connection.');
  }
}
function renderMessages(chatId, opts={}) {
  const th = $('#thread'); if (!th) return;
  const { stick=false, gotFresh=false, keepAnchor=false } = opts;
  const prevH = keepAnchor ? th.scrollHeight : 0, prevT = keepAnchor ? th.scrollTop : 0;
  const docs = [...state.msgOlder, ...state.msgLatest];
  let html = '', lastDay = '', prev = null;
  const markUnread = [];
  docs.forEach(d => {
    const m = d.data();
    state.msgData[d.id] = m;
    if (m.type==='voice' && m.audio) audioCache[d.id]='data:'+(m.audioMime||'audio/webm')+';base64,'+m.audio;
    if (m.type==='image' && m.image) state.imgCache[d.id]='data:image/jpeg;base64,'+m.image;
    if (m.sender!==state.user.uid && !(m.reads&&m.reads[state.user.uid])) markUnread.push(d.id);
    const day = m.createdAt ? m.createdAt.toDate().toDateString() : '';
    if (day && day !== lastDay) { html += `<div class="day-chip">${day === new Date().toDateString() ? 'Today' : m.createdAt.toDate().toLocaleDateString([], {weekday:'short',day:'numeric',month:'short'})}</div>`; lastDay = day; prev = null; }
    const grouped = prev && prev.sender===m.sender && !m.replyTo && m.type==='text' && prev.type==='text' && m.createdAt && prev.createdAt && (m.createdAt.toMillis()-prev.createdAt.toMillis() < 300000);
    html += msgHtml(m, d.id, grouped);
    prev = m;
  });
  state.msgOldest = docs.length ? (docs[0].data().createdAt || state.msgOldest) : state.msgOldest;
  if (state.msgHasMore) html = `<button class="load-earlier" id="load-earlier">Load earlier messages</button>` + html;
  th.innerHTML = html;
  wireMsg(th);
  if (state.msgHasMore) { const b=$('#load-earlier'); if (b) b.onclick = () => { buzz(8); loadEarlier(chatId); }; }
  updTypingBubble(chatId);
  if (keepAnchor) th.scrollTop = th.scrollHeight - prevH + prevT;
  else if (stick || !th.dataset.init) th.scrollTop = th.scrollHeight;
  else if (gotFresh) $('#scroll-fab')?.classList.add('show','new');
  th.dataset.init = 1;
  if (gotFresh && !document.hidden) sfx('recv');
  state.firstMsgLoad = false;
  markRead(chatId);
  if (markUnread.length && !document.hidden) {
    const batch = writeBatch(db);
    markUnread.slice(-40).forEach(id => batch.update(doc(db,'chats',chatId,'messages',id), {[`reads.${state.user.uid}`]: true}));
    batch.commit().catch(()=>{});
  }
}
function linkify(text) {
  const safe = esc(text);
  return safe.replace(/(https?:\/\/[^\s&<>"']+)/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer" class="msg-link">${u}</a>`).replace(/\n/g,'<br>');
}
function quoteHtml(m) {
  if (!m.replyTo) return '';
  const r = m.replyTo;
  const who = r.sender===state.user.uid ? 'You' : (state.profiles[r.sender]?.name||'?').split(' ')[0];
  const what = r.type==='voice' ? '🎙 Voice note' : r.type==='gif' ? 'GIF' : r.type==='image' ? '📷 Photo' : (r.text||'');
  return `<div class="quote" data-q="${esc(r.id||'')}"><b>${esc(who)}</b><span>${esc(what)}</span></div>`;
}
function reactionsHtml(m) {
  const rx = m.reactions || {};
  const entries = Object.entries(rx);
  if (!entries.length) return '';
  const grouped = {};
  entries.forEach(([uid,e]) => { (grouped[e]=grouped[e]||[]).push(uid); });
  return `<div class="rx-list">${Object.entries(grouped).map(([e,uids]) => `<button class="rx-chip ${uids.includes(state.user.uid)?'on':''}" data-e="${e}">${e}${uids.length>1?`<i>${uids.length}</i>`:''}</button>`).join('')}</div>`;
}
function msgHtml(m, id, grouped=false) {
  const mine = m.sender === state.user.uid;
  const c = state.chats.find(x=>x.id===state.openChat);
  const who = (!mine && c?.type==='group' && !grouped) ? `<div class="who" style="color:${gracColorFor(m.sender)}">${esc(state.profiles[m.sender]?.name||'?')}</div>` : '';
  const otherUid = c?.type==='dm' ? (c.members||[]).find(x=>x!==state.user.uid) : null;
  const seen = mine && otherUid && m.reads && m.reads[otherUid];
  const stamp = `<div class="stamp">${m.edited?'<span class="edited">edited</span>':''}${fmtClock(m.createdAt)} ${mine ? (seen ? `<span class="seen">${I.dblcheck}</span>` : I.check) : ''}</div>`;
  const quote = quoteHtml(m);
  const rx = reactionsHtml(m);
  const cls = `msg ${mine?'out':'in'}${grouped?' grp':''}`;
  if (m.type === 'voice') {
    const bars = (m.bars || []).map((h,i) => `<i data-i="${i}" style="height:${h}px"></i>`).join('');
    return `<div class="${cls} voice" data-id="${id}" data-audio="${m.audio?'1':''}">${who}${quote}
      <button class="play-btn" aria-label="Play voice note">${I.play}</button>
      <div style="flex:1"><div class="wave">${bars}</div>
      <div class="vmeta"><span class="vdur">0:${String(m.dur||0).padStart(2,'0')}</span><span>${mine?fmtClock(m.createdAt):''}</span></div></div>${rx}</div>`;
  }
  if (m.type === 'game') return `<div class="${cls} game-invite" data-id="${id}">${who}<div class="gp-eyebrow">FLAMI PLAY · INVITATION</div><b>${esc(GAMES[m.gameId||'drawphone']?.name||'Drawphone')}</b><p>${esc(GAMES[m.gameId||'drawphone']?.desc||'Draw. Guess. Pass it on.')}<br>${esc(GAMES[m.gameId||'drawphone']?.detail||'4+ friends')} · Inside this chat</p><button class="gp-primary join-party" data-session="${esc(m.sessionId)}">Open party</button>${stamp}</div>`;
  if (m.type === 'watch') return `<div class="${cls} game-invite watch-invite" data-id="${id}">${who}<div class="gp-eyebrow">FLAMI WATCH · INVITATION</div><b>🎬 ${esc(m.title||'Watch party')}</b><p>${esc(m.srcLabel||'Video')} · Synced playback, live chat and reactions · Inside this chat</p><button class="gp-primary join-watch" data-session="${esc(m.sessionId)}">Join party</button>${stamp}</div>`;
  if (m.type === 'gif') {
    return `<div class="${cls} gif" data-id="${id}">${who}${quote}<div style="position:relative"><img src="${esc(m.gifUrl)}" loading="lazy"><div class="gif-tag">GIF</div></div><div class="gif-credit">Powered by GIPHY</div>${stamp}${rx}</div>`;
  }
  if (m.type === 'call') {
    return `<div class="sys-row" data-id="${id}">${I.phone}<span>${esc(m.text||'Voice call')}${m.dur?` · ${fmtDur(m.dur*1000)}`:''}</span><i>${fmtClock(m.createdAt)}</i></div>`;
  }
  if (m.type === 'image') {
    const hasInline = !!m.image;
    return `<div class="${cls} img" data-id="${id}">${who}${quote}<div class="mimg-wrap" ${m.w&&m.h?`style="aspect-ratio:${m.w}/${m.h}"`:''}><img class="mimg ${hasInline?'':'ph'}" data-iid="${id}" ${m.w&&m.h?`width="${m.w}" height="${m.h}"`:''} alt="Photo"></div>${m.text?`<div class="img-cap">${linkify(m.text)}</div>`:''}${stamp}${rx}</div>`;
  }
  return `<div class="${cls}" data-id="${id}">${who}${quote}${linkify(m.text||'')}${stamp}${rx}</div>`;
}
function gracColorFor(seed){ const cols=['#FF9BB3','#7DD8FF','#FFC46B','#6FE3C1','#C9A7FF','#8FE3FF']; return cols[[...String(seed)].reduce((a,c)=>a+c.charCodeAt(0),0)%cols.length]; }

/* ---------- message interactions: long-press menu, swipe reply, taps ---------- */
/* Photos sent after media offload live in a separate doc; fetch them when visible. */
let imgObserver = null;
async function loadMsgImage(img) {
  const id = img.dataset.iid; if (!id) return;
  if (state.imgCache[id]) { img.src = state.imgCache[id]; img.classList.remove('ph'); return; }
  const m = state.msgData[id];
  try {
    if (m && m.mediaId) {
      const snap = await getDoc(doc(db,'chats',state.openChat,'media',m.mediaId));
      const d = snap.exists() ? snap.data() : null;
      if (d?.data) { state.imgCache[id] = d.data.startsWith('data:') ? d.data : 'data:' + (d.mime||'image/jpeg') + ';base64,' + d.data; }
    } else if (m && m.image) {
      state.imgCache[id] = 'data:image/jpeg;base64,' + m.image;
    }
  } catch(e) {}
  if (state.imgCache[id]) { img.src = state.imgCache[id]; img.classList.remove('ph'); }
  else img.classList.add('broken');
}
function observeImages(th) {
  const imgs = $$('.mimg', th).filter(i => !state.imgCache[i.dataset.iid]);
  if (!imgs.length) return;
  if (!('IntersectionObserver' in window)) { imgs.forEach(loadMsgImage); return; }
  if (imgObserver) imgObserver.disconnect();
  imgObserver = new IntersectionObserver(es => {
    es.forEach(en => { if (en.isIntersecting) { imgObserver.unobserve(en.target); loadMsgImage(en.target); } });
  }, { root: th, rootMargin: '500px' });
  imgs.forEach(i => imgObserver.observe(i));
}
function wireMsg(th) {
  $$('.join-party',th).forEach(n=>n.onclick=()=>openParty(state.openChat,n.dataset.session));
  $$('.join-watch',th).forEach(n=>n.onclick=()=>openWatch(state.openChat,n.dataset.session));
  $$('.msg.voice', th).forEach(n => { n.addEventListener('click', () => { if (state._swallowTap) return; playVoice(n); }); });
  $$('.mimg', th).forEach(img => {
    if (state.imgCache[img.dataset.iid]) { img.src = state.imgCache[img.dataset.iid]; img.classList.remove('ph'); }
    img.onclick = () => { if (state._swallowTap) return; openLightbox(img.dataset.iid); };
  });
  observeImages(th);
  $$('.quote', th).forEach(q => q.onclick = (e) => {
    e.stopPropagation();
    const target = $(`.msg[data-id="${q.dataset.q}"]`, th);
    if (target) { target.scrollIntoView({behavior:'smooth',block:'center'}); target.classList.add('flash'); setTimeout(()=>target.classList.remove('flash'), 1200); }
  });
  $$('.rx-chip', th).forEach(chip => chip.onclick = (e) => {
    e.stopPropagation();
    const node = chip.closest('.msg'); const id = node?.dataset.id;
    if (id && state.msgData[id]) toggleReaction(state.msgData[id], id, chip.dataset.e);
  });
  $$('.msg', th).forEach(n => attachMsgGestures(n));
}
function attachMsgGestures(n) {
  if (n.classList.contains('game-invite')) return;
  const id = n.dataset.id; if (!id) return;
  const m = () => state.msgData[id];
  let lp = null, sx=0, sy=0, swiping=false, longPressed=false;
  n.addEventListener('contextmenu', e => { e.preventDefault(); if (m()) openMsgMenu(m(), id); });
  n.addEventListener('touchstart', e => {
    const t = e.touches[0]; sx=t.clientX; sy=t.clientY; swiping=false; longPressed=false;
    lp = setTimeout(() => { longPressed=true; state._swallowTap=true; setTimeout(()=>state._swallowTap=false, 350); if (m()) openMsgMenu(m(), id); }, 480);
  }, {passive:true});
  n.addEventListener('touchmove', e => {
    const t = e.touches[0]; const dx=t.clientX-sx, dy=t.clientY-sy;
    if (Math.abs(dy)>24 && !swiping) { clearTimeout(lp); return; }
    if (dx>18 && !swiping && Math.abs(dy)<28) { swiping=true; clearTimeout(lp); n.classList.add('swiping'); }
    if (swiping) { const off=Math.min(dx-18,64); n.style.transform=`translateX(${off}px)`; n.classList.toggle('swipe-hit', off>=56); }
  }, {passive:true});
  const end = e => {
    clearTimeout(lp);
    if (swiping) {
      const hit = n.classList.contains('swipe-hit');
      n.classList.remove('swiping','swipe-hit');
      n.style.transform='';
      if (hit && m()) { buzz(12); startReply(m(), id); }
    }
    swiping=false;
  };
  n.addEventListener('touchend', end);
  n.addEventListener('touchcancel', end);
}

/* ---------- message action menu ---------- */
const RX_EMOJI = ['👍','❤️','😂','😮','😢','🔥'];
function openMsgMenu(m, id) {
  buzz(18);
  closeSheets();
  const mine = m.sender===state.user.uid;
  const myRx = m.reactions?.[state.user.uid];
  const ov = el(`<div class="sheet-overlay msg-menu-ov"></div>`);
  const sh = el(`<div class="sheet msg-menu">
    <div class="rx-row">${RX_EMOJI.map(e=>`<button class="rx-pick ${myRx===e?'on':''}" data-e="${e}">${e}</button>`).join('')}</div>
    <div class="menu-list">
      <button class="menu-item" data-a="reply">${I.reply}<span>Reply</span></button>
      ${mine&&m.type==='text'?`<button class="menu-item" data-a="edit">${I.edit}<span>Edit</span></button>`:''}
      ${m.type==='text'||m.text?`<button class="menu-item" data-a="copy">${I.copy}<span>Copy</span></button>`:''}
      ${mine?`<button class="menu-item danger" data-a="del">${I.trash}<span>Delete</span></button>`:''}
    </div></div>`);
  root.append(ov, sh);
  ov.onclick = closeSheets;
  $$('.rx-pick', sh).forEach(b => b.onclick = () => { closeSheets(); toggleReaction(m, id, b.dataset.e); });
  $$('.menu-item', sh).forEach(b => b.onclick = () => {
    const a = b.dataset.a; closeSheets();
    if (a==='reply') startReply(m, id);
    if (a==='edit') startEdit(m, id);
    if (a==='copy') { navigator.clipboard?.writeText(m.text||'').then(()=>toast('Copied')).catch(()=>toast('Could not copy')); }
    if (a==='del') confirmDelete(id);
  });
}
async function toggleReaction(m, id, emoji) {
  buzz(10);
  const ref = doc(db,'chats',state.openChat,'messages',id);
  const cur = (m.reactions||{})[state.user.uid];
  try {
    if (cur===emoji) await updateDoc(ref, {[`reactions.${state.user.uid}`]: deleteField()});
    else await updateDoc(ref, {[`reactions.${state.user.uid}`]: emoji});
    sfx('tap');
  } catch(e) { toast('Could not react. Check connection.'); }
}
function confirmDelete(id) {
  closeSheets();
  const ov = el(`<div class="sheet-overlay msg-menu-ov"></div>`);
  const sh = el(`<div class="sheet" style="text-align:center">
    <div class="rec-grab" style="align-self:center"></div>
    <h2 style="margin-top:14px">Delete this message?</h2>
    <div class="sub">It disappears for everyone in this chat</div>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn-primary" id="del-no" style="background:var(--card2);box-shadow:none">Keep</button>
      <button class="btn-primary" id="del-yes" style="background:linear-gradient(135deg,#FF5C6C,#D63B5E);box-shadow:0 6px 22px rgba(255,92,108,.35)">Delete</button>
    </div></div>`);
  root.append(ov, sh);
  ov.onclick = closeSheets;
  $('#del-no',sh).onclick = closeSheets;
  $('#del-yes',sh).onclick = async () => {
    closeSheets(); buzz(14);
    try {
      const m = state.msgData[id];
      await deleteDoc(doc(db,'chats',state.openChat,'messages',id));
      if (m?.mediaId) deleteDoc(doc(db,'chats',state.openChat,'media',m.mediaId)).catch(()=>{});
      state.msgOlder = (state.msgOlder||[]).filter(d => d.id !== id);
      delete state.msgData[id];
      toast('Message deleted');
    }
    catch(e) { toast('Could not delete. Check connection.'); }
  };
}

/* ---------- photos ---------- */
function pickPhoto() {
  const f = el('<input type="file" accept="image/*" style="display:none">');
  document.body.append(f);
  f.onchange = () => { const file = f.files[0]; f.remove(); if (file) prepPhoto(file); };
  f.click();
}
const blobToB64 = (blob) => new Promise(res => { const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.readAsDataURL(blob); });
async function prepPhoto(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1280;
    let w = bmp.width, h = bmp.height;
    const sc = Math.min(1, max/Math.max(w,h));
    w = Math.max(1,Math.round(w*sc)); h = Math.max(1,Math.round(h*sc));
    const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
    cv.getContext('2d').drawImage(bmp,0,0,w,h);
    let q = .8, b64 = '';
    for (let i=0;i<5;i++) {
      const blob = await new Promise(r => cv.toBlob(r,'image/jpeg',q));
      if (!blob) throw new Error('encode');
      b64 = await blobToB64(blob);
      if (b64.length <= 860000) break;
      q -= .13;
    }
    if (b64.length > 900000) { toast('That photo is too detailed to send. Try a screenshot or smaller image.'); return; }
    openPhotoPreview(b64, w, h);
  } catch(e) { toast('Could not read that image.'); }
}
function openPhotoPreview(b64, w, h) {
  closeSheets();
  const ov = el(`<div class="photo-ov"><div class="photo-sheet">
    <div class="photo-head"><button class="icon-btn press" id="pp-x">${I.x}</button><b>Send photo</b><div style="width:42px"></div></div>
    <div class="photo-view"><img src="data:image/jpeg;base64,${b64}" alt="Preview"></div>
    <div class="photo-row">
      <input class="inp" id="pp-cap" maxlength="300" placeholder="Add a caption (optional)">
      <button class="mic-fab send" id="pp-send" aria-label="Send photo">${I.send}</button>
    </div></div></div>`);
  root.append(ov);
  $('#pp-x',ov).onclick = () => { buzz(8); closeSheets(); };
  const go = async () => {
    const b = $('#pp-send',ov); if (b.disabled) return; b.disabled = true;
    const cap = $('#pp-cap',ov).value.trim();
    buzz(14); sfx('send'); closeSheets();
    try { await postMsg({ type:'image', _media:{data:b64, mime:'image/jpeg'}, w, h, text: cap||null }); }
    catch(e) { toast('Could not send photo. Check connection.'); }
  };
  $('#pp-send',ov).onclick = go;
  $('#pp-cap',ov).onkeydown = e => { if (e.key==='Enter') go(); };
}
function openLightbox(id) {
  const src = state.imgCache[id]; if (!src) return;
  buzz(8);
  const lb = el(`<div class="lightbox"><img src="${src}" alt="Photo"><button class="lb-x" aria-label="Close">${I.x}</button></div>`);
  root.append(lb);
  requestAnimationFrame(()=>lb.classList.add('show'));
  lb.onclick = () => lb.remove();
}

/* ---------- voice notes ---------- */
let audioCache = {}, currentAudio = null;
async function playVoice(node) {
  buzz(8);
  const id = node.dataset.id;
  if (currentAudio?.datasetId === id) { if(currentAudio.paused) { await currentAudio.play(); $('.play-btn',node).innerHTML=I.pause; } else { currentAudio.pause(); $('.play-btn',node).innerHTML=I.play; } return; }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; $$('.play-btn').forEach(b=>b.innerHTML=I.play); }
  if (!audioCache[id]) {
    const snap = await getDoc(doc(db,'chats',state.openChat,'messages',id));
    const m = snap.data();
    if (m?.audio) audioCache[id] = 'data:' + (m.audioMime || 'audio/webm') + ';base64,' + m.audio;
    else if (m?.mediaId) {
      try {
        const md = await getDoc(doc(db,'chats',state.openChat,'media',m.mediaId));
        const d = md.exists() ? md.data() : null;
        if (d?.data) audioCache[id] = d.data.startsWith('data:') ? d.data : 'data:' + (d.mime || 'audio/webm') + ';base64,' + d.data;
      } catch(e) {}
    }
    if (!audioCache[id]) return;
  }
  const a = new Audio(audioCache[id]);
  currentAudio = a; a.datasetId=id;
  const btn = $('.play-btn', node);
  btn.innerHTML = I.pause;
  const bars = $$('.wave i', node);
  const total = bars.length;
  a.ontimeupdate = () => {
    const p = a.duration ? a.currentTime/a.duration : 0;
    bars.forEach((b,i) => b.classList.toggle('done', i < p*total));
    const d = $('.vdur', node);
    if (d && a.duration) d.textContent = `0:${String(Math.floor(a.currentTime)).padStart(2,'0')} / 0:${String(Math.round(a.duration)).padStart(2,'0')}`;
  };
  a.onended = () => { btn.innerHTML = I.play; bars.forEach(b=>b.classList.remove('done')); currentAudio = null; };
  try { await a.play(); } catch(e) { btn.innerHTML=I.play; toast('Could not play this voice note. Tap again.'); currentAudio=null; }
}
function onMicTap() {
  if ($('#inp').value.trim()) { sendText(); return; }
  buzz(10);
  startRecording();
}
async function startRecording(gesture=null) {
  if (recState) return;
  recState={pending:true};
  let released=false;const earlyRelease=()=>{released=true};
  if(gesture)document.addEventListener('pointerup',earlyRelease,{once:true});
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e) { document.removeEventListener('pointerup',earlyRelease);recState=null; toast(e.name==='NotFoundError'?'No microphone found on this device':'Allow microphone access to record'); return; }
  document.removeEventListener('pointerup',earlyRelease);
  if(gesture && released){stream.getTracks().forEach(t=>t.stop());recState=null;toast('Microphone ready. Tap to record.');return;}
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));
  const mr=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:32000});
  const chunks=[]; mr.ondataavailable=e=>{if(e.data.size) chunks.push(e.data)};
  const ov=el(`<div class="rec-overlay"><div class="rec-sheet"><div class="rec-grab"></div>
    <button class="rec-cancel" id="rc">Cancel recording</button>
    <div class="rec-wave">${Array.from({length:20},(_,i)=>`<i style="height:${18+(i*13)%44}px;animation-delay:${i*35}ms"></i>`).join('')}</div>
    <div class="rec-timer"><b>●</b> <span id="rt">0:00</span></div>
    <div class="rec-row"><button class="rec-lock" id="rl">${I.lock}<span>Lock recording</span></button><button class="rec-mic" id="rm" aria-label="Send voice note">${I.send}</button><div style="width:60px"></div></div>
    <div class="rec-hint" id="rh">${gesture?'Release to send · slide left to cancel · slide up to lock':'Tap send when ready · 60 seconds max'}</div></div></div>`);
  root.append(ov); const t0=Date.now(); let locked=!gesture, done=false;
  mr.start(200);
  let timer;
  const finish=async(cancel=false)=>{
    if(done) return; done=true; clearInterval(timer);
    document.removeEventListener('pointerup',end); document.removeEventListener('pointermove',move);
    await new Promise(resolve=>{ mr.onstop=resolve; mr.stop(); });
    stream.getTracks().forEach(t=>t.stop()); recState=null; ov.remove(); buzz(20);
    if(cancel) return;
    const blob=new Blob(chunks,{type:mr.mimeType});
    const b64=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob)});
    if(b64.length>800000) {toast('Voice note too large. Please record a shorter note.');return;}
    sfx('send');
    try {await postMsg({type:'voice',_media:{data:b64,mime:mr.mimeType},dur:Math.max(1,Math.round((Date.now()-t0)/1000)),bars:Array.from({length:20},(_,i)=>8+(i*7)%19)});}catch(e){toast('Could not send voice note. Check connection.');}
  };
  const lock=()=>{locked=true;$('#rh',ov).textContent='Locked · tap send when ready';$('#rl',ov).style.color='var(--acc-soft)';buzz(15)};
  const end=()=>{if(!locked) finish(false)};
  const move=e=>{if(!gesture||locked)return; if(e.clientX<gesture.x-85)finish(true);else if(e.clientY<gesture.y-80)lock()};
  $('#rm',ov).onclick=()=>finish(false); $('#rc',ov).onclick=()=>finish(true); $('#rl',ov).onclick=lock;
  document.addEventListener('pointerup',end);document.addEventListener('pointermove',move);
  timer=setInterval(()=>{const sec=Math.floor((Date.now()-t0)/1000);$('#rt',ov).textContent=`0:${String(sec).padStart(2,'0')}`;if(sec>=60)finish(false);},250);
  recState={mr,stream,ov,finish};
}

/* ---------- GIF picker ---------- */
const gifCache=new Map();
const GIPHY_KEY_LOCAL = GIPHY_KEY;
async function giphy(endpoint, params) {
  const cacheKey=endpoint+JSON.stringify(params||{});const cached=gifCache.get(cacheKey);if(cached && Date.now()-cached.at<300000) return cached.data;
  const u = new URL('https://api.giphy.com/v1/gifs/' + endpoint);
  u.searchParams.set('api_key', GIPHY_KEY_LOCAL); u.searchParams.set('limit', '24'); u.searchParams.set('rating', 'pg-13');
  Object.entries(params||{}).forEach(([k,v]) => u.searchParams.set(k,v));
  const r = await fetch(u); if(!r.ok) throw new Error('GIF provider unavailable'); const j = await r.json();
  const data=(j.data||[]).map(g => ({ id: g.id, url: g.images.fixed_height.url, prev: g.images.fixed_height_small.url, w: g.images.fixed_height.width, h: g.images.fixed_height.height }));
  gifCache.set(cacheKey,{at:Date.now(),data});return data;
}
async function openGifPicker() {
  buzz(10);
  closeSheets();
  const ov = el(`<div class="gif-overlay"><div class="gif-sheet">
    <div class="rec-grab" style="align-self:center"></div>
    <div class="gif-search">${I.search}<input id="gq" placeholder="Search GIFs" autocomplete="off"></div>
    <div class="gif-chips">${[['Trending',''],['Funny','funny'],['Yes','yes'],['Cry','cry'],['Hype','hype'],['Love','love'],['Party','party'],['Clap','clap']].map(([label,q],i)=>`<button class="gif-chip ${i===0?'on':''}" data-q="${q}">${label==='Hype'?I.flame.replace('width="38" height="38"','width="14" height="14"'):''}${label}</button>`).join('')}</div>
    <div class="gif-grid" id="gg"></div>
    <div class="gif-credit2">POWERED BY GIPHY</div></div></div>`);
  root.append(ov);
  ov.addEventListener('click', e => { if (e.target === ov) closeSheets(); });
  const grid = $('#gg', ov);
  let gifRequest=0;
  const load = async (q) => {
    const request=++gifRequest;
    grid.innerHTML = '';
    let gifs = [];
    try { gifs = q ? await giphy('search',{q}) : await giphy('trending'); }
    catch(e) { grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:30px">GIFs unavailable right now</p>'; return; }
    if(request!==gifRequest || !grid.isConnected) return;
    if(!gifs.length) {grid.innerHTML='<p style="color:var(--sub);padding:20px">No GIFs found. Try another word.</p>';return;}
    grid.innerHTML = gifs.map((g,i)=>`<div class="gif-cell" data-u="${g.url}" style="animation-delay:${Math.min(i*30,240)}ms"><img src="${g.prev}" loading="lazy"></div>`).join('');
    $$('.gif-cell', grid).forEach(c => c.onclick = async () => {
      buzz(14); sfx('send'); closeSheets();
      await postMsg({ type:'gif', gifUrl: c.dataset.u });
    });
  };
  load('');
  $$('.gif-chip', ov).forEach(c => c.onclick = () => { buzz(8); $$('.gif-chip', ov).forEach(x=>x.classList.toggle('on',x===c)); load(c.dataset.q||''); });
  let deb;
  $('#gq', ov).oninput = e => { $$('.gif-chip',ov).forEach(c=>c.classList.remove('on')); clearTimeout(deb); deb = setTimeout(()=>load(e.target.value.trim()), 350); };
}

/* ---------- group info ---------- */
async function openGroupInfo(c) {
  buzz(8);
  closeSheets();
  const isAdmin = (c.admins||[]).includes(state.user.uid);
  const sh = el(`<div class="sheet-overlay"></div>`);
  const sheet = el(`<div class="sheet">
    <div class="rec-grab" style="align-self:center"></div>
    <div style="display:flex;flex-direction:column;align-items:center;padding:14px 0 6px">
      <button class="avatar ${isAdmin?'av-edit':''} press" id="gi-photo" aria-label="Group photo" style="${c.photo?'':`background:${gradFor(c.id)};`}width:72px;height:72px;border-radius:26px;font-size:24px">${c.photo?`<img src="${c.photo}" alt="">`:`${initials(c.name||'G')}${isAdmin?`<span class="av-cam">${I.camera}</span>`:''}`}</button>
      <h2 style="margin-top:12px;display:flex;align-items:center;gap:8px">${esc(c.name||'Group')}${isAdmin?`<button class="icon-btn press" id="gi-ren" aria-label="Rename group" style="width:30px;height:30px;border-radius:10px;color:var(--acc-soft)">${I.edit}</button>`:''}</h2>
      <div class="sub">${(c.members||[]).length} members</div>
    </div>
    <div class="people-list">
      ${(c.members||[]).map(uid => { const p = state.profiles[uid]||{name:'?',username:'?'};
        const removable = isAdmin && uid!==state.user.uid && !(c.admins||[]).includes(uid);
        return `<div class="member-row">${avatarHtml(uid, p.name, p.photo||null)}
        <div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}${uid===state.user.uid?' <span style="color:var(--muted);font-size:12px">(you)</span>':''}</div>
        <div class="hd">@${esc(p.username)}</div></div>
        ${(c.admins||[]).includes(uid) ? '<span class="role-chip">ADMIN</span>':''}
        ${removable?`<button class="icon-btn press mem-x" data-uid="${uid}" aria-label="Remove ${esc(p.name)}" style="width:32px;height:32px;border-radius:11px;color:var(--muted)">${I.x}</button>`:''}</div>`; }).join('')}
    </div>
    ${isAdmin ? `<button class="btn-primary" id="add-mem" style="margin-top:12px">Add members</button>`:''}
    <button class="btn-text-danger" id="leave-grp">Leave group</button>
  </div>`);
  root.append(sh, sheet);
  sh.onclick = closeSheets;
  if (isAdmin) $('#add-mem', sheet).onclick = () => { closeSheets(); openNewChatSheet(c); };
  if (isAdmin) $('#gi-ren', sheet).onclick = () => openGroupRenamer(c);
  if (isAdmin) $('#gi-photo', sheet).onclick = () => pickImageFile(async file => {
    try {
      const uri = await prepAvatar(file);
      if (!uri) { toast('That photo is too detailed. Try another one.'); return; }
      await updateDoc(doc(db,'chats',c.id), {photo: uri});
      c.photo = uri; closeSheets(); toast('Group photo updated'); buzz(14);
    } catch(e) { toast('Could not save photo. Check connection.'); }
  });
  $$('.mem-x', sheet).forEach(b => b.onclick = () => {
    const uid = b.dataset.uid;
    const p = state.profiles[uid]||{name:'this member'};
    if (!confirm(`Remove ${p.name} from ${c.name||'the group'}?`)) return;
    updateDoc(doc(db,'chats',c.id), {members: arrayRemove(uid)}).then(() => {
      c.members = (c.members||[]).filter(x => x!==uid);
      buzz(12); closeSheets(); toast('Member removed');
    }).catch(() => toast('Could not remove member. Check connection.'));
  });
  $('#leave-grp', sheet).onclick = async () => {
    if (!confirm(`Leave ${c.name||'this group'}? A member will need to add you back.`)) return;
    try {
      await updateDoc(doc(db,'chats',c.id), {members: arrayRemove(state.user.uid)});
      buzz(12); closeSheets();
      msgUnsub&&msgUnsub(); chatUnsub&&chatUnsub(); state.openChat=null; startApp();
      toast('You left the group');
    } catch(e) { toast('Could not leave. Check connection.'); }
  };
}
function openGroupRenamer(c){
  buzz(10); closeSheets();
  const ov = el(`<div class="sheet-overlay"></div>`);
  const sh = el(`<div class="sheet">
    <div class="rec-grab" style="align-self:center"></div>
    <h2>Group name</h2><div class="sub">Everyone in the group sees the new name</div>
    <input class="inp" id="gr-inp" maxlength="80" value="${esc(c.name||'')}" placeholder="Group name">
    <button class="btn-primary" id="gr-save" style="margin-top:16px">Save</button>
  </div>`);
  root.append(ov, sh); ov.onclick = closeSheets;
  const inp=$('#gr-inp',sh); setTimeout(()=>{inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);},300);
  const save=async()=>{
    const name=inp.value.trim(); if(!name){inp.focus();return;}
    $('#gr-save',sh).disabled=true;
    try{
      await updateDoc(doc(db,'chats',c.id),{name:name.slice(0,80)});
      c.name=name.slice(0,80); closeSheets(); toast('Group renamed'); buzz(14);
      if(state.openChat===c.id){ const n=$('#head-t .n'); if(n)n.textContent=c.name; }
    }catch(e){$('#gr-save',sh).disabled=false;toast('Could not save. Check connection.');}
  };
  $('#gr-save',sh).onclick=save;
  inp.onkeydown=e=>{if(e.key==='Enter')save();};
}

/* ---------- presence heartbeat ---------- */
let heartbeatTimer=null;
function heartbeat() {
  if(heartbeatTimer) return;
  const beat = async () => {
    try {
      if(document.hidden || !state.user) return;
      if (state.openChat) await updateDoc(doc(db,'chats',state.openChat), { [`presence.${state.user.uid}`]: Date.now() });
    } catch(e){}
  };
  beat(); heartbeatTimer=setInterval(beat, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(); });
}

/* ---------- boot ---------- */
async function bootUser(u) {
  if (!u) { Object.values(state.unsub).forEach(f=>f()); msgUnsub?.();chatUnsub?.();destroyParty();destroyWatch();leaveCall(true);Object.values(state.callUnsubs).forEach(f=>f());state.callUnsubs={};state.callDocs={};state.pins=[];$('#call-banner')?.remove();state.user=null;showAuth('login'); return; }
  state.user = u;
  const p = await getDoc(doc(db,'profiles',u.uid));
  state.profile = p.exists() ? p.data() : { name:'Me', username:'me' };
  const privateP=await getDoc(doc(db,'privateProfiles',u.uid)); if(privateP.exists()){ const pd=privateP.data(); state.profile.email=pd.email; state.pins=pd.pins||[]; }
  state.profiles[u.uid] = state.profile;
  startApp();
}
onAuthStateChanged(auth,u=>{if(!signingUp)bootUser(u)});

if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});
window.addEventListener('offline',()=>toast('You are offline. Reconnect to send messages.'));
/* ---------- existing-game party layer (no game logic hosted by Flami) ---------- */
const GAMES={drawphone:{name:'Drawphone',desc:'Draw. Guess. Pass it on.',detail:'4+ friends · Drawing telephone',create:'https://drawphone.tannerkrewson.com/new',note:'Existing game by Tanner Krewson. Choose Simple words; mature packs also exist. After a reload, rejoin and pick your old player slot. Public server availability is not guaranteed.'},spyfall:{name:'Spyfall',desc:'Ask questions. Catch the spy.',detail:'4+ friends · Secret roles and locations',create:'https://spyfall.tannerkrewson.com/new',note:'MIT game by Tanner Krewson and contributors, with a small Flami client adaptation. Discussion uses group chat or a Flami voice call. Public server availability is not guaranteed.'},longwave:{name:'Longwave',desc:'Give a clue. Read their mind.',detail:'2+ cooperative · 4+ team play',automatic:true,note:'MIT Longwave by Evan Bailey and Margarethe Schoen, adapted for Flami name handoff. Existing spectrum-guessing game, not a new game made by Flami. English deck. Use group chat or an existing call. Public game state is held on the original backend; unlisted rooms are not private or cheat-proof.'},snakeout:{name:'Snakeout',desc:'Trust your crew. Find the snakes.',detail:'5-10 players · Hidden-role missions',create:'https://snakeout.tannerkrewson.com/new',note:'MIT Snakeout by Tanner Krewson, with a small Flami client fix for team selection. 5-10 players. Use distinct names and group chat or an existing call. After reload, select your old disconnected player slot. Unlisted public room, not secure account-bound identity. Public-server uptime is not guaranteed.'}};
const partyGame=()=>GAMES[party?.data?.gameId||party?.selectedGame||'drawphone']||GAMES.drawphone;
const partyName=()=>partyGame().name;
function gamePlayerId(){let h=2166136261;for(const c of state.user.uid+party.data.sessionId){h=Math.imul(h^c.charCodeAt(0),16777619);}return 'p'+(h>>>0).toString(36);}
function gameURL(code,host){if(party.data?.gameId==='snakeout'){const u=new URL('/games/snakeout/',location.origin);u.search=new URLSearchParams({code,name:gameName(),rocketcrab:'true'}).toString();return u.href;}if(party.data?.gameId==='longwave'){const u=new URL('/games/longwave/',location.origin);u.search=new URLSearchParams({room:'flami-'+party.data.sessionId,name:gameName(),player:gamePlayerId()}).toString();return u.href;}if((party.data?.gameId||'drawphone')==='spyfall'){const u=new URL('/games/spyfall/',location.origin);u.search=new URLSearchParams({code,name:gameName()}).toString();return u.href;}const u=new URL('https://drawphone.tannerkrewson.com/');u.search=new URLSearchParams({rocketcrab:'true',code,name:gameName(),ishost:String(host)}).toString();return u.href;}
let party=null, partyUnsub=null;
const gameName=()=>state.profile.name.replace(/[<>&\x00-\x1f]/g,'').slice(0,16)||'Player';
const gameRef=cid=>doc(db,'chats',cid,'games','current');
function destroyParty(){root.inert=false;partyUnsub?.();partyUnsub=null;party?.node.remove();party=null;$('#party-return')?.remove();}
function minimizeParty(){if(!party)return;root.inert=false;party.node.classList.add('gp-hidden');party.node.inert=true;let b=$('#party-return');if(!b){b=el(`<button id="party-return">✦ Return to ${partyName()} <span>Game stays open</span></button>`);document.body.append(b);b.onclick=()=>{party.node.classList.remove('gp-hidden');party.node.inert=false;root.inert=true;b.remove();};}buzz(8);}
async function openParty(cid,expected){
  try{
    if(wp&&wp.data?.status!=='ended')return toast('Close the open watch party first.');
    if(party && party.data?.status!=='ended' && party.cid===cid && (!expected || expected===party.data?.sessionId)){party.node.classList.remove('gp-hidden');party.node.inert=false;root.inert=true;$('#party-return')?.remove();return;}
    const snap=await getDoc(gameRef(cid));const d=snap.exists()?snap.data():null;
    if(expected && (!d||d.sessionId!==expected||d.status==='ended'))return toast('That party has ended. Tap ✦ to start a new one.');
    if(party && party.data?.status!=='ended'){if(!confirm(party.data?.host===state.user.uid?'End your hosted party to open another? Everyone will leave its game view.':'Leave your open game to open this party?'))return;try{await updateDoc(gameRef(party.cid),party.data?.host===state.user.uid?{status:'ended'}:{[`players.${state.user.uid}`]:false});}catch(e){toast('Could not leave the current party.');return;}}
    if(party)destroyParty();
    const n=el(`<section class="game-panel" role="dialog" aria-modal="true" aria-label="Group game party"><header class="gp-head"><button id="gp-back" aria-label="Minimize game">${I.back}</button><div><b>Drawphone</b><small>Inside Flami · Your group stays here</small></div><button id="gp-full" aria-label="Toggle fullscreen">⛶</button><button id="gp-close" aria-label="Leave game">×</button></header><div class="gp-scroll"><div id="gp-lobby"></div><div id="gp-frame-wrap"></div><div id="gp-setup"></div><div class="gp-footnote">Existing game by Tanner Krewson. Choose Simple words. The game also offers mature word packs. After a reload, rejoin and choose your old player slot inside the game. Drawphone controls reconnects and availability.</div></div></section>`);
    document.body.append(n);root.inert=true;party={cid,node:n,data:d,frameKey:null,expected,joined:false};
    $('#gp-back',n).onclick=minimizeParty;
    $('#gp-close',n).onclick=async()=>{const host=party.data?.host===state.user.uid;if(!confirm(host?'End this party for the group? Minimize instead to keep everyone connected.':'Leave this game? Minimize instead to keep your game connected.'))return;try{if(party.data&&party.data.status!=='ended')await updateDoc(gameRef(cid),host?{status:'ended'}:{[`players.${state.user.uid}`]:false});destroyParty();}catch(e){toast('Could not leave. Check your connection.');}};
    $('#gp-full',n).onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await n.requestFullscreen();}catch(e){n.classList.toggle('gp-expanded');}};
    partyUnsub=onSnapshot(gameRef(cid),snap=>{if(!party||party.cid!==cid)return;party.data=snap.exists()?snap.data():null;renderParty();},()=>{toast('Party unavailable. Check group membership and connection.');destroyParty();});
    renderParty();buzz(12);
  }catch(e){toast('Could not open party. Check your connection.');}
}
function renderParty(){
  if(!party)return;
  const {node:n,data:d,cid}=party;const signature=JSON.stringify({id:d?.sessionId,host:d?.host,status:d?.status,code:d?.roomCode,players:d?.players,joined:party.joined,hostRoom:party.hostRoom});if(party.lastRender===signature)return;party.lastRender=signature;const draftCode=$('#gp-code',n)?.value||'';const lobby=$('#gp-lobby',n),setup=$('#gp-setup',n);
  if(!d||d.status==='ended'){
    $('#gp-frame-wrap',n).innerHTML='';party.frameKey=null;
    $('.gp-head b',n).textContent='Party games';$('.gp-footnote',n).textContent='Choose an existing game. All games open in this sheet. No new tabs, cards or extra accounts.';
    lobby.innerHTML=`<div class="gp-eyebrow">FLAMI PLAY</div><h1>Your crew.<br>Pick your chaos.</h1>${Object.entries(GAMES).map(([id,g])=>`<div class="gp-feature"><b>${g.name}</b><p>${g.desc}<br><small>${g.detail}</small></p><button class="gp-primary gp-create-game" data-game="${id}">Start ${g.name}</button></div>`).join('')}`;
    setup.innerHTML='<p class="gp-muted">One active party per group. Longwave opens automatically; other games ask the host to copy a four-letter code once. Everyone else taps the chat invite.</p>';
    $$('.gp-create-game',n).forEach(b=>b.onclick=()=>{party.selectedGame=b.dataset.game;createParty(b);});return;
  }
  if(party.expected && d.sessionId!==party.expected){destroyParty();toast('This invite has expired.');return;}
  $('.gp-head b',n).textContent=partyName();$('.gp-footnote',n).textContent=partyGame().note;
  const host=d.host===state.user.uid;const players=Object.entries(d.players||{}).filter(([id,v])=>v===true);
  lobby.innerHTML=`<div class="gp-lobbyline"><span class="gp-tag">${d.status==='setup'?'HOST SETUP':'PARTY OPEN'}</span><span>${players.length} in Flami lobby · ${d.gameId==='longwave'?'2+ cooperative':d.gameId==='snakeout'?'5-10 players':'4+ recommended'}</span></div><div class="gp-players">${players.map(([id])=>`<span title="${esc(state.profiles[id]?.name||'Member')}"><i style="background:${gradFor(id)}">${esc(initials(state.profiles[id]?.name||'?'))}</i>${esc((state.profiles[id]?.name||'Member').split(' ')[0])}${id===d.host?' ♛':''}</span>`).join('')}</div><p class="gp-muted gp-small">Flami lobby attendance, not the game's live connection status.</p>`;
  if(host){
    const code=party.hostRoom||d.roomCode;
    if(d.status==='setup'&&!party.hostRoom&&!partyGame().automatic){
      setup.innerHTML=`<div class="gp-host-setup"><b>Create a room, right here</b><p>1. Tap Create room. ${partyName()} shows a line like {"gameCode":"abcd"} in the frame above.<br>2. Copy only its four letters into this box. No other page opens.</p><form method="POST" action="${partyGame().create}" target="drawphone-host" id="gp-provider-create"><button class="gp-primary" type="submit">Create room</button></form><form id="gp-code-form" style="margin-top:12px"><input id="gp-code" aria-label="Game room code" placeholder="Room code" maxlength="4" autocapitalize="none" autocomplete="off"><button class="gp-primary">Open my game</button></form><button class="gp-text" id="gp-end">End this Flami party</button></div>`;
      mountGame('host-code-'+d.sessionId,'about:blank');$('#gp-frame-wrap iframe',n).name='drawphone-host';
    }else{
      const hint=d.gameId==='longwave'?'Choose cooperative for 2+ players, or teams for 4+. Share the invite before starting.':['spyfall','snakeout'].includes(d.gameId)?'Use group chat or an existing call for discussion.':'Choose Simple words before starting.';
      setup.innerHTML=`<div class="gp-host-setup"><b>${d.status==='ready'?'Room shared with the group':'Your game is open'}</b><p>${d.status==='ready'?'Members join using their Flami names.':'Once you see the game above, share its invite.'} ${hint}</p>${d.status==='setup'?'<button class="gp-primary" id="gp-publish">Share invite in group</button>':'<span class="gp-muted">Minimize to chat while your game stays connected.</span>'}<button class="gp-text" id="gp-end">End this Flami party</button></div>`;
      mountGame('host-'+d.sessionId+'-'+code,gameURL(code,true));
      if($('#gp-publish',n))$('#gp-publish',n).onclick=shareParty;
    }
    if($('#gp-code-form',n)){$('#gp-code-form',n).onsubmit=shareParty;$('#gp-code',n).value=draftCode;}
    $('#gp-end',n).onclick=async()=>{if(!confirm('End the party for this group? Everyone will lose this Flami game view.'))return;try{await updateDoc(gameRef(cid),{status:'ended'});}catch(e){toast('Could not end party.');}};
  }else if(d.status==='setup'){
    setup.innerHTML='<div class="gp-host-setup"><b>The host is creating the room</b><p>Stay here. Once its code is shared, tap Join game. No code entry needed.</p></div>';
  }else{
    setup.innerHTML=`<div class="gp-host-setup"><b>${party.joined?'You joined this Flami party':'Ready when you are'}</b><p>You will join as ${esc(gameName())}. Your game name, a game-scoped player ID where needed, and room code go to the game server. No chat messages or Flami password are shared.</p>${!party.joined?'<button class="gp-primary" id="gp-join">Join game</button>':'<span class="gp-muted">Minimize to chat without closing the game.</span>'}</div>`;
    if(!party.joined)$('#gp-join',n).onclick=async()=>{try{await updateDoc(gameRef(cid),{[`players.${state.user.uid}`]:true});party.joined=true;renderParty();}catch(e){toast('Could not join. Try again.');}};
    if(party.joined)mountGame('player-'+d.sessionId,gameURL(d.roomCode,false));
  }
  if(d.status==='ended'){$('#gp-frame-wrap',n).innerHTML='';}
}
function mountGame(key,url){if(party.frameKey===key)return;party.frameKey=key;party.node.classList.toggle('gp-codeview',key.startsWith('host-code-'));const w=$('#gp-frame-wrap',party.node);w.innerHTML='';const f=document.createElement('iframe');f.name='drawphone-host';f.src=url;f.title=partyName()+' multiplayer game';f.referrerPolicy='no-referrer';f.setAttribute('sandbox',(url.includes('/games/spyfall/')||url.includes('/games/longwave/')||url.includes('/games/snakeout/'))?'allow-scripts':'allow-scripts allow-same-origin allow-forms');f.setAttribute('allow','fullscreen');w.append(f);}
async function createParty(b){
 b.disabled=true;party.expected=null;
  try{const data={gameId:party.selectedGame||'drawphone',sessionId:crypto.randomUUID(),host:state.user.uid,status:'setup',roomCode:'',players:{[state.user.uid]:true},createdAt:serverTimestamp()};await setDoc(gameRef(party.cid),data);party.joined=true;}catch(e){console.error('Party create:',e);toast('Could not start. Another party may already be open.');b.disabled=false;}
}
async function shareParty(e){
  e.preventDefault();const automatic=partyGame().automatic;const code=automatic?'':party.hostRoom||$('#gp-code',party.node)?.value.trim().toLowerCase();if(!automatic&&!/^[a-z]{4}$/.test(code))return toast('Use the four-letter code shown in the frame.');
  if(!automatic&&!party.hostRoom){party.hostRoom=code;renderParty();return;}
  const b=$('#gp-publish',party.node);b.disabled=true;
  const cid=party.cid,sid=party.data.sessionId;
  try{
    const batch=writeBatch(db);batch.update(gameRef(cid),{roomCode:code,status:'ready'});
    batch.set(doc(collection(db,'chats',cid,'messages')),{type:'game',gameId:party.data.gameId||'drawphone',text:partyName()+' party · Join in Flami',sessionId:sid,sender:state.user.uid,createdAt:serverTimestamp(),reads:{[state.user.uid]:true}});
    const updates={updatedAt:serverTimestamp(),lastMsg:{type:'game',gameId:party.data.gameId||'drawphone',text:partyName()+' party · Join in Flami',sender:state.user.uid,at:Date.now()}};
    for(const uid of state.chats.find(c=>c.id===cid)?.members||[])if(uid!==state.user.uid)updates[`unread.${uid}`]=increment(1);
    batch.update(doc(db,'chats',cid),updates);await batch.commit();toast('Invite shared in the group');
  }catch(e){toast('Could not share invite. Check your connection.');b.disabled=false;}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&party&&!party.node.classList.contains('gp-hidden'))minimizeParty();});

/* ---------- watch party (synced movie night inside group chats) ----------
   The host pastes a Dropbox / Google Drive / direct video link. Flami turns it
   into a stream URL, plays it in one sheet, and keeps every phone on the same
   second. The host's player is the single authority: it writes play/pause/seek
   state to Firestore every few seconds; viewers extrapolate from the moment the
   state arrives (no cross-phone clock math) and nudge playbackRate for small
   drift, hard-seek for large drift. Chat posts to the real group chat; emoji
   reactions float over the video for everyone. The video itself streams
   straight from the host's link - it never passes through Flami. */
const WATCH_EMOJI=['❤️','😂','😮','👏','🔥','😢'];
let wp=null, wpUnsub=null, wpReactUnsub=null, wpChatUnsub=null;
const watchRef=cid=>doc(db,'chats',cid,'watch','current');
const watchReactsRef=cid=>collection(db,'chats',cid,'watchReacts');
const fmtT=s=>{s=Math.max(0,Math.floor(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`;};

/* Turn a share link into a direct stream URL a <video> element can play. */
function watchSrcFromLink(raw){
  let u; try{ u=new URL(String(raw||'').trim()); }catch(e){ throw new Error('That does not look like a link yet.'); }
  if(u.protocol!=='https:') throw new Error('Use an https link.');
  const h=u.hostname.toLowerCase();
  if(h==='dropbox.com'||h.endsWith('.dropbox.com')){
    if(!/^\/(s|scl)\//.test(u.pathname)) throw new Error('Use the Dropbox share link for the video file itself.');
    u.hostname='dl.dropboxusercontent.com'; u.searchParams.delete('dl');
    return { src:u.toString(), label:'Dropbox' };
  }
  if(h.endsWith('drive.google.com')||h.endsWith('docs.google.com')){
    const m=u.pathname.match(/\/file\/d\/([\w-]{20,})/);
    const id=m?m[1]:u.searchParams.get('id');
    if(!id) throw new Error('Could not find the file in that Drive link.');
    return { src:'https://drive.usercontent.google.com/download?id='+encodeURIComponent(id)+'&export=download&confirm=t', label:'Google Drive' };
  }
  if(/\.(mp4|m4v|webm|ogv|mov)$/i.test(u.pathname)) return { src:u.toString(), label:'Direct link' };
  throw new Error('Paste a Dropbox share link, a Google Drive link, or a direct .mp4/.webm link.');
}
/* Prove the link actually plays before the group is invited. */
function probeWatchSrc(src){
  return new Promise((resolve,reject)=>{
    const v=document.createElement('video'); v.preload='metadata'; v.muted=true; v.playsInline=true;
    const done=(err,dur)=>{ clearTimeout(t); v.onloadedmetadata=v.onerror=null; v.removeAttribute('src'); v.load(); err?reject(err):resolve(dur); };
    const t=setTimeout(()=>done(new Error('The video link took too long to answer. Check its sharing settings.')),20000);
    v.onloadedmetadata=()=>done(null,isFinite(v.duration)?v.duration:0);
    v.onerror=()=>done(new Error('The browser could not play that link. On Drive, share the file as "Anyone with the link". On Dropbox, use the file\'s own share link.'));
    v.src=src;
  });
}
function destroyWatch(){
  root.inert=false;
  wpUnsub?.(); wpReactUnsub?.(); wpChatUnsub?.(); wpUnsub=wpReactUnsub=wpChatUnsub=null;
  if(wp){ if(wp.hostTimer)clearInterval(wp.hostTimer); if(wp.syncTimer)clearInterval(wp.syncTimer); try{wp.video?.pause();wp.video?.removeAttribute('src');wp.video?.load();}catch(e){} wp.node.remove(); wp=null; }
  $('#watch-return')?.remove();
}
function minimizeWatch(){
  if(!wp)return; root.inert=false; wp.node.classList.add('gp-hidden'); wp.node.inert=true;
  let b=$('#watch-return');
  if(!b){ b=el(`<button id="watch-return">🎬 Return to watch party <span>Video keeps playing</span></button>`); document.body.append(b);
    b.onclick=()=>{ wp.node.classList.remove('gp-hidden'); wp.node.inert=false; root.inert=true; b.remove(); }; }
  buzz(8);
}
async function openWatch(cid,expected){
  try{
    if(party&&party.data?.status!=='ended')return toast('Close the open game party first.');
    if(wp&&wp.data?.status!=='ended'&&wp.cid===cid&&(!expected||expected===wp.data?.sessionId)){ wp.node.classList.remove('gp-hidden'); wp.node.inert=false; root.inert=true; $('#watch-return')?.remove(); return; }
    const snap=await getDoc(watchRef(cid)); const d=snap.exists()?snap.data():null;
    if(expected&&(!d||d.sessionId!==expected||d.status==='ended'))return toast('That watch party has ended.');
    if(wp&&wp.data&&wp.data.status!=='ended'){
      const wasHost=wp.data.host===state.user.uid;
      if(!confirm(wasHost?'End your watch party to open another?':'Leave your watch party to open this one?'))return;
      try{ await updateDoc(watchRef(wp.cid), wasHost?{status:'ended'}:{[`viewers.${state.user.uid}`]:false}); }catch(e){ toast('Could not leave the current party.'); return; }
    }
    if(wp)destroyWatch();
    const n=el(`<section class="game-panel watch-panel" role="dialog" aria-modal="true" aria-label="Watch party">
      <header class="gp-head"><button id="wp-back" aria-label="Minimize watch party">${I.back}</button><div><b>Watch party</b><small>Inside Flami · Same second on every phone</small></div><button id="wp-full" aria-label="Toggle fullscreen">⛶</button><button id="wp-close" aria-label="Leave watch party">×</button></header>
      <div class="wp-body">
        <div class="wp-main">
          <div class="wp-stage">
            <video id="wp-video" playsinline preload="auto"></video>
            <div class="wp-floats" id="wp-floats"></div>
            <div class="wp-waiting" id="wp-waiting" style="display:none"><div class="boot-ring"></div><span id="wp-waiting-t">Buffering…</span></div>
            <button class="wp-joinstream" id="wp-joinstream" style="display:none">▶ <span>Join the stream</span></button>
            <div class="wp-live" id="wp-live" style="display:none"><i></i>LIVE</div>
          </div>
          <div class="wp-bar" id="wp-bar">
            <span class="wp-time" id="wp-time">0:00 / 0:00</span>
            <button class="wp-syncbtn" id="wp-sync" style="display:none">Jump back into sync</button>
          </div>
          <div class="wp-reacts" id="wp-reacts">${WATCH_EMOJI.map(e=>`<button class="wp-react press" data-e="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div>
          <div class="wp-meta" id="wp-meta"></div>
        </div>
        <div class="wp-side">
          <div class="gp-players wp-viewers" id="wp-viewers"></div>
          <div class="wp-chat" id="wp-chat"></div>
          <form class="wp-chatform" id="wp-chatform"><input id="wp-chatinp" maxlength="5000" placeholder="Chat while you watch…" autocomplete="off" aria-label="Chat while you watch"><button class="gp-primary" type="submit">Send</button></form>
        </div>
      </div>
    </section>`);
    document.body.append(n); root.inert=true;
    wp={cid,node:n,data:d,video:$('#wp-video',n),isHost:false,joinedStream:false,stateAt:0,openedAt:Date.now(),probeOk:null,hostTimer:null,syncTimer:null,stall:0};
    $('#wp-back',n).onclick=minimizeWatch;
    $('#wp-full',n).onclick=async()=>{ try{ if(document.fullscreenElement)await document.exitFullscreen(); else await n.requestFullscreen(); }catch(e){ n.classList.toggle('gp-expanded'); } };
    $('#wp-close',n).onclick=()=>wpLeave();
    const v=wp.video;
    v.addEventListener('waiting',()=>{ if(wp){$('#wp-waiting',n).style.display='flex';$('#wp-waiting-t',n).textContent='Buffering…';} });
    v.addEventListener('playing',()=>{ if(wp)$('#wp-waiting',n).style.display='none'; });
    v.addEventListener('canplay',()=>{ if(wp)$('#wp-waiting',n).style.display='none'; });
    v.addEventListener('error',()=>{ if(wp&&v.getAttribute('src'))toast('The video stopped loading. The link or its sharing may have failed.'); });
    v.addEventListener('play',()=>wpPushState());
    v.addEventListener('pause',()=>wpPushState());
    v.addEventListener('seeked',()=>wpPushState());
    v.addEventListener('ended',()=>wpPushState());
    $$('.wp-react',n).forEach(b=>b.onclick=()=>{ buzz(10); wpFloat(b.dataset.e,true); addDoc(watchReactsRef(cid),{e:b.dataset.e,uid:state.user.uid,at:Date.now()}).catch(()=>{}); });
    $('#wp-chatform',n).onsubmit=wpChatSend;
    $('#wp-sync',n).onclick=()=>{ buzz(8); wpHardSync(); };
    wpUnsub=onSnapshot(watchRef(cid),snap=>{
      if(!wp||wp.cid!==cid)return;
      const prev=wp.data?.state; const nd=snap.exists()?snap.data():null;
      if(nd?.state&&(!prev||nd.state.at!==prev.at||nd.state.playing!==prev.playing))wp.stateAt=Date.now();
      wp.data=nd; wp.isHost=!!(nd&&nd.host===state.user.uid);
      renderWatch();
      if(!wp.isHost)wpApplyState();
      if(wp.isHost&&!wp.hostTimer)wp.hostTimer=setInterval(()=>{ if(wp?.video&&!wp.video.paused&&!wp.video.ended)wpPushState(); },3000);
    },()=>{ toast('Watch party unavailable. Check your connection.'); destroyWatch(); });
    wp.syncTimer=setInterval(()=>{ if(wp&&!wp.isHost){wpApplyState();wpTickTime();} },1500);
    wpChatUnsub=onSnapshot(query(collection(db,'chats',cid,'messages'),orderBy('createdAt','desc'),limit(40)),snap=>{
      if(!wp)return;
      const missing=new Set(); snap.docs.forEach(d=>{const s=d.data().sender;if(s&&!state.profiles[s])missing.add(s);});
      if(missing.size)Promise.all([...missing].map(async uid=>{try{const p=await getDoc(doc(db,'profiles',uid));if(p.exists())state.profiles[uid]=p.data();}catch(e){}})).then(()=>{if(wp)renderWatchChat(snap);});
      else renderWatchChat(snap);
    },()=>{});
    wpReactUnsub=onSnapshot(query(watchReactsRef(cid),orderBy('at','desc'),limit(30)),snap=>{
      if(!wp)return;
      snap.docChanges().forEach(ch=>{ if(ch.type!=='added')return; const r=ch.doc.data(); if(r.uid===state.user.uid)return; if((r.at||0)<wp.openedAt-8000)return; wpFloat(r.e,false); });
    },()=>{});
    renderWatch(); buzz(12);
  }catch(e){ toast('Could not open the watch party. Check your connection.'); }
}
function renderWatchChat(snap){
  const box=$('#wp-chat',wp.node); if(!box)return;
  const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<120;
  box.innerHTML=[...snap.docs].reverse().map(d=>{
    const m=d.data(); const mine=m.sender===state.user.uid;
    const name=mine?'You':(state.profiles[m.sender]?.name||'?');
    let body;
    if(m.type==='text')body=linkify(m.text||'');
    else if(m.type==='voice')body='🎙 Voice note';
    else if(m.type==='image')body='📷 Photo';
    else if(m.type==='gif')body='GIF';
    else if(m.type==='game')body='✦ Game invite';
    else if(m.type==='watch')body='🎬 Watch party invite';
    else if(m.type==='call')body='📞 Voice call';
    else body=esc(m.text||'');
    return `<div class="wp-msg${mine?' mine':''}"><b>${esc(name)}</b><span>${body}</span></div>`;
  }).join('');
  if(nearBottom)box.scrollTop=box.scrollHeight;
}
async function wpChatSend(e){
  e.preventDefault();
  const inp=$('#wp-chatinp',wp.node); const text=inp.value.trim(); if(!text)return;
  inp.value=''; buzz(12); sfx('send');
  try{
    const batch=writeBatch(db);
    batch.set(doc(collection(db,'chats',wp.cid,'messages')),{type:'text',text,sender:state.user.uid,createdAt:serverTimestamp(),reads:{[state.user.uid]:true}});
    const updates={updatedAt:serverTimestamp(),lastMsg:{type:'text',text,sender:state.user.uid,at:Date.now()}};
    (state.chats.find(c=>c.id===wp.cid)?.members||[]).forEach(uid=>{ if(uid!==state.user.uid)updates[`unread.${uid}`]=increment(1); });
    batch.update(doc(db,'chats',wp.cid),updates);
    await batch.commit();
  }catch(err){ inp.value=text; toast('Could not send. Check connection.'); }
}
function wpFloat(e,mine){
  const layer=$('#wp-floats',wp?.node); if(!layer)return;
  const f=el(`<span class="wp-float${mine?' mine':''}" style="left:${6+Math.random()*82}%">${e}</span>`);
  layer.append(f); setTimeout(()=>f.remove(),4200);
}
async function wpPushState(){
  if(!wp||!wp.isHost||!wp.data||wp.data.status!=='live')return;
  const v=wp.video; if(!v||!v.getAttribute('src'))return;
  try{ await updateDoc(watchRef(wp.cid),{state:{playing:!v.paused&&!v.ended,time:Math.max(0,v.currentTime),at:Date.now()}}); }catch(e){}
}
function wpTargetTime(){
  const s=wp.data.state;
  return s.time+(s.playing?(Date.now()-(wp.stateAt||Date.now()))/1000:0);
}
function wpApplyState(){
  if(!wp||wp.isHost||!wp.data?.state||!wp.video||!wp.video.getAttribute('src'))return;
  const v=wp.video,s=wp.data.state,target=wpTargetTime();
  if(!wp.joinedStream)return;
  if(s.playing){
    const advanced=wp.prevTarget==null?true:(target-wp.prevTarget>0.04);
    wp.prevTarget=target;
    if(!advanced&&(Date.now()-wp.stateAt>2500)){ if(!v.paused)v.pause(); wpHostWaiting(true); return; }
    wpHostWaiting(false);
    if(v.paused)v.play().catch(()=>{});
    const diff=target-v.currentTime;
    if(Math.abs(diff)>2){ v.currentTime=target; v.playbackRate=1; }
    else v.playbackRate=diff>0.35?1.06:(diff<-0.35?0.94:1);
  }else{
    wp.prevTarget=null; wpHostWaiting(false);
    if(!v.paused)v.pause();
    v.playbackRate=1;
    if(Math.abs(v.currentTime-s.time)>1.5)v.currentTime=s.time;
  }
  wpUpdateSyncBadge();
}
function wpHostWaiting(on){
  if(!wp)return;
  const w=$('#wp-waiting',wp.node);
  if(on){ w.style.display='flex'; $('#wp-waiting-t',wp.node).textContent='Waiting for the host…'; }
  else if($('#wp-waiting-t',wp.node).textContent==='Waiting for the host…')w.style.display='none';
}
function wpHardSync(){
  if(!wp||wp.isHost||!wp.data?.state)return;
  const v=wp.video,target=wpTargetTime();
  if(wp.data.state.playing){ wp.joinedStream=true; v.currentTime=target; v.play().catch(()=>{}); }
  else v.currentTime=wp.data.state.time;
  wpUpdateSyncBadge();
}
function wpUpdateSyncBadge(){
  if(!wp||wp.isHost)return;
  const btn=$('#wp-sync',wp.node),s=wp.data?.state;
  if(!s||!wp.joinedStream){btn.style.display='none';return;}
  const behind=Math.abs(wpTargetTime()-wp.video.currentTime);
  btn.style.display=s.playing&&behind>3?'':'none';
}
function wpTickTime(){
  if(!wp)return;
  const v=wp.video,t=$('#wp-time',wp.node);
  if(!t)return;
  const dur=isFinite(v.duration)&&v.duration>0?v.duration:(wp.data?.durationHint||0);
  t.textContent=fmtT(v.currentTime)+' / '+(dur?fmtT(dur):'–:––');
}
async function wpLeave(){
  if(!wp)return;
  const host=wp.data?.host===state.user.uid,live=wp.data&&wp.data.status!=='ended';
  if(!confirm(host&&live?'End this watch party for the group? Minimize instead to keep it running.':(live?'Leave this watch party? Minimize instead to keep watching.':'Close the watch party?')))return;
  try{ if(live)await updateDoc(watchRef(wp.cid),host?{status:'ended'}:{[`viewers.${state.user.uid}`]:false}); }catch(e){ toast('Could not leave. Check your connection.'); return; }
  destroyWatch();
}
function renderWatch(){
  if(!wp)return;
  const {node:n,data:d}=wp;
  const meta=$('#wp-meta',n),viewers=$('#wp-viewers',n);
  if(!d||d.status==='ended'){
    $('.gp-head b',n).textContent='Watch party';
    $('#wp-video',n).style.display='none'; $('#wp-reacts',n).style.display='none'; $('#wp-bar',n).style.display='none'; $('#wp-live',n).style.display='none'; $('#wp-joinstream',n).style.display='none';
    const ended=d&&d.status==='ended';
    if(!$('#wp-setup',n)){
      const s=el(`<div class="wp-setup" id="wp-setup">
        <div class="gp-eyebrow">FLAMI WATCH</div>
        <h1>Movie night,<br>one screen for all.</h1>
        ${ended?'<p class="gp-muted">The last party ended. Start a new one below.</p>':''}
        <div class="gp-feature"><b>Host a movie</b><p>Paste a Dropbox or Google Drive share link, or a direct .mp4 link. Everyone watches in sync, chats and reacts live.</p>
          <input class="wp-inp" id="wp-title" maxlength="80" placeholder="Movie title (optional)">
          <input class="wp-inp" id="wp-link" placeholder="https://www.dropbox.com/… or drive.google.com/…" inputmode="url" autocapitalize="none" autocomplete="off">
          <div class="wp-probe" id="wp-probe"></div>
          <div style="display:flex;gap:8px"><button class="gp-primary" id="wp-check" style="flex:1">Check link</button><button class="gp-primary" id="wp-start" style="flex:2" disabled>Start party &amp; invite group</button></div>
        </div>
        <p class="gp-muted gp-small">The video streams straight from the host's link, never through Flami. Drive files must be shared "Anyone with the link". Dropbox free accounts have daily sharing bandwidth, so very large files may stop after heavy viewing.</p>
      </div>`);
      $('.wp-main',n).append(s);
      let probed=null;
      $('#wp-check',n).onclick=async()=>{
        const out=$('#wp-probe',n); probed=null; $('#wp-start',n).disabled=true;
        let conv; try{ conv=watchSrcFromLink($('#wp-link',n).value); }catch(e){ out.innerHTML=`<span class="wp-err">${esc(e.message)}</span>`; return; }
        out.innerHTML='<span class="wp-dim">Checking the link…</span>';
        try{ const dur=await probeWatchSrc(conv.src); probed=conv;
          out.innerHTML=`<span class="wp-ok">✓ Plays in the browser · ${esc(conv.label)}${dur?` · ${fmtT(dur)}`:''}</span>`;
          $('#wp-start',n).disabled=false; wp.probeOk=probed;
        }catch(e){ const hint=conv&&conv.label==='Google Drive'?' Google blocks Drive videos from playing inside other web apps. Dropbox (free) and direct .mp4 links work.':''; out.innerHTML=`<span class="wp-err">${esc(e.message+hint)}</span>`; }
      };
      $('#wp-link',n).oninput=()=>{ probed=null; wp.probeOk=null; $('#wp-start',n).disabled=true; $('#wp-probe',n).innerHTML=''; };
      $('#wp-start',n).onclick=async()=>{
        const conv=wp.probeOk||probed; if(!conv)return;
        const b=$('#wp-start',n); b.disabled=true;
        const title=($('#wp-title',n).value.trim()||'Movie night').slice(0,80);
        const link=$('#wp-link',n).value.trim().slice(0,1000);
        try{
          const sid=crypto.randomUUID();
          await setDoc(watchRef(wp.cid),{sessionId:sid,host:state.user.uid,status:'setup',title:'',src:'',srcLabel:'',link:'',state:{playing:false,time:0,at:Date.now()},viewers:{[state.user.uid]:true},createdAt:serverTimestamp()});
          const batch=writeBatch(db);
          batch.update(watchRef(wp.cid),{title,src:conv.src,srcLabel:conv.label,link,status:'live',state:{playing:false,time:0,at:Date.now()}});
          batch.set(doc(collection(db,'chats',wp.cid,'messages')),{type:'watch',sessionId:sid,title,srcLabel:conv.label,text:'🎬 '+title+' · Watch party',sender:state.user.uid,createdAt:serverTimestamp(),reads:{[state.user.uid]:true}});
          const updates={updatedAt:serverTimestamp(),lastMsg:{type:'watch',text:'🎬 '+title+' · Watch party',sender:state.user.uid,at:Date.now()}};
          (state.chats.find(c=>c.id===wp.cid)?.members||[]).forEach(uid=>{ if(uid!==state.user.uid)updates[`unread.${uid}`]=increment(1); });
          batch.update(doc(db,'chats',wp.cid),updates);
          await batch.commit();
          toast('Watch party started · invite posted');
        }catch(e){ b.disabled=false; toast('Could not start the party. Check your connection.'); }
      };
    }
    return;
  }
  $('#wp-setup',n)?.remove();
  const host=d.host===state.user.uid; wp.isHost=host;
  $('.gp-head b',n).textContent=d.title||'Watch party';
  const v=wp.video;
  if(v.getAttribute('src')!==d.src&&(host||wp.joinedStream))v.src=d.src;
  v.controls=host;
  v.style.display='';
  $('#wp-reacts',n).style.display='';
  $('#wp-bar',n).style.display='';
  const live=$('#wp-live',n);
  live.style.display='flex';
  live.classList.toggle('paused',!d.state?.playing);
  live.lastChild.textContent=d.state?.playing?'LIVE':'PAUSED';
  const vids=Object.entries(d.viewers||{}).filter(([,x])=>x===true);
  viewers.innerHTML=vids.map(([id])=>`<span title="${esc(state.profiles[id]?.name||'Member')}"><i style="background:${gradFor(id)}">${esc(initials(state.profiles[id]?.name||'?'))}</i>${esc((state.profiles[id]?.name||'Member').split(' ')[0])}${id===d.host?' ♛':''}</span>`).join('');
  meta.innerHTML=`<span class="gp-muted gp-small">${esc(d.srcLabel||'Video')} · ${vids.length} watching · ${host?'You are the host - your play, pause and seek control every screen.':'The host controls playback for everyone.'}</span>${host?' <button class="gp-text" id="wp-end">End party</button>':''}`;
  if($('#wp-end',n))$('#wp-end',n).onclick=async()=>{ if(!confirm('End the party for this group?'))return; try{ await updateDoc(watchRef(wp.cid),{status:'ended'}); }catch(e){ toast('Could not end the party.'); } };
  if(host){
    $('#wp-joinstream',n).style.display='none';
    if(!wp.hostTimer)wp.hostTimer=setInterval(()=>{ if(wp?.video&&!wp.video.paused&&!wp.video.ended)wpPushState(); },3000);
  }else{
    if(!wp.joinedStream){
      const j=$('#wp-joinstream',n); j.style.display='flex';
      j.onclick=async()=>{
        buzz(12); wp.joinedStream=true; j.style.display='none';
        if(!v.getAttribute('src'))v.src=d.src;
        try{ await updateDoc(watchRef(wp.cid),{[`viewers.${state.user.uid}`]:true}); }catch(e){}
        wpApplyState(); wpTickTime();
      };
    }else $('#wp-joinstream',n).style.display='none';
  }
  wpTickTime();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&wp&&!wp.node.classList.contains('gp-hidden'))minimizeWatch();});


/* ---------- voice calls (WebRTC mesh, Firestore signaling, audio only) ---------- */
/* Stability-first build. Freshness is measured by OBSERVING keepalives move, never by
   comparing another phone's clock to ours, so clock drift between phones can no longer
   make live participants look dead (that caused flickering tiles and killed audio).
   Call tiles re-render only when something actually changes. ICE candidates are queued
   until the remote description lands, and a rebuilt peer's offer gets a clean local
   rebuild instead of a failure. Recovery escalates: ICE restart, then full rebuild. */
const RTC_ICE=[
  {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun.relay.metered.ca:80']},
  /* Metered TURN (free tier, client-facing credential - replaces the decommissioned openrelay demo) */
  ...(TURN_USERNAME?[{urls:['turn:global.relay.metered.ca:80','turn:global.relay.metered.ca:443','turn:global.relay.metered.ca:80?transport=tcp','turns:global.relay.metered.ca:443?transport=tcp'],username:TURN_USERNAME,credential:TURN_CREDENTIAL}]:[])
];
const callRef=cid=>doc(db,'chats',cid,'call','current');
const callPartRef=(cid,uid)=>doc(db,'chats',cid,'callParts',uid);
const CALL_FRESH_MS=120000, PART_STALE_MS=75000, PING_MS=15000;
/* A call doc counts as live when we have SEEN its lastActivity move recently, so a
   skewed phone clock cannot hide or fake a live call. */
const callFresh=(d,cid)=>{ const seen=state.callSeen&&state.callSeen[cid]; return !!(d&&d.active&&seen&&Date.now()-seen<CALL_FRESH_MS); };
function watchCallDocs(){
  const want=new Set(state.chats.map(c=>c.id));
  Object.entries(state.callUnsubs).forEach(([cid,u])=>{ if(!want.has(cid)){try{u()}catch(e){} delete state.callUnsubs[cid]; delete state.callDocs[cid]; if(state.callSeen)delete state.callSeen[cid]; if(state.callLastAct)delete state.callLastAct[cid];} });
  state.callSeen=state.callSeen||{}; state.callLastAct=state.callLastAct||{};
  state.chats.forEach(c=>{ if(state.callUnsubs[c.id])return;
    state.callUnsubs[c.id]=onSnapshot(doc(db,'chats',c.id,'call','current'),snap=>{
      const d=snap.exists()?snap.data():null;
      if(d&&d.active&&d.lastActivity){
        const la=d.lastActivity.toMillis(), prev=state.callLastAct[c.id], now=Date.now();
        if(prev!==la){
          state.callLastAct[c.id]=la;
          /* first sight: trust the raw diff when clocks agree; later movement proves liveness either way */
          if(prev!==undefined||now-la<CALL_FRESH_MS)state.callSeen[c.id]=now;
        }
      }
      state.callDocs[c.id]=d;
      renderCallBanner(); updateCallBtn();
    },()=>{});
  });
}
/* Participants are fresh while their keepalive ping keeps CHANGING within the stale
   window, measured by our own clock. Immune to clock drift between phones. */
function callPartsFresh(call){
  const now=Date.now();
  return Object.entries(call.parts||{}).filter(([id,p])=>id!==state.user.uid&&call.seenAt&&call.seenAt[id]&&now-call.seenAt[id]<PART_STALE_MS);
}
let ringTimer=null;
function renderCallBanner(){
  let b=$('#call-banner');
  const entry=Object.entries(state.callDocs).find(([cid,d])=>callFresh(d,cid)&&!(state.call&&state.call.cid===cid)&&!state.dismissedCalls[cid+':'+(d.startedAt?.toMillis?.()||'')]);
  if(!entry||state.call){ if(b)b.remove(); stopRing(); return; }
  const [cid,d]=entry;
  const c=state.chats.find(x=>x.id===cid); if(!c){ if(b)b.remove(); return; }
  const name=chatDisplay(c).name;
  if(!b){ b=el(`<div id="call-banner"><div class="cb-pulse"></div><div class="cb-txt"><b>Voice call</b><span></span></div><button class="cb-join">Join</button><button class="cb-x" aria-label="Dismiss">×</button></div>`);
    document.body.append(b);
    $('.cb-x',b).onclick=()=>{buzz(8);state.dismissedCalls[cid+':'+(d.startedAt?.toMillis?.()||'')]=1;b.remove();stopRing();};
    $('.cb-join',b).onclick=()=>{buzz(10);stopRing();joinCall(cid);};
    startRing();
  }
  $('.cb-txt span',b).textContent=name;
}
function startRing(){
  stopRing();
  const beep=()=>{ try{ navigator.vibrate&&navigator.vibrate([120,80,120]); const ac=state._ringAc||(state._ringAc=new (window.AudioContext||window.webkitAudioContext)()); if(ac.state==='suspended')ac.resume().catch(()=>{});
    [0,0.25].forEach(t=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(0.0001,ac.currentTime+t);g.gain.exponentialRampToValueAtTime(0.06,ac.currentTime+t+0.03);g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+t+0.2);o.connect(g).connect(ac.destination);o.start(ac.currentTime+t);o.stop(ac.currentTime+t+0.25);}); }catch(e){} };
  beep(); ringTimer=setInterval(beep,2600);
}
function stopRing(){ if(ringTimer){clearInterval(ringTimer);ringTimer=null;} }
function updateCallBtn(){
  const btn=$('#call-btn'); if(!btn||!state.openChat)return;
  const live=callFresh(state.callDocs[state.openChat],state.openChat);
  btn.classList.toggle('live',live&&!(state.call&&state.call.cid===state.openChat));
  btn.classList.toggle('incall',!!(state.call&&state.call.cid===state.openChat));
}
async function sendSignal(call,peer,msg){
  await addDoc(collection(db,'chats',call.cid,'callSignals'),{from:state.user.uid,to:peer,type:msg.type,sdp:msg.sdp?JSON.stringify(msg.sdp):'',candidate:msg.candidate?JSON.stringify(msg.candidate):'',ts:serverTimestamp()});
}
function closePeer(call,peer){
  const ctx=call.pcs[peer]; if(!ctx)return;
  try{ctx.pc.close()}catch(e){}
  if(ctx.audio){try{ctx.audio.srcObject=null;ctx.audio.remove()}catch(e){}}
  delete call.pcs[peer];
}
/* Open connections to everyone currently fresh, drop connections to everyone else. */
function reconcilePeers(call){
  const ids=new Set(callPartsFresh(call).map(([id])=>id));
  ids.forEach(id=>ensurePeer(call,id));
  Object.keys(call.pcs).forEach(id=>{ if(!ids.has(id))closePeer(call,id); });
}
function rebuildPeer(call,peer){
  closePeer(call,peer);
  if(callPartsFresh(call).some(([id])=>id===peer)) ensurePeer(call,peer);
  renderCallOverlay();
}
function unlockCallAudio(call){
  try{ if(call.audioCtx&&call.audioCtx.state==='suspended')call.audioCtx.resume().catch(()=>{}); }catch(e){}
  Object.values(call.pcs||{}).forEach(ctx=>{ if(ctx.audio)ctx.audio.play().catch(()=>{}); });
}
function ensurePeer(call,peer){
  if(call.pcs[peer])return call.pcs[peer];
  const uid=state.user.uid;
  const pc=new RTCPeerConnection({iceServers:RTC_ICE,iceCandidatePoolSize:2});
  const ctx={pc,polite:String(uid)>String(peer),makingOffer:false,ignoreOffer:false,audio:null,analyser:null,
    candQueue:[],discSince:0,lastRestart:0,restarts:[],connSince:Date.now(),suppressOffer:false,retried:false};
  call.pcs[peer]=ctx;
  call.stream.getTracks().forEach(t=>pc.addTrack(t,call.stream));
  pc.onnegotiationneeded=async()=>{
    if(ctx.suppressOffer){ ctx.suppressOffer=false; return; }
    try{ ctx.makingOffer=true; await pc.setLocalDescription(); await sendSignal(call,peer,{type:'sdp',sdp:pc.localDescription.toJSON()}); }catch(e){} finally{ ctx.makingOffer=false; }
  };
  pc.onicecandidate=(e)=>{ if(e.candidate){ try{ sendSignal(call,peer,{type:'candidate',candidate:e.candidate.toJSON()}).catch(()=>{}); }catch(err){} } };
  pc.ontrack=e=>{ let a=ctx.audio; if(!a){ a=el('<audio autoplay playsinline></audio>'); ctx.audio=a; ($('#call-audios')||document.body).append(a); } a.srcObject=e.streams[0]; a.play().catch(()=>{}); watchLevels(call,peer,e.streams[0]); renderCallOverlay(); };
  pc.onconnectionstatechange=()=>{
    const st=pc.connectionState;
    if(st==='connected'){ ctx.discSince=0; ctx.restarts=[]; ctx.retried=false; call._hadConn=true; }
    if((st==='disconnected'||st==='failed')&&!ctx.discSince)ctx.discSince=Date.now();
    renderCallOverlay();
  };
  return ctx;
}
async function handleSignal(call,s){
  const peer=s.from;
  if(s.type==='bye'){ closePeer(call,peer); renderCallOverlay(); return; }
  if(s.type==='sdp'){
    const desc=typeof s.sdp==='string'?JSON.parse(s.sdp):s.sdp;
    let ctx=call.pcs[peer];
    if(!ctx){ if(desc.type!=='offer')return; ctx=ensurePeer(call,peer); ctx.suppressOffer=true; }
    let pc=ctx.pc;
    const collision=desc.type==='offer'&&(ctx.makingOffer||pc.signalingState!=='stable');
    ctx.ignoreOffer=!ctx.polite&&collision;
    if(ctx.ignoreOffer)return;
    try{ await pc.setRemoteDescription(desc); }
    catch(err){
      /* An offer from a peer that rebuilt its connection (new DTLS identity) cannot be
         applied to our old one: rebuild ours once and apply the offer there. */
      if(desc.type==='offer'&&!ctx.retried){
        ctx.retried=true; closePeer(call,peer);
        ctx=ensurePeer(call,peer); ctx.suppressOffer=true; pc=ctx.pc;
        try{ await pc.setRemoteDescription(desc); }catch(e2){ return; }
      } else return;
    }
    if(desc.type==='offer'){ try{ await pc.setLocalDescription(); await sendSignal(call,peer,{type:'sdp',sdp:pc.localDescription.toJSON()}); }catch(e){ return; } }
    const queued=ctx.candQueue.splice(0);
    for(const cand of queued){ try{ await pc.addIceCandidate(cand); }catch(e){} }
  }else if(s.type==='candidate'){
    const cand=typeof s.candidate==='string'?JSON.parse(s.candidate):s.candidate;
    const ctx=call.pcs[peer]||ensurePeer(call,peer);
    /* candidates often outrun the offer through Firestore; hold them until it lands */
    if(!ctx.pc.remoteDescription){ ctx.candQueue.push(cand); return; }
    try{ await ctx.pc.addIceCandidate(cand); }catch(e){}
  }
}
function watchLevels(call,peer,stream){
  try{ const ac=call.audioCtx||(call.audioCtx=new (window.AudioContext||window.webkitAudioContext)());
    const src=ac.createMediaStreamSource(stream); const an=ac.createAnalyser(); an.fftSize=256; src.connect(an);
    const ctx=call.pcs[peer]; if(ctx){ctx.analyser=an;ctx.levelBuf=new Uint8Array(an.frequencyBinCount);}
  }catch(e){}
}
function levelLoop(call){
  if(state.call!==call)return;
  const step=()=>{
    if(state.call!==call)return;
    Object.entries(call.pcs).forEach(([peer,ctx])=>{
      let speaking=false;
      if(ctx.analyser){ctx.analyser.getByteFrequencyData(ctx.levelBuf);let sum=0;for(const v of ctx.levelBuf)sum+=v;speaking=sum/ctx.levelBuf.length>14;}
      const tile=$(`[data-tile="${peer}"]`); if(tile)tile.classList.toggle('speaking',speaking&&ctx.pc.connectionState==='connected');
    });
    if(call.localAnalyser){call.localAnalyser.getByteFrequencyData(call.localBuf);let sum=0;for(const v of call.localBuf)sum+=v;const t=$('[data-tile="me"]');if(t)t.classList.toggle('speaking',!call.muted&&sum/call.localBuf.length>14);}
    call.levelTimer=setTimeout(step,300);
  };
  step();
}
/* Keep the screen awake for the whole call; re-request whenever we return to foreground. */
async function acquireWake(call){
  if(!('wakeLock' in navigator))return;
  try{ if(!call.wake||call.wake.released){ call.wake=await navigator.wakeLock.request('screen'); call.wake.addEventListener('release',()=>{}); } }catch(e){}
}
/* Re-announce ourselves and heal every peer link. Called on foreground return and network recovery. */
function refreshCallPresence(call){
  if(state.call!==call)return;
  const uid=state.user&&state.user.uid; if(!uid)return;
  setDoc(callPartRef(call.cid,uid),{name:(state.profile.name||'Me').slice(0,60),ping:Date.now(),muted:call.muted}).catch(()=>{});
  updateDoc(callRef(call.cid),{lastActivity:serverTimestamp()}).catch(()=>{});
  reconcilePeers(call);
  Object.entries(call.pcs).forEach(([peer,ctx])=>{
    if(ctx.pc.connectionState==='failed'){ try{ctx.pc.restartIce()}catch(e){} }
  });
  unlockCallAudio(call);
  renderCallOverlay();
}
async function joinCall(cid){
  if(state.call){ if(state.call.cid===cid){showCallOverlay();return;} toast('Leave your current call first'); return; }
  const c=state.chats.find(x=>x.id===cid); if(!c)return;
  buzz(14); sfx('join');
  let stream;
  try{ stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}); }
  catch(e){ toast(e&&e.name==='NotFoundError'?'No microphone found on this device':'Allow microphone access to join the call'); return; }
  const uid=state.user.uid;
  const call=state.call={cid,stream,parts:{},pcs:{},seenAt:{},lastPing:{},maxSigTs:0,muted:false,minimized:false,unsubs:[],pingTimer:null,levelTimer:null,audioCtx:null,localAnalyser:null,wake:null,joinedAt:Date.now(),healthTimer:null};
  renderCallBanner();
  acquireWake(call);
  try{
    const snap=await getDoc(callRef(cid));
    if(!snap.exists()||!callFresh(snap.data(),cid)) await setDoc(callRef(cid),{active:true,startedBy:uid,startedAt:serverTimestamp(),lastActivity:serverTimestamp()});
    else await updateDoc(callRef(cid),{lastActivity:serverTimestamp()}).catch(()=>{});
  }catch(e){ try{ await updateDoc(callRef(cid),{lastActivity:serverTimestamp()}); }catch(e2){} }
  try{ await setDoc(callPartRef(cid,uid),{name:(state.profile.name||'Me').slice(0,60),ping:Date.now(),muted:false}); }catch(e){ toast('Could not join the call. Check connection.'); call.stream.getTracks().forEach(t=>t.stop()); state.call=null; return; }
  try{ const ac=call.audioCtx||(call.audioCtx=new (window.AudioContext||window.webkitAudioContext)()); const src=ac.createMediaStreamSource(stream); const an=ac.createAnalyser(); an.fftSize=256; src.connect(an); call.localAnalyser=an; call.localBuf=new Uint8Array(an.frequencyBinCount); }catch(e){}
  /* keepalive: our participant doc + the call doc, fast enough to survive background timer throttling */
  call.pingTimer=setInterval(()=>{ if(state.call!==call)return; updateDoc(callPartRef(cid,uid),{ping:Date.now()}).catch(()=>{}); updateDoc(callRef(cid),{lastActivity:serverTimestamp()}).catch(()=>{}); },PING_MS);
  /* health sweep: escalate stuck peers (restart ICE, then rebuild the connection entirely) */
  call.healthTimer=setInterval(()=>{
    if(state.call!==call)return;
    const now=Date.now();
    reconcilePeers(call);
    Object.entries(call.pcs).forEach(([peer,ctx])=>{
      const st=ctx.pc.connectionState;
      if(st==='new'||st==='connecting'){ if(now-ctx.connSince>25000)rebuildPeer(call,peer); return; }
      if(st==='disconnected'||st==='failed'){
        const since=ctx.discSince||now;
        if(now-since>8000&&now-ctx.lastRestart>10000){ ctx.lastRestart=now; ctx.restarts=ctx.restarts.filter(t=>now-t<60000); ctx.restarts.push(now); try{ctx.pc.restartIce()}catch(e){} }
        if(now-since>30000||ctx.restarts.length>=3){ rebuildPeer(call,peer); }
      }
    });
    /* if our own doc vanished (swept while suspended), put it back */
    if(!call.parts||!call.parts[uid]){ setDoc(callPartRef(cid,uid),{name:(state.profile.name||'Me').slice(0,60),ping:Date.now(),muted:call.muted}).catch(()=>{}); }
    /* remove only true ghosts: participants whose ping we have watched stop moving */
    Object.entries(call.parts||{}).forEach(([id,p])=>{ if(id!==uid&&call.seenAt[id]&&now-call.seenAt[id]>PART_STALE_MS)deleteDoc(callPartRef(cid,id)).catch(()=>{}); });
    /* mobile browsers pause call audio without asking; keep nudging it back */
    Object.values(call.pcs).forEach(ctx=>{ if(ctx.audio&&ctx.audio.paused)ctx.audio.play().catch(()=>{}); });
  },5000);
  call.unsubs.push(onSnapshot(query(collection(db,'chats',cid,'callParts')),snap=>{
    if(state.call!==call)return;
    const parts={}; snap.docs.forEach(d=>parts[d.id]=d.data());
    const now=Date.now();
    Object.entries(parts).forEach(([id,p])=>{ if(call.lastPing[id]!==p.ping){ call.lastPing[id]=p.ping; call.seenAt[id]=now; } });
    Object.keys(call.lastPing).forEach(id=>{ if(!(id in parts)){ delete call.lastPing[id]; delete call.seenAt[id]; } });
    call.parts=parts;
    reconcilePeers(call);
    renderCallOverlay();
  },()=>{}));
  call.unsubs.push(onSnapshot(query(collection(db,'chats',cid,'callSignals'),where('to','==',uid)),snap=>{
    if(state.call!==call)return;
    snap.docChanges().forEach(ch=>{ if(ch.type!=='added')return; const s=ch.doc.data();
      const ts=s.ts&&typeof s.ts.toMillis==='function'?s.ts.toMillis():0;
      /* drop leftovers from an older call once a newer signal has been seen (server clock) */
      if(ts){ if(ts<call.maxSigTs-120000){ deleteDoc(ch.doc.ref).catch(()=>{}); return; } if(ts>call.maxSigTs)call.maxSigTs=ts; }
      handleSignal(call,s).catch(()=>{}); deleteDoc(ch.doc.ref).catch(()=>{});
    });
  },()=>{}));
  showCallOverlay(); updateCallBtn();
}
async function leaveCall(silent){
  const call=state.call; if(!call)return;
  state.call=null;
  call.unsubs.forEach(u=>{try{u()}catch(e){}});
  clearInterval(call.pingTimer); clearInterval(call.healthTimer); clearTimeout(call.levelTimer);
  try{call.wake&&call.wake.release().catch(()=>{})}catch(e){}
  Object.keys(call.pcs).forEach(id=>closePeer(call,id));
  try{call.stream.getTracks().forEach(t=>t.stop())}catch(e){}
  try{if(call.audioCtx)call.audioCtx.close().catch(()=>{})}catch(e){}
  const cid=call.cid, uid=state.user&&state.user.uid;
  $('#call-overlay')?.remove(); $('#call-return')?.remove();
  stopRing(); renderCallBanner(); updateCallBtn();
  if(!silent)sfx('leave');
  if(!uid)return;
  try{ await deleteDoc(callPartRef(cid,uid)); }catch(e){}
  /* DM call log: the last one out posts the summary (or the missed-call note). */
  if(!silent){
    try{
      const chat=state.chats.find(x=>x.id===cid);
      if(chat&&chat.type==='dm'&&!callPartsFresh(call).length){
        const dur=Math.round((Date.now()-call.joinedAt)/1000);
        if(call._hadConn||dur>=20){
          const payload={type:'call',text:call._hadConn?'Voice call':'Missed call',dur:call._hadConn?dur:null,sender:uid,createdAt:serverTimestamp(),reads:{[uid]:true}};
          await addDoc(collection(db,'chats',cid,'messages'),payload);
          const updates={updatedAt:serverTimestamp(),lastMsg:{type:'call',text:payload.text,dur:payload.dur,sender:uid,at:Date.now()}};
          (chat.members||[]).forEach(m2=>{if(m2!==uid)updates[`unread.${m2}`]=increment(1);});
          await updateDoc(doc(db,'chats',cid),updates);
        }
      }
    }catch(e){}
  }
  try{ const others=callPartsFresh(call); await Promise.all(others.map(([id])=>addDoc(collection(db,'chats',cid,'callSignals'),{from:uid,to:id,type:'bye',sdp:'',candidate:'',ts:serverTimestamp()}))); }catch(e){}
  try{ const snap=await getDoc(callRef(cid)); if(snap.exists()&&snap.data().startedBy===uid&&!callPartsFresh(call).length) await deleteDoc(callRef(cid)); }catch(e){}
  if(!silent)buzz(16);
}
const fmtDur=(ms)=>{const s=Math.floor(ms/1000);const m=Math.floor(s/60);const h=Math.floor(m/60);if(h>0)return h+':'+String(m%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');return m+':'+String(s%60).padStart(2,'0');};
function showCallOverlay(){
  const call=state.call; if(!call)return;
  call.minimized=false; $('#call-return')?.remove();
  if(!$('#call-overlay')){
    const ov=el(`<div class="call-overlay" id="call-overlay"><div class="call-card">
      <div class="call-top"><div style="min-width:0;flex:1"><div class="call-title" id="call-title"></div><div class="call-sub" id="call-sub"></div></div>
      <button class="icon-btn press" id="call-min" aria-label="Minimize call">${I.chevL}</button></div>
      <div class="call-grid" id="call-grid"></div>
      <div id="call-audios" style="display:none"></div>
      <div class="call-actions">
        <button class="call-act press" id="call-mute" aria-label="Mute"></button>
        <button class="call-act end press" id="call-end" aria-label="Leave call">${I.phoneOff}</button>
      </div></div></div>`);
    document.body.append(ov);
    $('#call-min',ov).onclick=()=>{buzz(8);minimizeCall();};
    $('#call-mute',ov).onclick=()=>{buzz(10);toggleMute();};
    $('#call-end',ov).onclick=()=>{buzz(10);leaveCall();};
    /* any tap in the call is a user gesture: use it to unpause audio mobile browsers blocked */
    ov.addEventListener('pointerdown',()=>unlockCallAudio(call));
  }
  unlockCallAudio(call);
  levelLoop(call);
  renderCallOverlay();
}
function renderCallOverlay(){
  const call=state.call; if(!call)return;
  const c=state.chats.find(x=>x.id===call.cid);
  const name=c?chatDisplay(c).name:'Voice call';
  const fresh=callPartsFresh(call);
  const n=fresh.length+1;
  const title=$('#call-title'), sub=$('#call-sub');
  if(title&&title.textContent!==name)title.textContent=name;
  const connStates=Object.values(call.pcs||{}).map(ctx=>ctx.pc.connectionState);
  const reconnecting=connStates.some(s=>['disconnected','failed','new','connecting'].includes(s));
  const subTxt=n>1?(reconnecting?'Reconnecting…':fmtDur(Date.now()-call.joinedAt)+' · '+n+' in call'):'Waiting for others…';
  if(sub){ if(sub.textContent!==subTxt)sub.textContent=subTxt; sub.classList.toggle('warn',!!reconnecting&&n>1); }
  clearTimeout(call._durT); if(n>1&&!call.minimized)call._durT=setTimeout(()=>renderCallOverlay(),1000);
  const ret=$('#call-return');
  if(ret){ const t=`${I.phone} ${esc(name)} · ${n>1?fmtDur(Date.now()-call.joinedAt):'calling'} <span>Tap to return</span>`; if(ret._html!==t){ret._html=t;ret.innerHTML=t;} }
  const grid=$('#call-grid'); if(!grid)return;
  /* Rebuild tiles only when the visible state actually changes. Rewriting the grid on
     every render replayed the mount animation and read as constant blinking in calls. */
  const sig=JSON.stringify([call.muted,state.profile.name||'Me',fresh.map(([id,p])=>{const ctx=call.pcs[id];return [id,p.name||'Member',!!p.muted,ctx?ctx.pc.connectionState:'new'];})]);
  if(sig===call._sig)return;
  call._sig=sig;
  const tile=(id,nm,me,muted,conn)=>{const photo=me?state.profile.photo:(state.profiles[id]?.photo||null);return `<div class="call-tile" data-tile="${me?'me':id}">
    <div class="call-av" style="${photo?'':`background:${gradFor(me?state.user.uid:id)}`}">${photo?`<img src="${photo}" alt="">`:initials(nm)}</div>
    <div class="call-nm">${esc(nm)}${me?' (you)':''}</div>
    <div class="call-conn">${conn?`<span class="re">${conn}</span>`:''}</div>
    <div class="call-micstate">${muted?I.micOff:''}</div></div>`;};
  grid.innerHTML=tile(null,state.profile.name||'Me',true,call.muted,'')+fresh.map(([id,p])=>{
    const ctx=call.pcs[id];
    const st=ctx?ctx.pc.connectionState:'new';
    const conn=['connected','closed'].includes(st)?'':(st==='disconnected'||st==='failed'?'reconnecting':'connecting');
    return tile(id,p.name||'Member',false,p.muted,conn);
  }).join('');
  const mb=$('#call-mute'); if(mb){mb.innerHTML=call.muted?I.micOff:I.mic;mb.classList.toggle('off',call.muted);}
}
function minimizeCall(){
  const call=state.call; if(!call)return;
  call.minimized=true; $('#call-overlay')?.remove();
  if(!$('#call-return')){ const b=el(`<button id="call-return"></button>`); document.body.append(b);
    b.onclick=()=>{buzz(8);showCallOverlay();}; }
  renderCallOverlay();
}
function toggleMute(){
  const call=state.call; if(!call)return;
  call.muted=!call.muted;
  call.stream.getAudioTracks().forEach(t=>t.enabled=!call.muted);
  updateDoc(callPartRef(call.cid,state.user.uid),{muted:call.muted}).catch(()=>{});
  renderCallOverlay();
}
window.addEventListener('pagehide',()=>{ if(state.call){ try{deleteDoc(callPartRef(state.call.cid,state.user.uid))}catch(e){} } });
/* back/forward-cache restore: put our participant doc back and heal the links */
window.addEventListener('pageshow',e=>{ if(e.persisted&&state.call)refreshCallPresence(state.call); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&state.call){ acquireWake(state.call); refreshCallPresence(state.call); } });
window.addEventListener('online',()=>{ if(state.call)refreshCallPresence(state.call); });

/* A deployed update cannot replace JavaScript already running in an open tab. */
const CLIENT_VERSION='20261109-contrast1';
let lastUpdateCheck=0;
async function checkAppUpdate(){
 if(document.hidden||!navigator.onLine||Date.now()-lastUpdateCheck<60000)return;lastUpdateCheck=Date.now();
 try{const r=await fetch('/version.json',{cache:'no-store'});if(!r.ok)return;const v=await r.json();if(v.version===CLIENT_VERSION||document.querySelector('#app-update'))return;
 const n=el('<div id="app-update" role="status"><span>A Flami update is ready. Finish your message or game, then reload.</span><button>Reload</button><button aria-label="Dismiss update">×</button></div>');document.body.append(n);$('button',n).onclick=()=>{if(confirm('Reload Flami? Any unsent message or open game will need to be reopened.'))location.reload();};$$('button',n)[1].onclick=()=>n.remove();
 }catch(e){}
}
setInterval(checkAppUpdate,300000);document.addEventListener('visibilitychange',checkAppUpdate);window.addEventListener('online',checkAppUpdate);checkAppUpdate();
