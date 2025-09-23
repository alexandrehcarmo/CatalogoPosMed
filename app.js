// Globals para os dados processados (preenchidos após loadEntries)
let DATA_ENTRIES = [];
let DATA_UFS = [];
let fuse = null;

// Expor também no objeto global window — evita ReferenceError no console
try {
  window.DATA_ENTRIES = DATA_ENTRIES;
  window.DATA_UFS = DATA_UFS;
  window.fuse = fuse;
} catch(e) {/* ambiente sem window? ignora */}


async function loadEntries(){
  try{
    const resp = await fetch('data.json');
    if(!resp.ok) throw new Error('Failed to load data.json: '+resp.status);
    ENTRIES = await resp.json();
    console.log('loadEntries: ENTRIES carregado, length=', (ENTRIES||[]).length);
    try {
      // processa e expõe DATA_ENTRIES/fuse
      processEntriesAndInit();
    } catch(e){
      console.error('processEntriesAndInit erro', e);
    }
    try {
      window.DATA_ENTRIES = DATA_ENTRIES;
      window.DATA_UFS = DATA_UFS;
      window.fuse = fuse;
    } catch(e){ /* ignore */ }
    console.log('loadEntries: window.DATA_ENTRIES set?', !!window.DATA_ENTRIES, 'fuse?', !!window.fuse);
  }catch(err){
    console.error('Error loading data.json', err);
    ENTRIES = [];
  }
}

/* ---------- processEntriesAndInit: recomputar DATA_ENTRIES, DATA_UFS e rebuild fuse (com normalizações completas) ---------- */

const UFS = [
  {
    "uf": "AC",
    "count": 30
  },
  {
    "uf": "AL",
    "count": 157
  },
  {
    "uf": "AM",
    "count": 96
  },
  {
    "uf": "AP",
    "count": 23
  },
  {
    "uf": "BA",
    "count": 297
  },
  {
    "uf": "CE",
    "count": 293
  },
  {
    "uf": "DF",
    "count": 336
  },
  {
    "uf": "ES",
    "count": 271
  },
  {
    "uf": "GO",
    "count": 392
  },
  {
    "uf": "MA",
    "count": 88
  },
  {
    "uf": "MG",
    "count": 1378
  },
  {
    "uf": "MS",
    "count": 130
  },
  {
    "uf": "MT",
    "count": 71
  },
  {
    "uf": "PA",
    "count": 183
  },
  {
    "uf": "PB",
    "count": 223
  },
  {
    "uf": "PE",
    "count": 355
  },
  {
    "uf": "PI",
    "count": 99
  },
  {
    "uf": "PR",
    "count": 883
  },
  {
    "uf": "RJ",
    "count": 765
  },
  {
    "uf": "RN",
    "count": 147
  },
  {
    "uf": "RO",
    "count": 161
  },
  {
    "uf": "RR",
    "count": 129
  },
  {
    "uf": "RS",
    "count": 683
  },
  {
    "uf": "SC",
    "count": 231
  },
  {
    "uf": "SE",
    "count": 126
  },
  {
    "uf": "SP",
    "count": 1644
  },
  {
    "uf": "TO",
    "count": 60
  }
];

/* ---------- Inicio: carregamento externo de NAO_ENTRAM_CATALOGO.csv ---------- */
/* Carrega CSV simples (uma coluna) e devolve Set de termos (em MAIÚSCULAS) */
async function loadBlacklistCSV(filename='NAO_ENTRAM_CATALOGO.csv'){
  try {

    // adiciona parâmetro de cache-busting para forçar re-fetch (evita versão CDN obsoleta)
    const bust = 'v=' + encodeURIComponent(new Date().toISOString());
    const url = filename + (filename.indexOf('?') === -1 ? '?' + bust : '&' + bust);
    const resp = await fetch(url, { cache: 'no-cache' });

    if(!resp.ok) throw new Error('arquivo não encontrado');
    let txt = await resp.text();
    // remove BOM se existir
    txt = txt.replace(/^\uFEFF/, '');
    const lines = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    // remover cabeçalho se for 'NORMALIZADO' (insensível)
    if(lines.length && /^NORMALIZADO$/i.test(lines[0])) lines.shift();
    const set = new Set(lines.map(l => l.toUpperCase()));
    console.info('Blacklist carregada:', set.size, 'termos');
    return set;
  } catch(err){
    console.warn('Não foi possível carregar blacklist CSV:', err);
    return new Set();
  }
}

/* Verifica se uma entry deve ser excluída por conter qualquer termo da blacklist (substring match) */
function isExcludedByBlacklist(entry, blacklistSet){
  if(!blacklistSet || blacklistSet.size === 0) return false;
  const norm = (entry.normalizado || '').toUpperCase();
  if(!norm) return false;
  for(const term of blacklistSet){
    if(term === '') continue;
    if(norm.indexOf(term) !== -1) return true; // contém termo em qualquer posição
  }
  return false;
}

/* Handler único: carregar dados + blacklist antes de inicializar a UI */

