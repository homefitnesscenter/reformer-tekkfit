/* Tekkfit Pilates — collezione Reformer, sito con scroll 3D.
   Script classico (non modulo) così la pagina si apre anche con doppio clic:
   three.js arriva con import() dinamico tramite l'importmap di index.html.

   Come funziona:
   - i 5 modelli sono descritti in js/modelli.js; si sceglie dal selettore o dalle carte;
   - ogni modello viene "attrezzato" al caricamento: i pezzi si riconoscono dal codice di
     distinta nel nome (C = carrello, M = molle, T08 = footbar…) e finiscono in 7 gruppi;
   - un oggetto di stato S (camera + parti mobili) è animato da UNA timeline GSAP legata
     allo scroll; ogni sezione [data-k] ha un'inquadratura (KEY) e un'eventuale azione (AZIONI). */

(async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

  gsap.registerPlugin(ScrollTrigger);
  document.body.classList.add('caricamento');

  const RIDOTTO = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const telefono = () => innerWidth < 861;
  // testo e reformer affiancati: desktop, e telefono tenuto in orizzontale
  const affiancato = () => innerWidth >= 861 || (innerWidth > innerHeight && innerHeight <= 520);
  const MODELLI = window.MODELLI;
  const perId = Object.fromEntries(MODELLI.map((m) => [m.id, m]));

  /* ---------------- Renderer, scena, luci ---------------- */
  const canvas = document.getElementById('scena');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, telefono() ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.62;

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 60);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e3dc, 0.9));
  const luceChiave = new THREE.DirectionalLight(0xfffaf2, 2.2);
  luceChiave.position.set(1.6, 4.2, 2.8);
  luceChiave.castShadow = true;
  luceChiave.shadow.mapSize.set(telefono() ? 1024 : 2048, telefono() ? 1024 : 2048);
  Object.assign(luceChiave.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.5, far: 10 });
  luceChiave.shadow.bias = -0.0004;
  luceChiave.shadow.normalBias = 0.02;
  scene.add(luceChiave);

  // controluce malva leggera: un filo di colore Pilates sui bordi
  const luceRosa = new THREE.SpotLight(0xD98CC8, 8, 14, Math.PI / 5, 0.8, 1.4);
  luceRosa.position.set(-1.4, 0.55, -3.4);
  luceRosa.target.position.set(0, 0.35, 0);
  scene.add(luceRosa, luceRosa.target);
  const luceFredda = new THREE.DirectionalLight(0xffffff, 0.8);
  luceFredda.position.set(3, 1.6, -2.5);
  scene.add(luceFredda);

  const sfumatura = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, '#fff'); r.addColorStop(0.45, '#888'); r.addColorStop(1, '#000');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  // fondo chiaro: il pavimento è invisibile e raccoglie solo l'ombra
  const pavimento = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 64),
    new THREE.ShadowMaterial({ color: 0x2a2230, opacity: 0.22, transparent: true, depthWrite: false })
  );
  pavimento.rotation.x = -Math.PI / 2;
  pavimento.receiveShadow = true;
  scene.add(pavimento);

  const reformer = new THREE.Group();
  scene.add(reformer);

  /* ---------------- Caricamento modelli ---------------- */
  const loaderEl = document.getElementById('loader');
  const pctEl = document.getElementById('loader-pct');
  const fillEl = document.getElementById('loader-fill');
  const progresso = (p) => { const v = Math.round(p * 100); pctEl.textContent = v; fillEl.style.width = v + '%'; };

  const loader = new GLTFLoader();
  const daBase64 = (mod) => new Promise((ok, ko) => {
    // con file:// il browser blocca fetch: il modello arriva come script base64
    const usa = () => {
      const bin = atob(window.MODELLI_B64[mod.id]);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      loader.parse(u8.buffer, '', ok, ko);
    };
    if (window.MODELLI_B64 && window.MODELLI_B64[mod.id]) return usa();
    const s = document.createElement('script');
    s.src = mod.file.replace('.glb', '.js');
    s.onload = usa; s.onerror = ko;
    document.head.appendChild(s);
  });
  const daRete = (mod, onP) => new Promise((ok, ko) => {
    loader.load(mod.file, ok, (e) => { if (e.total && onP) onP(e.loaded / e.total); }, ko);
  });
  // da disco (file://) o dove i .glb non si possono servire (window.MODELLI_SOLO_JS) si usano le copie .js
  const soloJs = () => location.protocol === 'file:' || window.MODELLI_SOLO_JS === true;
  const carica = (mod, onP) => {
    if (!soloJs()) return daRete(mod, onP).catch(() => daBase64(mod));
    let p = 0; const t = onP ? setInterval(() => onP(Math.min(0.9, p += 0.06)), 150) : null;
    return daBase64(mod).finally(() => { if (t) clearInterval(t); });
  };

  /* ---------------- Attrezzatura di un modello ---------------- */
  // codici di distinta → gruppi. Due schemi: T/C/M/P/L/F… e quello del R1 Industriale (A/B/C/D/E/F/G/H)
  const SCHEMA_STANDARD = [
    ['footbar', /^(T08|F06|T05_(Mozzo|Cremagliera)|F04_(Pomello_posizioni|Perno|Barra))/],
    ['montanti', /^(T09|P0\d|F04_Pomello_telescopico)/],
    ['molle', /^M0\d/],
    ['carrello', /^(C\d\d|T10|T13)/],
    ['pedana', /^F07/],
    ['basamento', /^(L0\d|T03_(Basamento|Gamba)|F01|F02|F08)/],
  ];
  const SCHEMA_R1I = [
    ['basamento', /^(A05|H01|H02|A12_Staffe_ruota|B09_Asse_ruota_trasporto)/],
    ['footbar', /^E0\d/],
    ['montanti', /^(A09|A10|F0\d)/],
    ['molle', /^D0\d/],
    ['carrello', /^(B0\d|B1\d|C0\d)/],
    ['pedana', /^(G0\d|A11)/],
  ];
  const GRUPPI = ['struttura', 'basamento', 'molle', 'carrello', 'footbar', 'montanti', 'pedana'];
  const CODICE = /^[A-Z]\d\d_/;

  const attrezza = (gltf, mod) => {
    const sorgente = gltf.scene;
    const rig = new THREE.Group();
    rig.add(sorgente);

    // i "pezzi" sono i nodi col codice di distinta (un pezzo può avere più mesh, una per materiale)
    const pezzi = [];
    sorgente.traverse((o) => {
      if (!CODICE.test(o.name)) return;
      let p = o.parent, dentro = false;
      while (p) { if (CODICE.test(p.name)) { dentro = true; break; } p = p.parent; }
      if (!dentro) pezzi.push(o);
    });
    const schema = pezzi.some((p) => /^A01_/.test(p.name)) ? SCHEMA_R1I : SCHEMA_STANDARD;
    const classe = (n) => { for (const [g, re] of schema) if (re.test(n)) return g; return 'struttura'; };

    // orientamento comune: lato piedi verso -x (il R1 Industriale è disegnato al contrario)
    const boxDi = (o) => new THREE.Box3().setFromObject(o);
    rig.updateMatrixWorld(true);
    const tutto = boxDi(sorgente);
    const bf = new THREE.Box3(); pezzi.filter((p) => classe(p.name) === 'footbar').forEach((p) => bf.union(boxDi(p)));
    if (!bf.isEmpty() && bf.getCenter(new THREE.Vector3()).x > tutto.getCenter(new THREE.Vector3()).x) sorgente.rotation.y = Math.PI;
    rig.updateMatrixWorld(true);
    const box = boxDi(sorgente);
    sorgente.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    rig.updateMatrixWorld(true);
    const dim = boxDi(sorgente);

    // gruppi; la footbar ruota attorno al suo perno di snodo
    const G = {};
    GRUPPI.forEach((k) => { G[k] = new THREE.Group(); G[k].name = k; rig.add(G[k]); });
    const bp = new THREE.Box3();
    pezzi.filter((p) => /Perno_snodo|Mozzo_snodo|^E03_Perno/.test(p.name)).forEach((p) => bp.union(boxDi(p)));
    if (bp.isEmpty()) { const b = new THREE.Box3(); pezzi.filter((p) => classe(p.name) === 'footbar').forEach((p) => b.union(boxDi(p))); if (!b.isEmpty()) bp.set(new THREE.Vector3(b.min.x, b.min.y, b.min.z), new THREE.Vector3(b.max.x, b.min.y + 0.04, b.max.z)); }
    if (!bp.isEmpty()) { bp.getCenter(G.footbar.position); G.footbar.position.z = 0; }
    rig.updateMatrixWorld(true);
    pezzi.forEach((p) => G[classe(p.name)].attach(p));
    rig.updateMatrixWorld(true);
    GRUPPI.forEach((k) => { G[k].userData.base = G[k].position.clone(); });

    // molle: si allungano col carrello, ancorate al lato piedi (x minima)
    const molle = [], collari = [];
    G.molle.children.slice().forEach((p) => {
      const b = boxDi(p);
      if (/Collare|Anello_colore/.test(p.name)) { collari.push(p); return; }
      if (!/Molla|Cordino|^D0\d_/.test(p.name)) return;
      const perno = new THREE.Group();
      perno.position.set(b.min.x, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      G.molle.add(perno); rig.updateMatrixWorld(true);
      perno.attach(p);
      molle.push({ perno, lung: Math.max(b.max.x - b.min.x, 0.05), meta: (b.min.x + b.max.x) / 2 });
    });
    const mezzoMolle = molle.length ? molle.reduce((s, m) => s + m.meta, 0) / molle.length : 0;
    const collariMobili = collari.filter((c) => boxDi(c).getCenter(new THREE.Vector3()).x > mezzoMolle)
      .map((o) => ({ o, x0: o.position.x }));

    // montanti telescopici (solo se il progetto li ha: R3-Evo)
    const telescopico = G.montanti.children.some((p) => /^T09_Stelo/.test(p.name));
    const partiMontanti = telescopico
      ? G.montanti.children.filter((p) => /^(T09_Stelo|P06_|P01_|P05_|P03_)/.test(p.name)).map((o) => ({ o, y0: o.position.y }))
      : [];

    // corde dinamiche dalla puleggia allo strozzascotte (seguono carrello e montanti)
    const corde = [];
    const trova = (lista, lato) => { for (const re of lista) { const p = pezzi.find((x) => re.test(x.name) && x.name.includes(lato) && !/Guancia/.test(x.name)); if (p) return p; } return null; };
    ['SX', 'DX'].forEach((lato) => {
      const pul = trova([/^P01_Puleggia_alta/, /^P01_Puleggia_D72/, /^F01_Puleggia/, /^P01_Puleggia/], lato);
      const cleat = trova([/^C10_/, /^B12_Strozzascotte/], lato);
      const orig = trova([/^P02_Corda/, /^F03_Corda/], lato);
      if (!pul || !cleat || !orig) return;
      orig.visible = false;
      const segna = (pezzo) => { const m = new THREE.Object3D(); boxDi(pezzo).getCenter(m.position); rig.add(m); rig.updateMatrixWorld(true); pezzo.attach(m); return m; };
      const geo = new THREE.CylinderGeometry(0.004, 0.004, 1, 8); geo.translate(0, 0.5, 0);
      let mat = null; orig.traverse((o) => { if (o.isMesh && !mat) mat = o.material; });
      const mesh = new THREE.Mesh(geo, mat || new THREE.MeshStandardMaterial({ color: 0x111111 }));
      mesh.castShadow = true;
      corde.push({ a: segna(pul), b: segna(cleat), m: mesh });
    });

    // materiali (per le finiture) e ombre
    const materiali = {};
    rig.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material;
      if (!materiali[m.name]) { materiali[m.name] = m; m.userData.origine = m.color.clone(); }
    });
    const molleMat = Object.values(materiali).filter((m) => /molla_(rossa|verde|blu|gialla)/i.test(m.name));

    // ombra di contatto
    const ombra = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x1b1520, alphaMap: sfumatura, transparent: true, opacity: 0.42, depthWrite: false }));
    ombra.rotation.x = -Math.PI / 2; ombra.position.y = 0.002;
    ombra.scale.set((dim.max.x - dim.min.x) * 1.25, (dim.max.z - dim.min.z) * 1.6, 1);
    rig.add(ombra);

    // punti delle etichette nella vista esplosa
    rig.updateMatrixWorld(true);
    const ancore = {};
    GRUPPI.forEach((k) => {
      if (!G[k].children.length) return;
      const b = boxDi(G[k]); const p = b.getCenter(new THREE.Vector3()); p.y = b.max.y;
      ancore[k] = G[k].worldToLocal(p);
    });
    const haAnello = G.basamento.children.some((p) => /^L0\d/.test(p.name));

    return { mod, rig, G, molle, collariMobili, partiMontanti, telescopico, corde, materiali, molleMat, ancore, haAnello, pezzi: pezzi.length };
  };

  /* ---------------- Testi della pagina dal modello ---------------- */
  const KICKER = { design: '01 <i>//</i> Design', carrello: '02 <i>//</i> Carrello', molle: '03 <i>//</i> Resistenza', footbar: '04 <i>//</i> Footbar', montanti: '05 <i>//</i> Montanti', esploso: '06 <i>//</i> Costruzione', finiture: '07 <i>//</i> Finiture' };
  const numero = (v) => /^\d+$/.test(v);
  const titolo = (righe, cls = '') => `<h2 class="titolo ${cls}">${righe.map((r) => `<span><em>${r}</em></span>`).join(' ')}</h2>`;
  const dati = (d) => d && d.length ? `<ul class="dati">${d.map(([v, l]) => `<li><b>${v.split('–').map((x) => numero(x) ? `<span data-conta="${x}">0</span>` : x).join('–')}</b><small>${l}</small></li>`).join('')}</ul>` : '';
  const kicker = (k, mod) => `<p class="kicker">${KICKER[k]} <span class="kicker-modello">· ${mod.nome}</span></p>`;

  const scriviTesti = (mod) => {
    document.getElementById('hero-nome').textContent = mod.nome;
    document.title = `Tekkfit Pilates · Reformer ${mod.nome}`;
    const q = (k) => document.querySelector(`[data-sezione="${k}"]`);
    ['design', 'carrello', 'footbar', 'montanti'].forEach((k) => {
      const c = mod[k];
      q(k).innerHTML = kicker(k, mod) + titolo(c.titolo) + `<p class="corpo">${c.corpo}</p>` + dati(c.dati);
    });
    q('molle').innerHTML = kicker('molle', mod) + titolo(mod.molle.titolo) + `<p class="corpo">${mod.molle.corpo}</p>` +
      `<ul class="molle-chip">${mod.molle.chip.map(([c, v, n]) => `<li><i style="--c:${c}"></i>${v}${n ? `<small>${n}</small>` : ''}</li>`).join('')}</ul>`;
    q('esploso').innerHTML = kicker('esploso', mod) + titolo(['Ogni pezzo', 'ha un nome.']) + `<p class="corpo">${mod.esploso.corpo}</p>`;
    const piu = mod.finiture.length > 1;
    q('finiture').innerHTML = kicker('finiture', mod) + titolo(piu ? ['Scegli', 'il tuo studio.'] : ['Una finitura,', 'pensata così.']) +
      `<p class="corpo">${piu ? `${mod.finiture.length} abbinamenti di legno, metallo e rivestimento. Toccane uno e guarda il reformer cambiare.` : `Questo progetto nasce in una sola finitura. Le varianti di colore sono nei modelli R2 Signature e R3-Evo.`}</p>` +
      `<div class="finiture" role="radiogroup" aria-label="Finitura">${mod.finiture.map((f, i) => `<button role="radio" aria-checked="${i === 0}" data-fin="${f.id}"><i style="--a:${f.a};--b:${f.b}"></i><span>${f.nome}</span></button>`).join('')}</div>`;
    q('specifiche').innerHTML = `<p class="kicker">08 <i>//</i> Specifiche di progetto <span class="kicker-modello">· ${mod.nome}</span></p>` + titolo(['In numeri.']) +
      `<dl class="griglia">${mod.specifiche.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>` +
      `<p class="nota">Specifiche del progetto esecutivo. Il prototipo è in sviluppo: misure e finiture possono cambiare prima della produzione.</p>`;
    document.querySelectorAll('.carta').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.id === mod.id)));
    sceltaEl.value = mod.id;
  };

  // carte della collezione e selettore
  const sceltaEl = document.getElementById('scelta-modello');
  const statoEl = document.getElementById('scelta-stato');
  sceltaEl.innerHTML = MODELLI.map((m) => `<option value="${m.id}">${m.nome}</option>`).join('');
  document.getElementById('carte').innerHTML = MODELLI.map((m) => `
    <button class="carta" role="radio" aria-checked="false" data-id="${m.id}">
      <b>${m.nome}</b>
      <span class="carta-riga">${m.riga}</span>
      <span class="carta-misure">${m.misure}</span>
    </button>`).join('');

  /* ---------------- Stato e inquadrature ---------------- */
  // p = posizione camera, t = punto guardato (metri, reformer centrato: piedi a -x, testa a +x)
  // sx = spostamento orizzontale su desktop (+ = a destra); dy = verticale su desktop; sy = verticale su telefono
  const NEUTRO = { carr: 0, foot: 0, slide: 0, riser: 0, explode: 0, glow: 0, dy: 0 };
  const KEY = {
    hero:       { px: 2.3,  py: 1.45, pz: 3.7,  tx: 0,     ty: 0.26, tz: 0, sx: 0,     sy: 0.02, rot: 0 },
    collezione: { px: 3.4,  py: 2.3,  pz: 4.8,  tx: 0,     ty: 0.3,  tz: 0, sx: 0.2,   sy: -0.03, rot: -0.5, dy: 0.06 },
    design:     { px: 0.0,  py: 0.36, pz: 6.4,  tx: 0,     ty: 0.3,  tz: 0, sx: 0.17,  sy: 0.2,  rot: 0 },
    carrello:   { px: -1.7, py: 1.9,  pz: 4.3,  tx: 0.2,   ty: 0.3,  tz: 0, sx: -0.19, sy: 0.2,  rot: 0 },
    molle:      { px: 0.6,  py: 2.1,  pz: 1.5,  tx: -0.6,  ty: 0.3,  tz: 0, sx: 0.2,   sy: 0.22, rot: 0 },
    footbar:    { px: -3.3, py: 1.2,  pz: 2.5,  tx: -0.7,  ty: 0.42, tz: 0, sx: -0.2,  sy: 0.22, rot: 0 },
    montanti:   { px: 3.7,  py: 1.3,  pz: 1.1,  tx: 0.9,   ty: 0.5,  tz: 0, sx: 0.26,  sy: 0.22, rot: 0 },
    esploso:    { px: 3.6,  py: 2.4,  pz: 5.2,  tx: 0,     ty: 0.72, tz: 0, sx: 0.15,  sy: 0.18, rot: 0 },
    finiture:   { px: 2.9,  py: 1.6,  pz: 4.0,  tx: 0,     ty: 0.28, tz: 0, sx: 0.2,   sy: 0.24, rot: 0 },
    specifiche: { px: 0.3,  py: 3.6,  pz: 3.2,  tx: 0,     ty: 0.1,  tz: 0, sx: 0,     sy: 0,    rot: Math.PI * 2 },
    contatti:   { px: -3.2, py: 1.5,  pz: 4.2,  tx: 0,     ty: 0.5,  tz: 0, sx: 0.24,  sy: 0.3,  rot: Math.PI * 2 + 0.5 },
  };
  const S = { ...NEUTRO, ...KEY.hero, intro: 0 };

  const AZIONI = {
    carrello(tl, t0, d) {
      tl.to(S, { carr: 0.62, duration: d * 0.45, ease: 'power2.inOut' }, t0)
        .to(S, { px: -0.9, tx: 0.6, duration: d * 0.45, ease: 'power2.inOut' }, t0)
        .to(S, { carr: 0.12, duration: d * 0.4, ease: 'power2.inOut' }, t0 + d * 0.55)
        .to(S, { px: -1.5, tx: 0.25, duration: d * 0.4, ease: 'power2.inOut' }, t0 + d * 0.55);
    },
    molle(tl, t0, d) {
      tl.to(S, { glow: 1, duration: d * 0.25 }, t0)
        .to(S, { carr: 0.5, duration: d * 0.4, ease: 'power2.inOut' }, t0 + d * 0.1)
        .to(S, { py: 1.5, pz: 1.7, duration: d * 0.7, ease: 'power1.inOut' }, t0 + d * 0.1)
        .to(S, { carr: 0.05, glow: 0.4, duration: d * 0.4, ease: 'power2.inOut' }, t0 + d * 0.55);
    },
    footbar(tl, t0, d) {
      tl.to(S, { foot: -0.42, duration: d * 0.25, ease: 'power2.inOut' }, t0)
        .to(S, { foot: 0.26, duration: d * 0.3, ease: 'power2.inOut' }, t0 + d * 0.27)
        .to(S, { foot: 0, slide: 0.21, duration: d * 0.25, ease: 'power2.inOut' }, t0 + d * 0.6)
        .to(S, { px: -2.8, pz: 3.0, duration: d * 0.9 }, t0)
        .to(S, { slide: 0.08, duration: d * 0.15, ease: 'power2.inOut' }, t0 + d * 0.85);
    },
    montanti(tl, t0, d) {
      tl.to(S, { riser: 0.18, duration: d * 0.45, ease: 'power2.inOut' }, t0)
        .to(S, { py: 1.55, ty: 0.62, pz: 1.5, duration: d * 0.6, ease: 'power1.inOut' }, t0)
        .to(S, { riser: 0.06, duration: d * 0.35, ease: 'power2.inOut' }, t0 + d * 0.6);
    },
    esploso(tl, t0, d) {
      tl.to(S, { explode: 1, duration: d * 0.55, ease: 'power2.inOut' }, t0)
        .to(S, { px: 2.8, pz: 5.6, duration: d, ease: 'none' }, t0);
    },
    finiture(tl, t0, d) {
      tl.to(S, { rot: Math.PI * 2, duration: d, ease: 'none' }, t0);
    },
  };

  /* ---------------- Timeline legata allo scroll ---------------- */
  let tl, st;
  const sezioni = [...document.querySelectorAll('[data-k]')];
  const costruisci = () => {
    const vh = innerHeight;
    const tot = document.documentElement.scrollHeight - vh;
    const progressoPrima = st ? st.progress : 0;
    if (st) st.kill();
    if (tl) tl.kill();
    Object.assign(S, NEUTRO, KEY.hero);
    tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    sezioni.forEach((sec, i) => {
      const k = sec.dataset.k;
      const top = sec.getBoundingClientRect().top + scrollY;
      const durata = Math.max(sec.offsetHeight - vh, vh * 0.3);
      if (i > 0) tl.to(S, { ...NEUTRO, ...KEY[k], duration: vh * 0.85, ease: 'power2.inOut' }, Math.max(0, top - vh));
      if (AZIONI[k]) AZIONI[k](tl, top, durata);
    });
    tl.set({}, {}, tot);
    st = ScrollTrigger.create({ start: 0, end: tot, scrub: RIDOTTO ? true : 0.9, animation: tl });
    tl.progress(progressoPrima);
  };

  /* ---------------- Modello attivo ---------------- */
  const cache = {};
  let R = null;            // modello attrezzato attivo
  let inCorso = null;

  const applicaFinitura = (finId) => {
    if (!R) return;
    const f = R.mod.finiture.find((x) => x.id === finId) || R.mod.finiture[0];
    for (const [n, m] of Object.entries(R.materiali)) {
      const o = m.userData.origine;
      const c = f.c[n] || [o.r, o.g, o.b];
      gsap.to(m.color, { r: c[0], g: c[1], b: c[2], duration: RIDOTTO ? 0 : 0.9, ease: 'power2.out' });
    }
    document.querySelectorAll('.finiture button').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.fin === f.id)));
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.finiture button');
    if (b) applicaFinitura(b.dataset.fin);
    const c = e.target.closest('.carta');
    if (c) attiva(c.dataset.id);
  });
  sceltaEl.addEventListener('change', () => attiva(sceltaEl.value));

  const etichetteEl = document.getElementById('etichette');
  const NOMI_GRUPPI = { carrello: 'Carrello', molle: 'Molle', footbar: 'Footbar', montanti: 'Montanti e pulegge', pedana: 'Pedana', struttura: 'Telaio in acciaio', basamento: 'Basamento' };
  let etichette = [];
  const creaEtichette = () => {
    etichetteEl.innerHTML = '';
    etichette = Object.entries(R.ancore).map(([k, locale]) => {
      const el = document.createElement('div');
      el.className = 'etichetta';
      const testo = k === 'basamento' ? (R.haAnello ? 'Anello e basamento' : 'Gambe e piedini') : NOMI_GRUPPI[k];
      el.innerHTML = `<span>${testo}</span>`;
      etichetteEl.appendChild(el);
      return { el, g: R.G[k], locale };
    });
  };

  let ctxTesti = null;
  const attiva = async (id, primo = false) => {
    const mod = perId[id] || MODELLI[0];
    if (R && R.mod.id === mod.id) return;
    inCorso = mod.id;
    sceltaEl.disabled = true; statoEl.textContent = 'Carico…';
    try {
      if (!cache[mod.id]) cache[mod.id] = attrezza(await carica(mod, primo ? progresso : null), mod);
    } catch (err) {
      console.error('Modello non caricato', mod.id, err);
      statoEl.textContent = 'Non caricato';
      sceltaEl.disabled = false; sceltaEl.value = R ? R.mod.id : mod.id;
      if (primo) document.querySelector('.loader-txt').textContent = 'Il modello 3D non si è caricato. Ricarica la pagina.';
      return;
    }
    if (inCorso !== mod.id) return;   // nel frattempo è stato scelto un altro modello
    if (R) { reformer.remove(R.rig); R.corde.forEach((c) => scene.remove(c.m)); }
    R = cache[mod.id];
    reformer.add(R.rig);
    R.corde.forEach((c) => scene.add(c.m));
    creaEtichette();

    if (ctxTesti) ctxTesti.revert();
    scriviTesti(mod);
    applicaFinitura(mod.finiture[0].id);
    ctxTesti = gsap.context(animaTesti);
    ScrollTrigger.refresh();
    costruisci();
    sceltaEl.disabled = false; statoEl.textContent = '';
    try { const u = new URL(location.href); u.searchParams.set('modello', mod.id); history.replaceState(null, '', u); } catch (e) { /* file:// */ }
    if (!primo && !RIDOTTO) gsap.fromTo(reformer.scale, { x: 0.92, y: 0.92, z: 0.92 }, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power3.out' });
  };

  /* ---------------- Applicazione stato al modello ---------------- */
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), su = new THREE.Vector3(0, 1, 0);
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  const puntatore = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => {
    puntatore.x = (e.clientX / innerWidth - 0.5) * 2;
    puntatore.y = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  const ESPLOSO = {
    struttura: [0, 0.32, 0], basamento: [0, 0, 0], molle: [0, 0.6, 0], carrello: [0.08, 0.95, 0],
    footbar: [-0.3, 1.0, 0], montanti: [0.3, 0.45, 0], pedana: [-0.22, 0.55, 0],
  };

  const applica = (tempo) => {
    const w = innerWidth, h = innerHeight, tel = telefono();
    const aspetto = w / h;
    const k = aspetto >= 1.25 ? 1 : Math.min(2.0, Math.pow(1.25 / aspetto, 0.58));
    puntatore.sx += (puntatore.x - puntatore.sx) * 0.05;
    puntatore.sy += (puntatore.y - puntatore.sy) * 0.05;
    const par = tel || RIDOTTO ? 0 : 0.12;
    camera.position.set(
      S.tx + (S.px - S.tx) * k + puntatore.sx * par,
      S.ty + (S.py - S.ty) * k - puntatore.sy * par * 0.6,
      S.tz + (S.pz - S.tz) * k
    );
    camera.lookAt(S.tx, S.ty, S.tz);
    const lato = affiancato();
    camera.setViewOffset(w, h, lato ? -S.sx * w : 0, lato ? -S.dy * h : Math.min(0.3, S.sy * 1.35) * h, w, h);

    const inHero = Math.max(0, 1 - scrollY / (h * 0.8));
    const oscilla = RIDOTTO ? 0 : Math.sin(tempo * 0.35) * 0.12 * inHero;
    reformer.rotation.y = S.rot + oscilla - (1 - S.intro) * 0.9;
    reformer.position.y = -(1 - S.intro) * 0.25;
    if (!R) return;

    for (const [n, g] of Object.entries(R.G)) {
      const e = ESPLOSO[n]; const b = g.userData.base;
      g.position.set(b.x + e[0] * S.explode, b.y + e[1] * S.explode, b.z + e[2] * S.explode);
    }
    R.G.carrello.position.x += S.carr;
    if (R.mod.footbar.slitta) R.G.footbar.position.x += S.slide;
    R.G.footbar.rotation.z = S.foot;

    for (const m of R.molle) m.perno.scale.x = (m.lung + S.carr) / m.lung;
    for (const c of R.collariMobili) c.o.position.x = c.x0 + S.carr;
    for (const p of R.partiMontanti) p.o.position.y = p.y0 + S.riser;
    for (const m of R.molleMat) m.emissive.copy(m.color).multiplyScalar(S.glow * 0.9);

    reformer.updateMatrixWorld(true);
    for (const c of R.corde) {
      c.a.getWorldPosition(pa); c.b.getWorldPosition(pb);
      v.subVectors(pb, pa); const L = v.length();
      c.m.position.copy(pa);
      c.m.quaternion.copy(q.setFromUnitVectors(su, v.normalize()));
      c.m.scale.set(1, L, 1);
      c.m.visible = S.explode < 0.05;
    }

    const vis = gsap.utils.clamp(0, 1, (S.explode - 0.6) / 0.3);
    for (const e of etichette) {
      if (vis <= 0) { e.el.style.opacity = 0; continue; }
      v.copy(e.locale).applyMatrix4(e.g.matrixWorld).project(camera);
      const mezzo = (e.el.offsetWidth || 120) / 2 + 8;
      const x = gsap.utils.clamp(mezzo, w - mezzo, (v.x * 0.5 + 0.5) * w), y = Math.max(tel ? 104 : 120, (-v.y * 0.5 + 0.5) * h);
      e.el.style.opacity = vis;
      e.el.style.transform = `translate(${x}px, ${y - 18}px) translate(-50%, -100%)`;
    }
  };

  const ridimensiona = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  ridimensiona();

  const orologio = new THREE.Clock();
  gsap.ticker.add(() => {
    applica(orologio.getElapsedTime());
    renderer.render(scene, camera);
  });

  /* ---------------- Testi che si muovono con lo scroll ---------------- */
  // eseguita dentro gsap.context: a ogni cambio modello si annulla e si ricrea
  function animaTesti() {
    gsap.to('.hero-titolo .r1', { xPercent: -28, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-titolo .r2', { xPercent: 30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-testi, .scorri', { y: -80, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: true } });

    document.querySelectorAll('.ch').forEach((sec) => {
      const testo = sec.querySelector('.ch-testo');
      const parole = sec.querySelectorAll('.titolo em');
      const resto = sec.querySelectorAll('.kicker, .corpo, .dati li, .molle-chip li, .finiture button');
      const entra = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top 10%', scrub: 0.6 } });
      entra.from(parole, { yPercent: 115, skewY: 7, stagger: 0.12, ease: 'power3.out' })
           .from(resto, { y: 40, opacity: 0, stagger: 0.06, ease: 'power2.out' }, 0.15);
      gsap.to(testo, { y: -90, opacity: 0, ease: 'power1.in', scrollTrigger: { trigger: sec, start: 'bottom 85%', end: 'bottom 35%', scrub: 0.6 } });
    });

    document.querySelectorAll('.collezione, .specifiche, .contatti').forEach((sec) => {
      gsap.from(sec.querySelectorAll('.titolo em'), { yPercent: 115, skewY: 7, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top 30%', scrub: 0.6 } });
      gsap.from(sec.querySelectorAll('.kicker, .corpo, .griglia > div, .azioni, .nota, .carta'), { y: 40, opacity: 0, stagger: 0.04, scrollTrigger: { trigger: sec, start: 'top 75%', end: 'top 15%', scrub: 0.6 } });
    });

    document.querySelectorAll('[data-conta]').forEach((el) => {
      const fine = +el.dataset.conta; const o = { n: 0 };
      gsap.to(o, {
        n: fine, ease: 'power1.out', onUpdate: () => { el.textContent = Math.round(o.n); },
        scrollTrigger: { trigger: el.closest('section'), start: 'top 70%', end: 'top 5%', scrub: 0.6 },
      });
    });

    document.querySelectorAll('.nastro').forEach((n) => {
      const inv = n.classList.contains('nastro-inverso');
      gsap.fromTo(n.querySelector('.nastro-in'), { xPercent: inv ? -45 : 0 }, { xPercent: inv ? 0 : -45, ease: 'none', scrollTrigger: { trigger: n, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    const numEl = document.getElementById('cap-num'), nomeEl = document.getElementById('cap-nome'), barEl = document.getElementById('cap-fill');
    let attivo = -1;
    const aggiornaCapitolo = () => {
      const meta = scrollY + innerHeight / 2;
      let i = 0;
      sezioni.forEach((sec, j) => { if (sec.getBoundingClientRect().top + scrollY <= meta) i = j; });
      if (i === attivo) return;
      attivo = i;
      const sec = sezioni[i];
      numEl.textContent = String(i).padStart(2, '0');
      nomeEl.textContent = sec.dataset.cap;
      document.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('attivo', a.getAttribute('href') === '#' + sec.id));
    };
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { barEl.style.width = (s.progress * 100).toFixed(1) + '%'; aggiornaCapitolo(); }, onRefresh: aggiornaCapitolo });
    aggiornaCapitolo();
  }

  /* ---------------- Scroll morbido ---------------- */
  let lenis = null;
  if (!RIDOTTO && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const dest = id === '#top' ? 0 : document.querySelector(id);
      if (dest === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(dest, { duration: 1.6 });
      else if (dest === 0) scrollTo({ top: 0 });
      else dest.scrollIntoView();
    });
  });

  /* ---------------- Avvio ---------------- */
  let iniziale = 'r3-evo';
  try { iniziale = new URL(location.href).searchParams.get('modello') || iniziale; } catch (e) { /* ok */ }
  await attiva(perId[iniziale] ? iniziale : 'r3-evo', true);

  let ultimo = { w: innerWidth, h: innerHeight }, timer;
  addEventListener('resize', () => {
    ridimensiona();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (Math.abs(innerWidth - ultimo.w) < 2 && Math.abs(innerHeight - ultimo.h) < 140) return;
      ultimo = { w: innerWidth, h: innerHeight };
      ScrollTrigger.refresh();
      costruisci();
    }, 200);
  });

  progresso(1);
  setTimeout(() => {
    loaderEl.classList.add('via');
    setTimeout(() => { loaderEl.style.display = 'none'; }, 900);
    document.body.classList.remove('caricamento');
    gsap.to(S, { intro: 1, duration: RIDOTTO ? 0 : 2.2, ease: 'power3.out' });
    gsap.from('.hero-titolo .riga', { yPercent: 40, opacity: 0, duration: RIDOTTO ? 0 : 1.4, stagger: 0.12, ease: 'power3.out' });
    gsap.from('.hero-testi > *', { y: 30, opacity: 0, duration: RIDOTTO ? 0 : 1, stagger: 0.1, delay: 0.5, ease: 'power2.out' });
  }, 250);

  // per verifiche dalla console
  window.__reformer = { S, camera, renderer, cache, get R() { return R; }, attiva };
})();
