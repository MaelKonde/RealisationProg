/* ══════════════════════════════════════════════════════════════════════
   LOGIQUE APPLICATIVE — Veille Scientifique
   ══════════════════════════════════════════════════════════════════════
   Dépend de : config.js (APP_CONFIG) et data.js (DEMO_DATA, PAYS_LABELS,
   MONTHS_FILES, STOPWORDS). Ces deux fichiers doivent être chargés AVANT
   celui-ci dans index.html.
   ══════════════════════════════════════════════════════════════════════ */

/* ══ État global ══════════════════════════════════════════════════════ */
let RESULTS       = [];   // articles affichés actuellement
let ALL_LOCAL     = [];   // tous les articles chargés depuis les JSON locaux
let LAST_QUERY    = '';
let CURRENT_MODE  = 'local';  // 'local' | 'api'
let SELECTED_MONTHS = new Set();

/* ══ Particules canvas ════════════════════════════════════════════════ */
(function() {
  const canvas = document.getElementById('starCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let P = [], W, H;
  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    P = Array.from({length:38}, () => ({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.4+.3,
      vx:(Math.random()-.5)*.15, vy:(Math.random()-.5)*.1,
      alpha:Math.random()*.3+.1, phase:Math.random()*Math.PI*2,
      speed:Math.random()*.015+.005
    }));
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    P.forEach(s => {
      s.phase+=s.speed; s.x+=s.vx; s.y+=s.vy;
      if(s.x<0)s.x=W; if(s.x>W)s.x=0; if(s.y<0)s.y=H; if(s.y>H)s.y=0;
      const a = s.alpha*(.6+.4*Math.sin(s.phase));
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(180,140,60,${a})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize',resize); resize(); draw();
})();

window.addEventListener('scroll', () => {
  document.getElementById('header').classList.toggle('scrolled', window.scrollY > 10);
}, {passive:true});

/* ══ Révélation scroll ════════════════════════════════════════════════ */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((e,i) => {
    if (e.isIntersecting) {
      e.target.style.animationDelay = (i*55)+'ms';
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, {threshold:0.07});
function observeCards() {
  document.querySelectorAll('.article-card:not(.visible),.stat-card:not(.visible)')
    .forEach(el => revealObs.observe(el));
}

/* ══ Compteurs animés ═════════════════════════════════════════════════ */
function animateCount(el, target, dur=700) {
  const start = performance.now();
  function step(now) {
    const p = Math.min((now-start)/dur,1);
    const v = Math.round(target*(1-Math.pow(1-p,3)));
    el.textContent = v.toLocaleString('fr-FR');
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ══ Toast ════════════════════════════════════════════════════════════ */
function showToast(msg, dur=2800) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), dur);
}

/* ══════════════════════════════════════════════════════════════════════
   MODE SELECTOR (Local JSON ↔ API Semantic Scholar)
   ══════════════════════════════════════════════════════════════════════ */
function setMode(mode) {
  CURRENT_MODE = mode;
  document.getElementById('btnModeLocal').classList.toggle('active', mode==='local');
  document.getElementById('btnModeApi').classList.toggle('active', mode==='api');
  document.getElementById('localModeArea').classList.toggle('active', mode==='local');
  document.getElementById('apiModeArea').classList.toggle('active', mode==='api');
  document.getElementById('searchInput').placeholder =
    mode === 'local'
      ? 'Mots-clés dans les titres (ex: quantum, neural, climate…)'
      : 'Ex : CRISPR, quantum computing, climate…';
  document.getElementById('sourceTag').textContent =
    mode === 'local' ? 'OpenAlex · arXiv · JSON local' : 'Semantic Scholar API';
}

/* ══════════════════════════════════════════════════════════════════════
   SÉLECTEUR DE MOIS (mode local)
   ══════════════════════════════════════════════════════════════════════ */
function initMonthPills() {
  const container = document.getElementById('monthPills');
  MONTHS_FILES.forEach(([name, label]) => {
    const btn = document.createElement('button');
    btn.className = 'month-pill';
    btn.textContent = label;
    btn.dataset.name = name;
    btn.onclick = () => toggleMonth(name, btn);
    container.appendChild(btn);
  });
  // Démo : charger les données demo au départ
  updateTotalBadge();
}

function toggleMonth(name, btn) {
  if (SELECTED_MONTHS.has(name)) {
    SELECTED_MONTHS.delete(name);
    btn.classList.remove('selected');
  } else {
    SELECTED_MONTHS.add(name);
    btn.classList.add('selected');
  }
}

/* ══════════════════════════════════════════════════════════════════════
   CHARGEMENT DES ARTICLES — source pilotée par APP_CONFIG (config.js)
   ══════════════════════════════════════════════════════════════════════
   Un seul point de bascule : APP_CONFIG.DATA_SOURCE dans config.js.

   - DATA_SOURCE = 'json'    → lit les fichiers arxiv_<mois>.json en local
                               (comportement actuel, nécessite un serveur
                               HTTP local, ex: python3 -m http.server)
   - DATA_SOURCE = 'backend' → interroge l'API Flask + SQLite via
                               APP_CONFIG.BACKEND_API_URL. À activer dès
                               que la base de données sera disponible :
                               il suffira de changer DATA_SOURCE dans
                               config.js, aucune autre modification n'est
                               nécessaire dans ce fichier.

   Dans les deux cas, chaque article est normalisé vers le format interne
   via normalizeLocal() ci-dessous, à partir de la structure suivante :
   {
     "titre": "...",
     "id de l'article": "https://openalex.org/...",
     "date": "2025-02-28",
     "auteurs": [{"nom":"...", "pays":["FR","US"]}],
     "language": "en",
     "Nombre de citations": 5,
     "index_inverse_compte": {"mot": 3, ...}
   }
   ══════════════════════════════════════════════════════════════════════ */
async function fetchMonthData(name) {
  if (APP_CONFIG.DATA_SOURCE === 'backend') {
    // 🔌 BRANCHEMENT BDD : adapter l'URL/les paramètres à l'API réelle
    // exposée par le back-end Flask (ex: GET /api/articles?mois=fevrier2026)
    const r = await fetch(`${APP_CONFIG.BACKEND_API_URL}/articles?mois=${name}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  // Mode JSON local (par défaut)
  const r = await fetch(`arxiv_${name}.json`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function loadArticles() {
  // Si aucun mois sélectionné, tous les mois sont interrogés
  const toLoad = SELECTED_MONTHS.size > 0
    ? SELECTED_MONTHS
    : new Set(MONTHS_FILES.map(([name]) => name));
  ALL_LOCAL = [];
  const prog = document.getElementById('loadProgress');
  const sourceLabel = APP_CONFIG.DATA_SOURCE === 'backend' ? 'la base de données' : `arxiv_<mois>.json`;
  for (const name of toLoad) {
    prog.textContent = `Chargement depuis ${sourceLabel} (${name})…`;
    try {
      const data = await fetchMonthData(name);
      // Normalisation vers le format interne
      data.forEach(a => ALL_LOCAL.push(normalizeLocal(a)));
      prog.textContent = `✓ ${name} chargé (${data.length} articles)`;
    } catch(e) {
      prog.textContent = `⚠ Source de données non accessible (${name}) — mode démo activé`;
      // Fallback : données de démonstration si la source n'est pas accessible
      ALL_LOCAL.push(...DEMO_DATA);
      showToast('📂 Source de données indisponible — données démo utilisées');
      break;
    }
  }
  prog.textContent = `✓ ${ALL_LOCAL.length.toLocaleString('fr-FR')} articles chargés`;
  return ALL_LOCAL;
}

/* ══════════════════════════════════════════════════════════════════════
   Normalisation des données
   Adapte les champs reçus (JSON local ou futur back-end) vers le format
   interne du front-end. Cette fonction reste identique quelle que soit
   la source, tant que le back-end respecte la même structure de champs.
   ══════════════════════════════════════════════════════════════════════ */
function normalizeLocal(a) {
  const kw_raw = a['index_inverse_compte'] || a.index_inverse_compte || {};
  const kw_filtered = Object.entries(kw_raw)
    .filter(([w]) => !STOPWORDS.has(w) && w.length > 3)
    .sort((a,b) => b[1]-a[1])
    .slice(0,10)
    .map(([w]) => w);

  const auteurs = (a['auteurs'] || a.auteurs || []).map(au => ({
    nom: au['nom'] || au.nom || '?',
    pays: au['pays'] || au.pays || []
  }));

  return {
    titre:      a['titre']          || a.titre || 'Sans titre',
    id:         a["id de l'article"] || a.id   || '',
    date:       a['date']            || a.date  || '',
    auteurs,
    langue:     a['language']       || a.langue || 'en',
    citations:  a['Nombre de citations'] || a.citations || 0,
    mots_cles:  kw_filtered,
    pays:       [...new Set(auteurs.flatMap(au => au.pays).filter(Boolean))],
  };
}

function updateTotalBadge() {
  const total = DEMO_DATA.length;
  document.getElementById('totalBadge').textContent = `${total} articles (démo)`;
}

/* ══════════════════════════════════════════════════════════════════════
   API SEMANTIC SCHOLAR (mode api)
   🔌 Remplacé à terme par requête vers votre back-end Python + SQLite
   ══════════════════════════════════════════════════════════════════════ */
const SS_BASE   = 'https://api.semanticscholar.org/graph/v1';
const SS_FIELDS = 'title,authors,year,venue,citationCount,openAccessPdf,abstract,fieldsOfStudy,externalIds,url';

async function fetchSS(query, {limit=20,yearFrom='',field=''}={}) {
  let url = `${SS_BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${SS_FIELDS}`;
  if (yearFrom) url += `&year=${yearFrom}-`;
  if (field)    url += `&fieldsOfStudy=${encodeURIComponent(field)}`;
  const r = await fetch(url, {headers:{Accept:'application/json'}});
  if (!r.ok) throw new Error(`Semantic Scholar ${r.status}`);
  const d = await r.json();
  // Normaliser vers format interne
  return (d.data||[]).map(p => ({
    titre:     p.title || 'Sans titre',
    id:        p.url   || '',
    date:      p.year  ? `${p.year}-01-01` : '',
    auteurs:   (p.authors||[]).map(a=>({nom:a.name, pays:[]})),
    langue:    'en',
    citations: p.citationCount || 0,
    mots_cles: p.fieldsOfStudy || [],
    pays:      [],
    abstract:  p.abstract || '',
    venue:     p.venue || '',
    openAccess:!!p.openAccessPdf,
  }));
}

/* ══ Recherche principale ═════════════════════════════════════════════ */
async function doSearch() {
  const query = document.getElementById('searchInput').value.trim();
  LAST_QUERY = query;
  setLoading(true);
  showState('loading');

  try {
    let raw = [];
    if (CURRENT_MODE === 'local') {
      // Mode local : charger JSON puis filtrer côté JS
      const loaded = await loadArticles();
      if (!loaded) { setLoading(false); showState('initial'); return; }
      raw = searchLocal(loaded, query);
    } else {
      // Mode API Semantic Scholar
      if (!query) { showToast('⚠ Saisis un mot-clé'); setLoading(false); showState('initial'); return; }
      const yearFrom = document.getElementById('fYear').value || '';
      const field    = document.getElementById('fField').value || '';
      const limit    = parseInt(document.getElementById('fLimit').value) || 20;
      raw = await fetchSS(query, {limit, yearFrom, field});
    }

    // Filtres communs
    const fPays = document.getElementById('fPays').value;
    const fLang = document.getElementById('fLang').value;
    let filtered = raw.filter(a => {
      if (fPays && !a.pays.includes(fPays)) return false;
      if (fLang && a.langue !== fLang) return false;
      return true;
    });

    // Tri
    const sort = document.getElementById('fSort').value;
    if (sort==='citations') filtered.sort((a,b) => (b.citations||0)-(a.citations||0));
    else if (sort==='date') filtered.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    else if (sort==='alpha') filtered.sort((a,b) => a.titre.localeCompare(b.titre));

    // Limite affichage
    const limit = parseInt(document.getElementById('fLimit').value) || 20;
    RESULTS = filtered.slice(0, limit);

    if (!RESULTS.length) { showState('empty'); setLoading(false); return; }

    document.getElementById('results-zone').style.display = 'none';
    document.getElementById('tabs-section').style.display = 'block';
    document.getElementById('statStrip').style.display    = 'grid';

    renderStatStrip(filtered);
    resetTabs();
    renderArticles();
    document.getElementById('totalBadge').textContent =
      `${filtered.length.toLocaleString('fr-FR')} articles`;
    showToast(`✓ ${RESULTS.length} article${RESULTS.length>1?'s':''} affichés sur ${filtered.length} trouvés`);
  } catch(err) {
    showState('error', err.message);
  }
  setLoading(false);
}

/* ══ Recherche locale (filtrage JS sur les JSON) ══════════════════════ */
function searchLocal(articles, query) {
  if (!query) return articles;
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/).filter(Boolean);
  return articles.filter(a => {
    const titre = a.titre.toLowerCase();
    const kw    = a.mots_cles.join(' ').toLowerCase();
    const auteurs = a.auteurs.map(au=>au.nom).join(' ').toLowerCase();
    return terms.every(t => titre.includes(t) || kw.includes(t) || auteurs.includes(t));
  });
}

function setLoading(on) {
  const btn = document.getElementById('btnSearch');
  const inp = document.getElementById('searchInput');
  btn.disabled = inp.disabled = on;
  btn.textContent = on ? '…' : 'Rechercher →';
}

function showState(type, msg='') {
  document.getElementById('results-zone').style.display = 'block';
  document.getElementById('tabs-section').style.display = 'none';
  document.getElementById('statStrip').style.display    = 'none';
  const z = document.getElementById('results-zone');
  const msgs = {
    loading: `<div class="state-box"><div class="spinner"></div><p>Chargement et analyse des données…</p></div>`,
    empty:   `<div class="state-box"><div class="state-icon">🔎</div><p>Aucun résultat pour <strong>"${LAST_QUERY}"</strong>.<br>Essaie d'autres mots-clés ou sélectionne d'autres mois.</p></div>`,
    error:   `<div class="state-box error"><div class="state-icon">⚠️</div><p>Erreur : ${msg}</p></div>`,
    initial: `<div class="state-box"><div class="state-icon">🔭</div><p>Sélectionne un ou plusieurs mois et lance une recherche pour explorer la base arXiv.</p></div>`,
  };
  z.innerHTML = msgs[type] || msgs.initial;
}

function resetTabs() {
  document.querySelectorAll('.tab-btn').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('.tab-btn').classList.add('active');
  document.getElementById('panel-articles').classList.add('active');
}

/* ══ Stat strip ════════════════════════════════════════════════════════ */
function renderStatStrip(all) {
  const totalCit  = all.reduce((s,a)=>s+(a.citations||0),0);
  const uniqAuth  = new Set(all.flatMap(a=>a.auteurs.map(au=>au.nom))).size;
  const uniqPays  = new Set(all.flatMap(a=>a.pays)).size;
  const maxCit    = Math.max(...all.map(a=>a.citations||0));

  document.getElementById('statStrip').innerHTML = `
    <div class="stat-card"><div class="stat-label">Articles trouvés</div><div class="stat-val g" id="sc-tot">0</div></div>
    <div class="stat-card"><div class="stat-label">Citations totales</div><div class="stat-val" id="sc-cit">0</div></div>
    <div class="stat-card"><div class="stat-label">Max citations</div><div class="stat-val" id="sc-max">0</div><div class="stat-note">article le plus cité</div></div>
    <div class="stat-card"><div class="stat-label">Auteurs uniques</div><div class="stat-val" id="sc-au">0</div></div>
    <div class="stat-card"><div class="stat-label">Pays représentés</div><div class="stat-val" id="sc-pays">0</div></div>
  `;
  setTimeout(() => {
    document.querySelectorAll('.stat-card').forEach(el => {
      el.style.animation='none'; el.offsetHeight; el.style.animation='';
      el.classList.add('visible');
    });
    animateCount(document.getElementById('sc-tot'),  all.length);
    animateCount(document.getElementById('sc-cit'),  totalCit);
    animateCount(document.getElementById('sc-max'),  maxCit);
    animateCount(document.getElementById('sc-au'),   uniqAuth);
    animateCount(document.getElementById('sc-pays'), uniqPays);
  }, 80);
}

/* ══ Rendu articles ════════════════════════════════════════════════════ */
function renderArticles() {
  const label = LAST_QUERY
    ? `${RESULTS.length} article${RESULTS.length>1?'s':''} · "${LAST_QUERY}"`
    : `${RESULTS.length} article${RESULTS.length>1?'s':''}`;
  document.getElementById('countLine').textContent = label;

  document.getElementById('articleList').innerHTML = RESULTS.map((a, i) => {
    const link = a.id.startsWith('https://openalex.org/')
      ? `https://arxiv.org/search/?searchtype=all&query=${encodeURIComponent(a.titre.slice(0,60))}`
      : a.id || '#';
    const auteurs = a.auteurs.slice(0,5).map(au=>`<strong>${au.nom}</strong>`).join(', ')
                  + (a.auteurs.length>5 ? ` <em style="color:var(--text-3)">+${a.auteurs.length-5}</em>` : '');
    const paysUniq = [...new Set(a.pays)].slice(0,4).map(p =>
      `<span class="meta-pill pays">${PAYS_LABELS[p]||p}</span>`).join('');
    const dateLabel = a.date ? a.date.slice(0,7) : '—';
    const abs = a.abstract || '';

    return `<div class="article-card">
      <div class="card-top">
        <div class="article-title"><a href="${link}" target="_blank" rel="noopener">${a.titre}</a></div>
        ${a.openAccess ? '<span class="meta-pill" style="flex-shrink:0;background:rgba(42,107,107,.07);color:var(--teal);border-color:rgba(42,107,107,.2);">Open Access</span>' : ''}
      </div>
      <div class="article-authors">${auteurs || '<em style="color:var(--text-3)">Auteurs non renseignés</em>'}</div>
      <div class="meta-row">
        <span class="meta-pill date">📅 ${dateLabel}</span>
        ${a.citations > 0 ? `<span class="meta-pill cit">⭐ ${a.citations} citations</span>` : ''}
        ${a.langue && a.langue !== 'en' ? `<span class="meta-pill lang">🌐 ${a.langue}</span>` : ''}
        ${paysUniq}
        ${a.venue ? `<span class="meta-pill">📖 ${a.venue.slice(0,40)}</span>` : ''}
      </div>
      ${abs ? `<div class="abstract-text" id="abs-${i}">${abs}</div>
               <button class="toggle-abs" onclick="toggleAbs(${i},this)">▸ Résumé complet</button>` : ''}
      ${a.mots_cles.length ? `<div class="kw-row">${a.mots_cles.map(kw=>`<span class="kw-tag" onclick="applyKw('${kw}')">${kw}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
  setTimeout(observeCards, 50);
}

function toggleAbs(i, btn) {
  const el = document.getElementById('abs-'+i);
  const open = el.classList.toggle('open');
  btn.textContent = open ? '▾ Réduire' : '▸ Résumé complet';
}
function applyKw(kw) {
  document.getElementById('searchInput').value = kw;
  doSearch();
}

/* ══ Export CSV ════════════════════════════════════════════════════════ */
function exportCSV() {
  const h = ['Titre','Date','Auteurs','Pays','Citations','Langue','Mots-clés','ID OpenAlex'];
  const rows = RESULTS.map(a => [
    `"${a.titre.replace(/"/g,'""')}"`,
    a.date || '',
    `"${a.auteurs.map(au=>au.nom).join(';')}"`,
    `"${a.pays.join(';')}"`,
    a.citations || 0,
    a.langue || '',
    `"${a.mots_cles.join(';')}"`,
    a.id || '',
  ]);
  const csv = [h,...rows].map(r=>r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const el   = document.createElement('a');
  el.href=url; el.download=`arxiv_${LAST_QUERY.replace(/\s+/g,'_')||'export'}.csv`; el.click();
  URL.revokeObjectURL(url);
  showToast('✓ Export CSV téléchargé');
}

/* ══ Statistiques ══════════════════════════════════════════════════════ */
function makeBars(data, maxVal, color) {
  return data.map(([label,v]) => `
    <div class="bar-row">
      <span class="bar-label" title="${label}">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="background:${color}" data-w="${Math.round(v/maxVal*100)}"></div></div>
      <span class="bar-count">${v>999?v.toLocaleString():v}</span>
    </div>`).join('');
}
function animateBars() {
  document.querySelectorAll('.bar-fill').forEach(el => {
    const w = el.dataset.w;
    requestAnimationFrame(()=>{ el.style.width = w+'%'; });
  });
}
function noData() { return '<p style="font-size:13px;color:var(--text-3);padding:.5rem 0;">Données insuffisantes.</p>'; }

function renderStats() {
  // Par mois
  const mMap={};
  RESULTS.forEach(a=>{ const m=(a.date||'').slice(0,7)||'?'; mMap[m]=(mMap[m]||0)+1; });
  const months=Object.entries(mMap).sort((a,b)=>b[0].localeCompare(a[0]));
  document.getElementById('barMonths').innerHTML =
    months.length ? makeBars(months,Math.max(...months.map(m=>m[1])),'var(--teal)') : noData();

  // Citations top 10
  const topCit=[...RESULTS].filter(a=>a.citations>0)
    .sort((a,b)=>b.citations-a.citations).slice(0,10)
    .map(a=>[a.titre.slice(0,48)+'…',a.citations]);
  document.getElementById('barCitations').innerHTML =
    topCit.length ? makeBars(topCit,topCit[0][1],'var(--gold)') : noData();

  // Langues
  const lMap={};
  RESULTS.forEach(a=>{ const l=a.langue||'?'; lMap[l]=(lMap[l]||0)+1; });
  const langs=Object.entries(lMap).sort((a,b)=>b[1]-a[1]);
  document.getElementById('barLangs').innerHTML =
    langs.length ? makeBars(langs,langs[0][1],'var(--rust)') : noData();

  // Nuage depuis index_inverse_compte (mots-clés réels)
  const wfreq={};
  RESULTS.forEach(a=>a.mots_cles.forEach(w=>{ wfreq[w]=(wfreq[w]||0)+1; }));
  const sw=Object.entries(wfreq).sort((a,b)=>b[1]-a[1]).slice(0,50);
  const maxF=sw[0]?.[1]||1;
  document.getElementById('cloud').innerHTML=sw.map(([w,f])=>{
    const size=11+Math.round((f/maxF)*18);
    const op=(.4+(f/maxF)*.6).toFixed(2);
    return `<span class="cloud-word" style="font-size:${size}px;opacity:${op}" onclick="applyKw('${w}')">${w}</span>`;
  }).join('');

  setTimeout(animateBars,80);
}

/* ══ Auteurs ═══════════════════════════════════════════════════════════ */
function renderAuteurs() {
  const map={};
  RESULTS.forEach(a=>{
    a.auteurs.forEach(au=>{
      if(!au.nom||au.nom==='?') return;
      const k=au.nom;
      if(!map[k]) map[k]={nom:k,count:0,cit:0,pays:new Set()};
      map[k].count++;
      map[k].cit+=a.citations||0;
      (au.pays||[]).forEach(p=>map[k].pays.add(p));
    });
  });
  const list=Object.values(map).sort((a,b)=>b.cit-a.cit||b.count-a.count);
  if(!list.length){
    document.getElementById('auteurList').innerHTML='<p style="color:var(--text-3);font-size:14px;padding:2rem 0;">Aucun auteur identifié.</p>';
    return;
  }
  document.getElementById('auteurList').innerHTML=list.slice(0,60).map(a=>{
    const init=a.nom.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    const paysStr=[...a.pays].map(p=>PAYS_LABELS[p]||p).join(', ');
    return `<div class="author-card">
      <div class="avatar">${init}</div>
      <div>
        <div class="author-name">${a.nom}</div>
        <div class="author-sub">${a.count} article${a.count>1?'s':''} dans les résultats${paysStr?` · ${paysStr}`:''}</div>
      </div>
      <div class="author-right">
        <div class="author-cit">${a.cit>0?'⭐ '+a.cit+' cit.':''}</div>
      </div>
    </div>`;
  }).join('');
}

/* ══ Pays ══════════════════════════════════════════════════════════════ */
const FLAG = {'FR':'🇫🇷','US':'🇺🇸','CN':'🇨🇳','DE':'🇩🇪','GB':'🇬🇧','IT':'🇮🇹',
  'JP':'🇯🇵','ES':'🇪🇸','CH':'🇨🇭','IN':'🇮🇳','CA':'🇨🇦','AU':'🇦🇺','NL':'🇳🇱',
  'KR':'🇰🇷','SE':'🇸🇪','BR':'🇧🇷','RU':'🇷🇺','PL':'🇵🇱','BE':'🇧🇪','AT':'🇦🇹',
  'DK':'🇩🇰','FI':'🇫🇮','NO':'🇳🇴','PT':'🇵🇹','CZ':'🇨🇿','IE':'🇮🇪','IL':'🇮🇱',
  'SG':'🇸🇬','TW':'🇹🇼','HK':'🇭🇰','MX':'🇲🇽','AR':'🇦🇷','ZA':'🇿🇦','TR':'🇹🇷'};

function renderPays() {
  const pMap={};
  RESULTS.forEach(a=>a.pays.forEach(p=>{ if(p) pMap[p]=(pMap[p]||0)+1; }));
  const sorted=Object.entries(pMap).sort((a,b)=>b[1]-a[1]);
  const max=sorted[0]?.[1]||1;

  document.getElementById('barPaysMain').innerHTML =
    sorted.length ? makeBars(sorted.slice(0,15).map(([c,n])=>[PAYS_LABELS[c]||c,n]),max,'var(--rust)') : noData();

  document.getElementById('paysGrid').innerHTML = sorted.slice(0,30).map(([c,n])=>`
    <div class="pays-card">
      <span class="pays-flag">${FLAG[c]||'🌐'}</span>
      <div>
        <div class="pays-name">${PAYS_LABELS[c]||c}</div>
        <div class="pays-count">${n} contribution${n>1?'s':''}</div>
      </div>
    </div>`).join('');

  setTimeout(animateBars,80);
}

/* ══ Tabs ══════════════════════════════════════════════════════════════ */
function switchTab(name, el) {
  document.querySelectorAll('.tab-btn').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
  if(name==='stats')   renderStats();
  if(name==='auteurs') renderAuteurs();
  if(name==='pays')    renderPays();
}

/* ══ Init ══════════════════════════════════════════════════════════════ */
initMonthPills();