function processEntriesAndInit(){
  if(typeof ENTRIES === 'undefined'){ console.warn('processEntriesAndInit: ENTRIES undefined'); DATA_ENTRIES = []; DATA_UFS = []; return; }
  function norm(s){ return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }

  DATA_ENTRIES = (ENTRIES||[]).map(e=>{
    const copy = Object.assign({}, e);
    copy.curso = (copy.curso || copy.denominacao || copy.normalizado || '').toString();
    copy.denominacao = (copy.denominacao || '').toString();
    copy.normalizado = (copy.normalizado || '').toString();
    copy.instituicao = (copy.instituicao || '').toString();
    copy.cidade = (copy.cidade || '').toString();
    copy.uf = (copy.uf || '').toString();
    copy.modalidade = (copy.modalidade || '').toString();
    copy.carga_horaria = (copy.carga_horaria || '').toString();

    if(copy.carga_horaria){
      let ch = copy.carga_horaria.toString().trim();
      ch = ch.replace(/\bhoras?\b/i,'h').replace(/\bhrs?\b/i,'h');
      ch = ch.replace(/(\d)h\b/i, '$1 h');
      if(/^\d+$/.test(ch)) ch = ch + ' h';
      if(/\d/.test(ch) && !/\bh\b/i.test(ch)) ch = ch + ' h';
      copy.carga_horaria = ch.trim();
    }

    const institNorm = norm(copy.instituicao).toLowerCase();
    const cursoNorm = norm(copy.curso).toLowerCase();
    const denomNorm = norm(copy.denominacao).toLowerCase();
    const normField = norm(copy.normalizado).toLowerCase();
    const cidadeNorm = norm(copy.cidade).toLowerCase();
    const ufNorm = norm(copy.uf).toLowerCase();

    copy.instituicao_normal = institNorm;
    copy.curso_normal = cursoNorm;
    copy.denominacao_normal = denomNorm;
    copy.normalizado_normal = normField;
    copy.cidade_normal = cidadeNorm;
    copy.uf_normal = ufNorm;

    copy._searchText = (institNorm + ' ' + cursoNorm + ' ' + denomNorm + ' ' + normField + ' ' + cidadeNorm + ' ' + ufNorm).trim();
    return copy;
  });

  try{
    const m = new Map();
    (DATA_ENTRIES||[]).forEach(e=>{
      (e.uf||'').toString().split(',').map(x=>x.trim()).filter(Boolean).forEach(u=>{
        m.set(u, (m.get(u)||0) + 1);
      });
    });
    DATA_UFS = Array.from(m.entries()).map(([uf,count])=>({uf,count})).sort((a,b)=>a.uf.localeCompare(b.uf));
  }catch(e){ DATA_UFS = []; }

  try{
    if(typeof Fuse !== 'undefined'){
      fuse = new Fuse(DATA_ENTRIES, {
        keys: [
          { name: 'curso_normal', weight: 0.95 },
          { name: 'denominacao_normal', weight: 0.9 },
          { name: 'normalizado_normal', weight: 0.85 },
          { name: 'instituicao_normal', weight: 0.6 },
          { name: 'cidade_normal', weight: 0.3 },
          { name: 'uf_normal', weight: 0.2 },
          { name: '_searchText', weight: 0.8 }
        ],
        threshold: 0.35,
        ignoreLocation: true,
        useExtendedSearch: false
      });
    } else {
      fuse = null;
    }
  }catch(err){
    console.warn('processEntriesAndInit: failed to build Fuse index', err);
    fuse = null;
  }

  try { window.DATA_ENTRIES = DATA_ENTRIES; window.DATA_UFS = DATA_UFS; window.fuse = fuse; } catch(e){}
  console.log('processEntriesAndInit: DATA_ENTRIES=', (DATA_ENTRIES||[]).length, 'DATA_UFS=', (DATA_UFS||[]).length, 'fuse=', !!fuse);
}



document.addEventListener('DOMContentLoaded', async function(){
  try {
    // 0) carregar o arquivo data.json com ENTRIES
    if (typeof loadEntries === 'function') {
      await loadEntries();
    } else {
      console.warn('loadEntries não definida — verifique seu arquivo');
    }

    // processEntriesAndInit pode já ser invocado dentro de loadEntries();
    // aqui chamamos como garantia caso não tenha sido chamada lá.
    if (typeof processEntriesAndInit === 'function') {
      try { processEntriesAndInit(); } catch(e){ console.warn('processEntriesAndInit erro', e); }
    }

    // garantir exposição para debug/uso externo
    try {
      window.DATA_ENTRIES = window.DATA_ENTRIES || DATA_ENTRIES;
      window.DATA_UFS = window.DATA_UFS || DATA_UFS;
      window.fuse = window.fuse || fuse;
    } catch(e){ /* ignore */ }

    console.log('DOMContentLoaded: ENTRIES length =', (window.DATA_ENTRIES||[]).length, 'fuse?', !!window.fuse);

    // 1) carregar blacklist (arquivo NAO_ENTRAM_CATALOGO.csv localizado no mesmo diretório)
    if (typeof loadBlacklistCSV === 'function') {
      try {
        window.BLACKLIST = await loadBlacklistCSV('NAO_ENTRAM_CATALOGO.csv');
        console.log('Blacklist carregada:', (window.BLACKLIST||[]).length);
      } catch(e){ console.warn('Erro carregando BLACKLIST', e); window.BLACKLIST = []; }
    } else {
      window.BLACKLIST = window.BLACKLIST || [];
    }

    // 2) inicializar a interface que depende dos dados (populateUFs e render)
    try { if (typeof populateUFs === 'function') populateUFs(); } catch(e){ console.warn('populateUFs erro', e); }
    try { if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender(); } catch(e){ console.warn('applyFiltersAndRender erro', e); }

    // 3) gerar Top10 local de forma segura
    try {
      const localTop = (typeof computeTop10FromCatalog === 'function') ? computeTop10FromCatalog(10) : null;
      if (localTop && typeof renderTop10 === 'function') renderTop10(localTop);
      // preencher rodapé com UFs (assume DATA_UFS já preenchido por processEntriesAndInit)
      // try{ if (typeof renderUfsFooter === 'function') renderUfsFooter(DATA_UFS, '#footer-ufs'); } catch(e){ console.warn('renderUfsFooter failed', e); }
    } catch (err) {
      console.warn('Falha ao gerar Top10 local', err);
      const st = document.getElementById('top10_status');
      if (st) st.textContent = 'Erro ao gerar Top10 local';
    }

    // 4) manter listener de resize para reprojetar página
    try {
      window.addEventListener('resize', ()=>{ state.perPage = perPageForWidth(); applyFiltersAndRender(); });
    } catch(e){ console.warn('Erro registrando resize listener', e); }

  } catch (err) {
    console.error('Erro na inicialização (DOMContentLoaded):', err);
    // Em caso de erro, tentar uma inicialização leve
    try{ if (typeof populateUFs === 'function') populateUFs(); } catch(e){ console.warn('populateUFs fallback erro', e); }
    setTimeout(()=> { try{ if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender(); } catch(e){ console.warn('applyFiltersAndRender fallback erro', e); } }, 500);
  }
});

// Replace populateUFs and search to use DATA_UFS and DATA_ENTRIES
// function perPageForWidth(){ return window.innerWidth <= 600 ? 10 : 20; }
function perPageForWidth(){
   const w = window.innerWidth || document.documentElement.clientWidth;
   // mobile pequeno
   if(w <= 420) return 6;
   // mobile padrão
   if(w <= 600) return 8;
   // tablet
   if(w <= 900) return 12;
   // desktop pequeno
   if(w <= 1100) return 16;
   // desktop maior
   return 20;
}

function esc(s){ return String(s||''); }

function toTitleCase(s){
  if(!s) return '';
  // normaliza espaços e deixa tudo minúsculo
  s = String(s).trim().toLowerCase().replace(/\s+/g,' ');
  // capitaliza apenas a primeira letra de cada palavra
  return s.split(' ').map(function(w){
    if(!w) return '';
    // trata conectores com hífen como palavras separadas (ex: "uni-an" => "Uni-An")
    return w.split(/([-–—])/).map(function(part){
      return part.length === 1 && /[-–—]/.test(part)
        ? part
        : (part.charAt(0).toUpperCase() + part.slice(1));
    }).join('');
  }).join(' ');
}


function toTitleCase(s){
  if(!s) return '';
  // normaliza unicode, deixa tudo minúsculo e colapsa espaços
  s = String(s).normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ');
  return s.split(' ').map(function(w){
    if(!w) return '';
    return w.split(/([-–—])/).map(function(part){
      return part.length === 1 && /[-–—]/.test(part)
        ? part
        : (part.charAt(0).toUpperCase() + part.slice(1));
    }).join('');
  }).join(' ');
}


/* === ADICIONADO: escapeHtml, loadInstitutionLinksCSV, institutionDisplay, renderUfsFooter === */
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, function(m){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
  });
}

async function loadInstitutionLinksCSV(filename='INSTITUTION_LINKS.csv'){
  const map = new Map();
  try{

    // adiciona parâmetro de cache-busting para forçar re-fetch (evita versão CDN obsoleta)
    const bust = 'v=' + encodeURIComponent(new Date().toISOString());
    const url = filename + (filename.indexOf('?') === -1 ? '?' + bust : '&' + bust);
    const resp = await fetch(url, { cache: 'no-cache' });

    if(!resp.ok) return map;
    let txt = await resp.text();
    txt = txt.replace(/^\uFEFF/,'');
    const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    for(const ln of lines){
      const parts = ln.split(',');
      if(parts.length < 2) continue;
      const name = parts[0].trim().toUpperCase();
      const url  = parts.slice(1).join(',').trim();
      if(name && url) map.set(name, url);
    }
  }catch(e){
    console.warn('INSTITUTION_LINKS not loaded:', e);
  }
  return map;
}

function institutionDisplay(it){
  const instRaw = String(it.instituicao || '').trim();
  if(!instRaw) return '';
  const key = instRaw.toUpperCase();
  const url = (window.INST_LINKS && window.INST_LINKS.get) ? window.INST_LINKS.get(key) : null;
  const finalUrl = url || ('https://www.google.com/search?q=' + encodeURIComponent(instRaw + ' site:br'));
  const sigRaw = String(it.sigla || '').trim();
  const sigTxt = (sigRaw && /[A-Za-z0-9À-ÿ]/.test(sigRaw)) ? sigRaw + ' - ' : '';
  const label = sigTxt + instRaw;
  return `<a href="${escapeHtml(finalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}
// --- INÍCIO: ranking local avançado (corrigido - listeners seguros) ---
function normalizeCourseName(name){
  if(!name) return '';
  try{ name = String(name); }catch(e){ return ''; }
  // trim + collapse spaces
  name = name.trim().replace(/\s+/g,' ');
  // remove parenthetical content and long dash fragments
  name = name.replace(/\(.*?\)/g,'').replace(/- .*/g,'').trim();
  // remove ordinal/version tokens like " I", " II", " III", roman numerals and simple numeric tokens
  name = name.replace(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/gi,'').replace(/\b[0-9]+\b/g,'');
  // remove trailing single-letter suffixes often used (like " H", " R", etc.)
  // Example: "DISFAGIA H" -> "DISFAGIA"
  name = name.replace(/\s+\b[A-Z]\b$/i, '');
  // remove common single-letter 'H' or 'H.' with optional trailing punctuation
  name = name.replace(/\s+H[\.]?$/i, '');
  // deaccent and normalize unicode
  name = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  // remove non-alphanumeric (keep spaces) and collapse spaces again
  name = name.replace(/[^A-Z0-9 ]/ig,' ').replace(/\s+/g,' ').trim();
  // For ultra-common patterns like trailing " H" following a longer phrase with repeated token " H",
  // the above rules cover them. If you need more custom rules add them here.
  return name.toUpperCase();
}

function getStateFromEntry(e){
  if(!e) return '';
  return (e.uf || e.UF || e.estado || e.estado_sigla || e.sigla_uf || e.state || e.sigla || '').toString().trim().toUpperCase();
}

// helper to trigger search as if typed in the search field
function triggerSearch(query){
  if(typeof query !== 'string') query = String(query || '');
  // ao iniciar uma busca textual, limpamos qualquer filtro por instituição
  try{ state.instituicao = ''; }catch(e){}
  const inp = document.getElementById('q');
  if(inp){
    inp.value = query;
    try{ state.q = query; state.page = 1; }catch(e){}
    try{ applyFiltersAndRender(); }catch(e){}
    try{ inp.focus(); }catch(e){}
  }
}

// Computa top10 de instituições agrupando cursos por nome normalizado e também calcula
// um ranking global de cursos por número distinto de estados onde aparecem.
function computeTop10FromCatalog(limit = 10) {
  const instMap = new Map();
  const courseStates = new Map(); // normalizedCourse -> Set of states

  (DATA_ENTRIES || []).forEach(e => {
    const instName = String(e.instituicao || '').trim();
    if(!instName) return;
    const instKey = instName.toUpperCase();
    if(!instMap.has(instKey)) instMap.set(instKey, { name: instName, entries: [], courseMap: new Map() });
    const inst = instMap.get(instKey);
    inst.entries.push(e);

    const rawCourse = e.normalizado_display || e.normalizado || e.denominacao || e.codigo_curso || '';
    const norm = normalizeCourseName(rawCourse);
    if(!norm) return;
    if(!inst.courseMap.has(norm)){
      inst.courseMap.set(norm, { canonical: rawCourse.toString().trim(), variants: 0, states: new Set() });
    }
    const cobj = inst.courseMap.get(norm);
    cobj.variants += 1;
    const st = getStateFromEntry(e) || 'UNKN';
    cobj.states.add(st);

    if(!courseStates.has(norm)) courseStates.set(norm, new Set());
    courseStates.get(norm).add(st);
  });

  const instArr = Array.from(instMap.values()).map(inst => {
    const courses = Array.from(inst.courseMap.entries()).map(([norm, c])=> ({
      norm, canonical: c.canonical, variants: c.variants, statesCount: c.states.size, states: Array.from(c.states).filter(s=>s && s!=='UNKN')
    }));
    courses.sort((a,b)=> (b.statesCount - a.statesCount) || (b.variants - a.variants) || a.canonical.localeCompare(b.canonical,'pt-BR'));
    return { name: inst.name, totalEntries: inst.entries.length, courses };
  });

  instArr.sort((a,b)=> (b.totalEntries - a.totalEntries) || a.name.localeCompare(b.name,'pt-BR'));
  const top = instArr.slice(0, limit);

  const globalCourseRanking = Array.from(courseStates.entries()).map(([norm, statesSet])=> ({ norm, statesCount: statesSet.size }));
  globalCourseRanking.sort((a,b)=> b.statesCount - a.statesCount || a.norm.localeCompare(b.norm,'pt-BR'));

  return { top, globalCourseRanking };
}

function renderTop10(resultObj) {
  const wrap = document.getElementById('top10_list');
  if (!wrap) return;
  if(!resultObj || !Array.isArray(resultObj.top) || resultObj.top.length === 0){
    wrap.innerHTML = '<div class="small">Nenhuma informação.</div>';
    return;
  }
  const list = resultObj.top;
  const rows = list.map((inst, idx) => {
    const cursosHtml = (inst.courses || []).slice(0,8).map(c => {
      const variantBadge = c.variants && c.variants>1 ? ' <span style="color:#666;font-size:12px">['+c.variants+' var.]</span>' : '';
      return '<div style="font-size:12px;margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:420px;line-height:1.15em">• <strong>'+escapeHtml((c.canonical||'').toString().toUpperCase())+'</strong>'+variantBadge+'</div>';
    }).join('');
    // institution name clickable using data attribute (no inline onclick)
    const instSafe = encodeURIComponent(inst.name || '');
    const instClickable = '<a href=\"#\" class=\"top10-inst\" data-inst=\"'+instSafe+'\" style=\"text-decoration:none;color:inherit\">'+ escapeHtml(inst.name) +'</a>';
    return '<div style=\"padding:8px 6px;border-bottom:1px solid #eee\">' +
      '<div style=\"font-weight:700\">'+(idx+1)+'. '+instClickable+' <span style=\"font-weight:400;color:#666;font-size:12px\">('+inst.totalEntries+' registros)</span></div>' +
      (cursosHtml || '<div class=\"small\" style=\"color:#666\">Nenhum curso do catálogo correspondido</div>') +
    '</div>';
  }).join('');

  wrap.innerHTML = rows;
  const st = document.getElementById('top10_status');
  if (st) st.style.display = 'none';

  // attach click listeners for institution links (event delegation safe)
  try{
    const wrapEl = document.getElementById('top10_list');
    if(wrapEl){
      wrapEl.querySelectorAll('.top10-inst').forEach(a=>{
        a.addEventListener('click', function(ev){
          ev.preventDefault();
          const qv = decodeURIComponent(this.dataset.inst || '');
          // aplicar filtro por instituição (mantém o comportamento de paginação)
          // limpa a busca textual para evitar conflito com course search
          state.q = '';
          setFilterAndSearch('instituicao', qv);
        });
      });
    }
  } catch(e){ console.warn('attach top10-inst listeners failed', e); }

  // Chamada para renderTopCourses (integrada)
  try{
    renderTopCourses(resultObj.globalCourseRanking || []);
  } catch(e){ console.warn('renderTopCourses failed', e); }
}

function renderTopCourses(globalRanking, limit=10) {
  const wrap = document.getElementById('top_courses_list');
  if (!wrap) return;
  if(!Array.isArray(globalRanking) || globalRanking.length === 0){
    wrap.innerHTML = '<div class="small">Nenhuma informação.</div>';
    return;
  }
  const list = globalRanking.slice(0, limit);
  const rows = list.map((g, idx) => {
    const label = g.norm;
    const safe = encodeURIComponent(label);
    return '<div style=\"padding:8px 6px;border-bottom:1px solid #eee\">' +
      '<div style=\"font-weight:700\">' + (idx+1) + '. <a href=\"#\" class=\"top-course\" data-course=\"' + safe + '\" style=\"text-decoration:none;color:inherit\">' + escapeHtml(label) + '</a> <span style=\"font-weight:400;color:#666;font-size:12px\">(' + g.statesCount + ' estados)</span></div>' +
    '</div>';
  }).join('');

  wrap.innerHTML = rows;
  const st = document.getElementById('top_courses_status');
  if (st) st.style.display = 'none';

  // attach click listeners for courses (event delegation safe)
  try{
    const wrapEl = document.getElementById('top_courses_list');
    if(wrapEl){
      wrapEl.querySelectorAll('.top-course').forEach(a=>{
        a.addEventListener('click', function(ev){
          ev.preventDefault();
          const qv = decodeURIComponent(this.dataset.course || '');
          triggerSearch(qv);
        });
      });
    }
  } catch(e){ console.warn('attach top-course listeners failed', e); }
}

function renderUfsFooter(ufsArray, targetSelector='#footer-ufs'){
  const el = document.querySelector(targetSelector);
  if(!el) return;
  const parts = (ufsArray||[]).map(o => `${escapeHtml(String(o.uf))}: ${Number(o.count||0)}`);
  el.innerHTML = parts.join(' &bull; ');
}
 
function uniq(arr){ return Array.from(new Set(arr)).sort(); }

const q = document.getElementById('q');
const listEl = document.getElementById('list');
const searchinfo = document.getElementById('searchinfo');
const pagerEl = document.getElementById('pager');
const clearFiltersBtn = document.getElementById('clear_filters');
const printBtn = document.getElementById('print');
const tocDiv = document.getElementById('toc_by_uf');

let state = { q:'', uf:'', instituicao:'', page:1, perPage: perPageForWidth() };


// Inicialização segura do Fuse (não redeclara e só cria se ainda não existir)
if (typeof Fuse !== 'undefined' && typeof DATA_ENTRIES !== 'undefined') {
  if (!window.fuse && !fuse) {
    try{
      fuse = new Fuse(DATA_ENTRIES, { 
        keys: [
          { name: 'curso_normal', weight: 0.95 },
          { name: 'denominacao_normal', weight: 0.9 },
          { name: 'normalizado_normal', weight: 0.85 },
          { name: 'instituicao_normal', weight: 0.6 },
          { name: 'cidade_normal', weight: 0.3 },
          { name: 'uf_normal', weight: 0.2 },
          { name: '_searchText', weight: 0.8 }
        ],
        threshold: 0.35,
        ignoreLocation: true,
        useExtendedSearch: false
      });
      try{ window.fuse = fuse; }catch(e){}
    }catch(e){
      console.warn('initial Fuse build failed', e);
      fuse = null;
      try{ window.fuse = null; }catch(e){}
    }
  } else {
    // já existe um índice fuse (provavelmente criado por processEntriesAndInit)
    try{ window.fuse = window.fuse || fuse; }catch(e){}
  }
} else {
  // fallback simple, exposto em window também
  fuse = {
    search: function(q){ var ql=(q||'').toString().toLowerCase(); return (window.DATA_ENTRIES || []).filter(function(it){ return ('' + (it.normalizado||'')).toLowerCase().indexOf(ql) !== -1 || ('' + (it.instituicao||'')).toLowerCase().indexOf(ql)!==-1; }).map(function(i){return {item:i};}); }
  };
  try{ window.fuse = fuse; }catch(e){}
}

function searchEntries(qstr){
  if(!qstr || !qstr.toString().trim()) return Array.isArray(DATA_ENTRIES) ? DATA_ENTRIES.slice() : [];

  const qRaw = String(qstr);
  const q = qRaw.trim();
  const qUpper = q.toUpperCase();
  const qLower = q.toLowerCase();
  const compactQ = q.replace(/\s+/g, '');

  // normaliza removendo tudo que não for letra/número e upper
  function normTok(s){
    if(!s) return '';
    return s.toString().toUpperCase().replace(/[^A-Z0-9]/g,'');
  }

  // extrai conteúdo entre parênteses
  function parenthesesTokens(s){
    if(!s) return [];
    const m = s.match(/\(([^)]+)\)/g);
    if(!m) return [];
    return m.map(x => x.replace(/^\(|\)$/g,'').trim()).filter(Boolean);
  }

  const qNorm = normTok(compactQ || qUpper);

  // heurística de sigla / acrônimo quando query curta e sem espaços
  const isLikelyAcronym = /^[A-Z0-9]{1,10}$/i.test(compactQ) && compactQ.length >= 2;

  if(isLikelyAcronym){
    const entries = Array.isArray(DATA_ENTRIES) ? DATA_ENTRIES : [];
    const matches = [];

    for(const e of entries){
      const candidates = [
        e.sigla, e.sigla_instituicao, e.acronimo, e.acronimo_instituicao,
        e.instituicao, e.nome_instituicao, e.razao_social, e.nome
      ];

      let matched = false;
      for(const raw of candidates){
        if(!raw) continue;
        const s = raw.toString();
        const sNorm = normTok(s);
        if(!sNorm) continue;

        // exato ou includes (case-insensitive, usando normalizado)
        if(sNorm === qNorm || sNorm.indexOf(qNorm) !== -1 || qNorm.indexOf(sNorm) !== -1){
          matched = true; break;
        }

        // conteúdos entre parênteses
        const par = parenthesesTokens(s);
        for(const p of par){
          const pNorm = normTok(p);
          if(pNorm === qNorm || pNorm.indexOf(qNorm) !== -1 || qNorm.indexOf(pNorm) !== -1){
            matched = true; break;
          }
        }
        if(matched) break;

        // tokens do nome
        const tokens = s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
        for(const t of tokens){
          if(normTok(t) === qNorm){
            matched = true; break;
          }
        }
        if(matched) break;

        // fallback: compacta nome e checa contém
        const compactName = s.toUpperCase().replace(/[^A-Z0-9]/g,'');
        if(compactName.indexOf(qNorm) !== -1 || qNorm.indexOf(compactName) !== -1){
          matched = true; break;
        }
      }

      if(matched) matches.push(e);
    }

    if(matches.length > 0) return matches;
  }

  // fallback: usar Fuse se disponível
  try{
    if(typeof fuse !== 'undefined' && fuse && typeof fuse.search === 'function'){
      const res = fuse.search(qRaw);
      if(Array.isArray(res)) return res.map(r=> r && r.item ? r.item : r);
    }
  }catch(e){
    // ignora erro e segue
  }

  // fallback simples por contains (case-insensitive)
  try{
    return (Array.isArray(DATA_ENTRIES) ? DATA_ENTRIES : []).filter(i => {
      const fields = [
        i.normalizado_display, i.normalizado, i.denominacao, i.codigo_curso,
        i.instituicao, i.nome_instituicao, i.sigla, i.acronimo, i.razao_social
      ];
      for(const f of fields){
        if(!f) continue;
        const fStr = f.toString();
        if(fStr.toLowerCase().indexOf(qLower) !== -1) return true;
      }
      // tokens e forma compacta do nome da instituição
      const inst = (i.instituicao || i.nome_instituicao || '').toString();
      if(inst){
        const instUpper = inst.toUpperCase();
        const tokens = instUpper.split(/[^A-Z0-9]+/).filter(Boolean);
        if(tokens.includes(qUpper)) return true;
        const compactInst = instUpper.replace(/[^A-Z0-9]/g,'');
        if(compactInst.indexOf(qNorm) !== -1 || qNorm.indexOf(compactInst) !== -1) return true;
      }
      return false;
    });
  }catch(err){
    return Array.isArray(DATA_ENTRIES) ? DATA_ENTRIES.slice() : [];
  }
}

function populateUFs(){
  tocDiv.innerHTML = '';
  DATA_UFS.forEach(obj=>{
    const u = obj.uf; const count = obj.count;
    if(u==='ZZ') return;
    const a = document.createElement('a'); a.href='#'; a.textContent = `${u} (${count})`;
    a.style.display='block'; a.style.padding='6px 0';
    a.onclick = (ev)=>{ ev.preventDefault(); setFilterAndSearch('uf', u); };
    tocDiv.appendChild(a);
  });
}


function renderCard(entry){
  return `
    <div class="card" data-id="${entry.id}">

      <h3> ${esc(g.title)} </h3>

      <div class="meta-row small">${institutionDisplay(entry)} • ${esc(entry.uf)}</div>
      <div class="meta-row"><strong>Carga:</strong> ${esc(entry.carga_horaria)} • <strong>Vagas:</strong> ${esc(entry.vagas)}</div>
      <div class="meta-row small"><strong>Coordenador:</strong> ${esc(entry.coordenador)}</div>
    </div>
  `;
}


function setFilterAndSearch(k,v){ state[k]=v; state.page=1; applyFiltersAndRender(); }


/* ---------- INÍCIO: Normalização de títulos de curso  ----------       <h3>${esc(entry.normalizado)}</h3> */

/**
 * normalizeCourseTitle(str)
 * - remove sufixos de volumes/níveis (I, II, III, 1, 2, A, B, H, Parte, Módulo, Nível, Etapa, etc.)
 * - remove parênteses e hífens finais
 * - reduz espaços e normaliza acentuação
 * - capitaliza apenas a primeira letra (estética)
 */

/* ------------- normalizeCourseTitle (versão mais precisa) ------------- */
/* ---------- normalizeCourseTitle (versão agressiva, retorna MAIÚSCULAS) ---------- */
function normalizeCourseTitle(raw){
  if(!raw) return '';
  // 1) limpeza básica e remoção BOM
  let s = String(raw).trim().replace(/^\uFEFF/, '');

  // 2) remover acentuação para matching e transformar em UPPERCASE
  let t = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  // 3) padrões a remover quando aparecem no FINAL do título (iterativo)
  const removePatterns = [
    // "- MODULO I", "/ MODULO II", etc
    /\s*[-–—:\/]\s*(?:MODULO|MOD|MÓDULO|PARTE|PARTE|NIVEL|NÍVEL|EDICAO|EDIÇÃO|VOLUME|VOL|TURMA|SERIE|SÉRIE|ANO)\b[\s\-:]*([IVXLCDM]+|\d{1,3}|[A-Z])\s*$/i,
    // "(I)" ou "(MODULO I)"
    /\s*\(\s*(?:MODULO|MOD|PARTE|NIVEL|EDICAO|VOLUME|TURMA|SERIE)?\s*([IVXLCDM]+|\d{1,3}|[A-Z])\s*\)\s*$/i,
    // algarismos romanos finais isolados
    /\s*\b([IVXLCDM]{1,5})\b\s*$/i,
    // números arábicos finais
    /\s*\b([0-9]{1,3})\b\s*$/i,
    // letra isolada final (A, B, H etc.) - remove quando for sufixo
    /\s*\b([A-Z])\b\s*$/i,
    // separadores com token
    /\s*[-–—:\/]\s*([IVXLCDM]+|\d{1,3}|[A-Z])\s*$/i,
    // palavra residual "OU" no fim
    /\s*\bOU\b\s*$/i
  ];

  let prev;
  do {
    prev = t;
    for(const re of removePatterns){
      t = t.replace(re, '').trim();
    }
    // limpar pontuação remanescente no final
    t = t.replace(/[\s\-\:\/\(\)\.]+$/,'').trim();
  } while(t !== prev && t.length > 0);

  // 4) reduzir espaços repetidos
  t = t.replace(/\s{2,}/g,' ').trim();

  // 5) Se ficou vazio (improvável), fallback para versão sem diacríticos
  if(!t) t = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  // 6) Garantir que o retorno é EM MAIÚSCULAS (para exibição e agrupamento)
  return t.toUpperCase();
}

/* ---------- FIM: Normalização de títulos ---------- */


/* ---------- INÍCIO: Agrupamento ---------- */
/* Agrupa um array de entradas por título (normalizado) e preserva ordem */
function groupByTitle(entriesArr){
  const map = new Map();
  const order = [];
  for (let i = 0; i < entriesArr.length; i++){
    const e = entriesArr[i];
    // normaliza o título usando sua função de normalização
    const key = normalizeCourseTitle(e.normalizado || '');
    if(!key) continue; // OK dentro de for
    if(!map.has(key)){
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(e);
  }
  // converte para array preservando a ordem das primeiras ocorrências
  return order.map(k => ({ title: k, items: map.get(k) }));
}

function renderVariantHTML(it){
  const instDisplay = institutionDisplay(it);
  // não repetir modalidade por item (ficará no resumo do grupo)
  const ufTxt = esc(it.uf || '');
  const cargaTxt = esc(it.carga_horaria || it.carga || '');
  const vagasTxt = esc(it.vagas || '') || esc(it.vaga || '');
  const coordTxt = it.coordenador ? (' • <strong>Coordenador:</strong> ' + esc(it.coordenador)) : '';

  return `
    <div class="variant" data-id="${it.id}" style="padding:6px 0;border-top:1px solid #f0f0f0">
      <div style="font-size:13px;color:#2d6b8f;font-weight:700;line-height:1.15">${esc(it.normalizado_display || '')}</div>
      <div style="font-size:13px;font-weight:700;margin-top:4px">${instDisplay} • ${ufTxt}</div>
      <div class="meta-row small" style="color:#444;font-size:13px;margin-top:6px">
        <strong>Carga:</strong> ${cargaTxt} • <strong>Vagas:</strong> ${vagasTxt}${coordTxt}
      </div>
    </div>
  `;
}

function applyFiltersAndRender(){
    state.perPage = perPageForWidth();
    const qstr = state.q.trim();

    // 1) Filtrar por busca (Fuse)
    let filteredEntries = Array.isArray(DATA_ENTRIES) ? DATA_ENTRIES.slice() : [];

    // 2) textual search (Fuse preferred; fallback on _searchText)
    if(state.q && state.q.toString().trim().length > 0){
      const q = state.q.toString().trim();
      const qNorm = q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

      let searchResult = [];
      if(typeof fuse !== 'undefined' && fuse && typeof fuse.search === 'function'){
        try{
          // use fuse; its keys index curso_normal etc.
          searchResult = fuse.search(q).map(r => r.item);
        } catch(e){
          console.warn('Fuse search failed, will fallback', e);
        }
      }

      if(!searchResult || searchResult.length === 0){
        // fallback: search in _searchText normalized
        searchResult = filteredEntries.filter(e => (e._searchText || '').indexOf(qNorm) !== -1);
      }

      filteredEntries = searchResult;
    }
    
    // --- FILTRAGEM COM BLACKLIST ---
    if (window.BLACKLIST && window.BLACKLIST.size > 0) {
      // remove entradas cujo campo normalizado contenha QUALQUER termo da blacklist
      filteredEntries = filteredEntries.filter(e => !isExcludedByBlacklist(e, window.BLACKLIST));
    }
    // --- FIM FILTRAGEM COM BLACKLIST ---

    /* --- FILTRAGEM POR CARGA HORÁRIA: remover cargas < 360 (versão conservadora) --- */
    // helper: extrai número de horas de uma string (ex.: "480 h", "360h", "360", "360,5", "360.5")
    function parseCargaHours(s){
      if(!s && s !== 0) return null;
      const str = String(s).trim();
      if(!str) return null;
      // remove unidades e texto, troca vírgula por ponto
      const cleaned = str.replace(/[^\d,.\-]/g,'').replace(',', '.').trim();
      // extrair primeiro número (suporta decimais e negativos incidentalmente)
      const m = cleaned.match(/-?\d+(\.\d+)?/);
      if(!m) return null;
      const num = parseFloat(m[0]);
      if(Number.isNaN(num)) return null;
      return num;
    }

    // aplicar filtro (conservador): só EXCLUI quando conseguimos ler um número e ele for < 360
    const beforeCargaCount = filteredEntries.length;
    filteredEntries = filteredEntries.filter(e => {
      const ch = parseCargaHours(e.carga_horaria || e.carga || e['carga'] || '');
      if(ch === null) return true;     // não conseguimos ler: manter para revisão manual
      return ch >= 360;                // manter somente se >= 360
    });
    console.debug('filtragem carga: antes=', beforeCargaCount, 'depois=', filteredEntries.length);

    // 2) Filtrar por UF se necessário
    if(state.uf){
      const target = state.uf.toUpperCase();
      filteredEntries = filteredEntries.filter(e=>{
        const parts = (e.uf||'').split(/[,]/).map(x=>x.trim().toUpperCase()).filter(Boolean);
        return parts.includes(target);
      });
    }

    // 2b) Filtrar por instituição (quando acionado pelo Top10 - instituicao é substring match case-insensitive)
    if(state.instituicao){
      const instTarget = state.instituicao.toString().toLowerCase();
      filteredEntries = filteredEntries.filter(e=>{
        const inst = (e.instituicao || e.nome_instituicao || '').toString().toLowerCase();
        return inst.indexOf(instTarget) !== -1;
      });
    }

    // 3) Agrupar por título (preserva ordem de aparecimento)
    const map = new Map();
    const order = [];
    filteredEntries.forEach(e=>{
      const key = normalizeCourseTitle(e.normalizado || '');
      if(!key) return;
      if(!map.has(key)){ map.set(key, []); order.push(key); }
      map.get(key).push(e);
    });
    const groups = order.map(k => ({ title: k, items: map.get(k) }));

    // 4) Paginação por títulos (cada página mostra N títulos)
    const totalTitles = groups.length;
    const totalPages = Math.max(1, Math.ceil(totalTitles / state.perPage));
    if(state.page > totalPages) state.page = totalPages;
    const startTitle = (state.page - 1) * state.perPage;
    const pageGroups = groups.slice(startTitle, startTitle + state.perPage);
    // ordenar grupos (títulos de curso) alfabeticamente ao aplicar filtros
    pageGroups.sort((a,b) => ('' + (a.title||'')).localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' }));


    // 5) Montar HTML com melhor espaçamento e layout
    const showPreview = 2; // quantas variações mostrar por padrão (ajustável)
    const html = pageGroups.map(g=>{
      const count = g.items.length;
      // resumo: modalidades e UFs únicas
      const modSet = new Set();
      const ufSet = new Set();
      g.items.forEach(it=>{
        if(it.modalidade) modSet.add(it.modalidade);
        (it.uf||'').split(',').map(u=>u.trim()).filter(Boolean).forEach(u=>ufSet.add(u));
      });
      const mods = Array.from(modSet).join(' • ');
      const ufs = Array.from(ufSet).join(', ');

      // gerar HTML das primeiras variações (preview)
      // --- Agrupar por instituição para evitar repetições quando cursos foram unificados ---
      const instMap = new Map();
      g.items.forEach(it=>{
      const key = institutionDisplay(it) || ('__unknown__' + (it.id||Math.random()));
      
      if(!instMap.has(key)) instMap.set(key, []);
        instMap.get(key).push(it);
      });

    // transformar em lista para exibição. cada entrada representa 1 instituição (com possivelmente várias variantes)
      const instList = Array.from(instMap.values()).map(items => {
        const rep = items[0]; // representante
        const instName = institutionDisplay(rep);
        const ufs = Array.from(new Set(items.map(i=> (i.uf||'').toString().trim() ))).filter(Boolean).join(', ');
        const carga = esc(rep.carga_horaria || rep.carga || '');
        const vagas = esc(rep.vagas || rep.vaga || '');
        const coord  = rep.coordenador ? ('<div style="color:#666;font-size:13px;margin-top:2px"><strong>Coordenador:</strong> ' + esc(rep.coordenador) + '</div>') : '';
        return {
          instName,
          rep,
          ufs,
          metaLine: `<div style="color:#444; font-size:13px; margin-top:4px"><strong>Carga:</strong> ${carga} • <strong>Vagas:</strong> ${vagas}</div>`,
          coordLine: coord
        };
      });

      // ordenar instituições alfabeticamente por nome (pt-BR, case-insensitive)
      instList.sort((a,b) => ('' + (a.instName||'')).localeCompare(b.instName||'', 'pt-BR', { sensitivity: 'base' }));


    // gerar HTML das primeiras instituições (preview)
    const firstN = instList.slice(0, showPreview).map(obj=>{
      const instit = `<div style="font-weight:700; margin-bottom:6px">${obj.instName}${ obj.ufs ? (' • ' + esc(obj.ufs)) : '' }</div>`;
      return `<div class="variant" data-id="${obj.rep.id}" style="padding:6px 0;border-top:1px solid #f0f0f0">${instit}${obj.metaLine}${obj.coordLine}</div>`;
    }).join('');

    // mais instituições escondidas
    const moreCount = Math.max(0, instList.length - showPreview);
    const moreHtml = moreCount > 0
      ? `<div class="more-variants" style="display:none; padding-top:8px">${ instList.slice(showPreview).map(obj=>{
          const institut = `<div style="font-weight:700; margin-bottom:6px">${obj.instName}${ obj.ufs ? (' • ' + esc(obj.ufs)) : '' }</div>`;
          return `<div class="variant" data-id="${obj.rep.id}" style="padding:6px 0;border-top:1px solid #f0f0f0">${institut}${obj.metaLine}${obj.coordLine}</div>`;
        }).join('') }</div>`
      : '';


        // helper para pluralização
        function pluralize(n, singular, plural){
        return (Number(n) === 1) ? singular : plural;
        }

        const toggleBtn = (moreCount > 0)
        ? `<div style="margin-top:8px"><button class="toggle-more" data-count="${moreCount}" style="padding:7px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer">Mostrar +${moreCount} ${pluralize(moreCount,'variação','variações')}</button></div>`
        : '';

        // título: mostrar "— N variações" SOMENTE se N > 1
        const titleSuffix = (count > 1) ? ` <small style="color:#666; margin-left:8px">— ${count} variações</small>` : '';

        return `<div class="group" style="margin-bottom:14px;padding:12px;border-radius:6px;background:#fff;border:1px solid #f3f3f3">
          <h3 style="margin:0 0 8px;font-size:20px;line-height:1.15;font-weight:800;color:#0b3f5a;letter-spacing:0.2px">
            ${esc(g.title)}
            ${ (g.items.length > 1) ? `<small style="color:#666;font-weight:600;margin-left:10px;font-size:13px">— ${g.items.length} variações</small>` : '' }
          </h3>
          <div class="summary" style="color:#666;font-size:13px;margin-bottom:6px">${ mods ? mods + ' • ' : '' }${ ufs }</div>
          ${firstN}
          ${moreHtml}
          ${toggleBtn}
        </div>`;
      }).join('');

      listEl.innerHTML = html || '<div class="small">Nenhum resultado.</div>';

      // 6) Atualizar info de busca/paginação (títulos e registros)
      const totalVariants = filteredEntries.length;
      searchinfo.textContent = `Mostrando ${Math.min(startTitle+1,totalTitles)}–${Math.min(startTitle+state.perPage,totalTitles)} de ${totalTitles} títulos — ${totalVariants} registros${state.q ? " — '"+state.q+"'" : ""}`;

      // 7) Render pager compacto (por títulos)
      renderPager(totalPages);

      // 8) Atachar handlers dos toggles
      Array.from(document.querySelectorAll('.toggle-more')).forEach(btn=>{
        btn.onclick = function(){
          const parent = this.closest('.group');
          const more = parent.querySelector('.more-variants');
          if(!more) return;
          if(more.style.display === 'none'){
            more.style.display = 'block';
            this.textContent = 'Ocultar variações';
          } else {
            more.style.display = 'none';
            this.textContent = 'Mostrar +' + this.dataset.count + ' variações';
          }
        };
      });

      window._lastFiltered = filteredEntries;
}

/* Paginador compacto (janela de páginas, Prev/Next, primeiras/últimas com reticências)
   - Não gera centenas de botões; mostra apenas um conjunto ao redor da página atual.
   - Ajustável: windowSize (quantas páginas mostrar ao redor).
*/
function renderPager(totalPages){
  pagerEl.innerHTML = '';
  if(totalPages <= 1) return;

  const current = state.page || 1;
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '6px';
  container.style.flexWrap = 'wrap';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';

  const createBtn = (label, page, isActive=false, extraStyle='')=>{
    const b = document.createElement('button');
    b.textContent = label;
    b.style.padding = '6px 10px';
    b.style.borderRadius = '8px';
    b.style.border = 'none';
    b.style.cursor = 'pointer';
    b.style.background = isActive ? '#0b5d8a' : '#eef7fb';
    b.style.color = isActive ? '#fff' : '#0b5d8a';
    if(extraStyle) b.style.cssText += extraStyle;
    b.onclick = ()=>{ state.page = page; applyFiltersAndRender(); };
    return b;
  };

  // Prev
  const prev = createBtn('‹', Math.max(1, current-1));
  container.appendChild(prev);

  const windowSize = 5; // total buttons to show around current (odd preferred)
  const half = Math.floor(windowSize/2);
  let start = Math.max(1, current - half);
  let end = Math.min(totalPages, current + half);
  // adjust if we're near start or end to always attempt windowSize pages
  if(end - start + 1 < windowSize){
    if(start === 1) end = Math.min(totalPages, start + windowSize - 1);
    else if(end === totalPages) start = Math.max(1, end - windowSize + 1);
  }

  // First page & leading ellipsis
  if(start > 1){
    container.appendChild(createBtn('1', 1));
    if(start > 2){
      const dots = document.createElement('span'); dots.textContent = '…'; dots.style.padding = '6px 4px'; container.appendChild(dots);
    }
  }

  // Page numbers window
  for(let p = start; p <= end; p++){
    const isActive = (p === current);
    container.appendChild(createBtn(String(p), p, isActive));
  }

  // Trailing ellipsis & last page
  if(end < totalPages){
    if(end < totalPages - 1){
      const dots2 = document.createElement('span'); dots2.textContent = '…'; dots2.style.padding = '6px 4px'; container.appendChild(dots2);
    }
    container.appendChild(createBtn(String(totalPages), totalPages));
  }

  // Next
  const next = createBtn('›', Math.min(totalPages, current+1));
  container.appendChild(next);

  pagerEl.appendChild(container);
}

/* ========== FIM SUBSTITUIÇÃO ========== */

let timer = null;
q.addEventListener('input', ()=>{ clearTimeout(timer); timer = setTimeout(()=>{ state.q = q.value; state.page = 1; applyFiltersAndRender(); }, 180); });

// Limpar filtros recarrega a página
clearFiltersBtn.addEventListener('click', ()=>{ location.reload(); });

printBtn.addEventListener('click', ()=>{ document.querySelector('.layout').style.gridTemplateColumns = '1fr'; window.print(); setTimeout(()=>{ document.querySelector('.layout').style.gridTemplateColumns = '260px 1fr'; }, 600); });

    (function(){
      const link = document.getElementById('mec_info_link'); // link do rodapé que o usuário clica
      const backdrop = document.getElementById('mec_modal_backdrop');
      const closeBtn = document.getElementById('mec_modal_close');
      const openBtn = document.getElementById('mec_modal_open');

      // URL oficial do MEC (padrão). Se quiser outra página específica, substitua aqui:
      const officialLink = 'https://emec.mec.gov.br/emec/nova';

      // Abre o modal no desktop; em mobile (≤600px) abre nova aba
      function openInfo(){
          if(window.innerWidth <= 600){
          window.open(officialLink, '_blank', 'noopener');
          return;
          }
          backdrop.style.display = 'flex';
          backdrop.setAttribute('aria-hidden', 'false');
          // foco no botão Fechar para acessibilidade
          closeBtn.focus();
          document.addEventListener('keydown', escHandler);
      }

      function closeInfo(){
          backdrop.style.display = 'none';
          backdrop.setAttribute('aria-hidden', 'true');
          document.removeEventListener('keydown', escHandler);
          // devolve foco ao link do rodapé (se existir)
          if(link) link.focus();
      }

      function escHandler(e){
          if(e.key === 'Escape') closeInfo();
      }

      // Eventos
      if(link) link.addEventListener('click', function(ev){
          ev.preventDefault();
          openInfo();
      });

      closeBtn.addEventListener('click', function(){ closeInfo(); });
      openBtn.addEventListener('click', function(){ window.open(officialLink, '_blank', 'noopener'); });

      // fechar ao clicar fora do modal
      backdrop.addEventListener('click', function(e){
          if(e.target === backdrop) closeInfo();
      });
    })();