/* Jalons : interface.
   Données stockées uniquement dans ce navigateur (localStorage). Aucune requête réseau.
   Les événements exportés vers un agenda ne portent qu'un code opaque, jamais le repère du patient. */
(function () {
  "use strict";
  const J = window.Jalons;
  const KEY = "jalons-v1";
  const app = document.getElementById("app");

  /* ===================== Outils ===================== */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => J.todayISO();
  const dueIn = iso => J.daysBetween(today(), iso);
  const protoName = id => (J.PROTOCOLS[id] ? J.PROTOCOLS[id].name : `Protocole retiré (${id})`);
  const protoShort = id => (J.PROTOCOLS[id] ? J.PROTOCOLS[id].short : id);

  function fmtLong(iso) { return J.parseISO(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  function fmtShort(iso) {
    const d = J.parseISO(iso), opts = { day: "numeric", month: "short" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("fr-FR", opts);
  }
  function monthTitle(iso) {
    const s = J.parseISO(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function dueTag(iso) {
    const n = dueIn(iso);
    if (n < 0) return `<span class="tag late">${-n} j de retard</span>`;
    if (n === 0) return `<span class="tag soon">Aujourd'hui</span>`;
    if (n <= 30) return `<span class="tag soon">Dans ${n} j</span>`;
    return "";
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ===================== Données ===================== */
  let db = { v: 1, patients: [], settings: { stopAge: 85, lockId: null } };
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.patients)) db = { v: 1, patients: d.patients, settings: Object.assign({ stopAge: 85, lockId: null }, d.settings) };
    } catch (e) {
      // Données illisibles : on les met de côté au lieu de les écraser.
      try { localStorage.setItem(KEY + "-illisible-" + Date.now(), raw); } catch (_) { /* rien */ }
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast("Enregistrement impossible sur cet appareil."); return false; }
  }
  load();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I/L
  function newCode() {
    for (;;) {
      const r = crypto.getRandomValues(new Uint8Array(4));
      const code = "J-" + Array.from(r, x => ALPHABET[x % ALPHABET.length]).join("");
      if (!db.patients.some(p => p.code === code)) return code;
    }
  }
  const newId = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(3)), x => x.toString(16).padStart(2, "0")).join("");
  const pending = p => p.events.filter(e => !e.done && !e.stop);
  const nextOf = p => pending(p).sort((a, b) => a.date.localeCompare(b.date))[0];
  const findPatient = id => db.patients.find(p => p.id === id);

  /* ===================== Blocs d'affichage ===================== */
  function chipsHTML(chips) {
    return `<ul class="chips">${chips.map(c => `<li class="chip ${c.tone || ""}">${esc(c.text)}</li>`).join("")}</ul>`;
  }
  function notesHTML(alerts) {
    if (!alerts.length) return "";
    return `<div class="notes">${alerts.map(a => `<div class="note ${a.tone === "alert" ? "alert" : "info"}">${a.lead ? `<strong>${esc(a.lead)}</strong> : ` : ""}${esc(a.text)}</div>`).join("")}</div>`;
  }

  // Frise : un point par contrôle, l'échelle en années depuis l'intervention.
  function friseHTML(events, startISO) {
    const evs = events.filter(e => !e.stop);
    if (!evs.length) return "";
    const W = 340, H = 62, PAD = 10, Y = 22;
    const om = e => J.daysBetween(startISO, e.date) / 30.4375;
    const lastM = Math.max(...events.map(om), 12);
    const years = Math.ceil(lastM / 12);
    const span = years * 12;
    const x = m => PAD + (W - 2 * PAD) * (m / span);
    const step = years <= 6 ? 1 : years <= 15 ? 2 : 5;
    let svg = `<line class="base" x1="${PAD}" y1="${Y}" x2="${W - PAD}" y2="${Y}"/>`;
    for (let y = 0; y <= years; y += step) {
      svg += `<line class="tick" x1="${x(y * 12)}" y1="${Y - 8}" x2="${x(y * 12)}" y2="${Y + 8}"/><text class="yr" x="${x(y * 12)}" y="${Y + 24}">${y === 0 ? "J0" : "A" + y}</text>`;
    }
    const t = today();
    let late = 0, done = 0;
    for (const e of evs) {
      const cls = e.done ? "done" : (e.date < t ? "late" : "next");
      if (cls === "late") late++; if (cls === "done") done++;
      svg += `<circle class="dot ${cls}" cx="${x(om(e)).toFixed(1)}" cy="${Y}" r="5"/>`;
    }
    const stop = events.find(e => e.stop);
    if (stop) svg += `<rect class="dot stop" x="${(x(om(stop)) - 4).toFixed(1)}" y="${Y - 4}" width="8" height="8"/>`;
    const nowM = J.daysBetween(startISO, t) / 30.4375;
    if (nowM >= 0 && nowM <= span) {
      svg += `<line class="now" x1="${x(nowM).toFixed(1)}" y1="${Y - 14}" x2="${x(nowM).toFixed(1)}" y2="${Y + 10}"/>`;
    }
    const label = `${evs.length} contrôles sur ${years} an${years > 1 ? "s" : ""}, ${done} fait${done > 1 ? "s" : ""}, ${late} en retard.`;
    return `<div class="frise"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${svg}</svg>
      <p class="frise-cap">${esc(label)}</p><div class="legend"><span class="l-next">À venir</span><span class="l-late">En retard</span><span class="l-done">Fait</span></div></div>`;
  }

  /* ===================== Vue : agenda ===================== */
  function rowHTML(x) {
    const d = J.parseISO(x.e.date);
    const mo = d.toLocaleDateString("fr-FR", { month: "short" }) + (d.getFullYear() !== new Date().getFullYear() ? " " + String(d.getFullYear()).slice(2) : "");
    return `<li><a class="item" href="#p-${esc(x.p.id)}">
      <span class="when-big"><span class="d">${d.getDate()}</span><span class="mo">${esc(mo)}</span></span>
      <span class="what"><span class="who">${esc(x.p.ref)}</span><span class="ex">${esc(protoShort(x.p.op))}, ${esc(x.e.short)}</span></span>
      ${dueTag(x.e.date)}</a></li>`;
  }

  function viewAgenda() {
    if (!db.patients.length) {
      app.innerHTML = `
        <header><h1>Agenda</h1><p class="sub">Les contrôles à venir de tous vos patients.</p></header>
        <section class="card stack">
          <p>Aucun patient suivi pour l'instant.</p>
          <p class="hint">Saisissez une intervention : Jalons calcule le calendrier de surveillance selon la recommandation et vous rappelle chaque contrôle.</p>
          <div class="actions"><a class="btn primary" href="#nouveau">Créer un premier suivi</a></div>
        </section>`;
      return;
    }
    const items = [];
    for (const p of db.patients) for (const e of pending(p)) items.push({ p, e, n: dueIn(e.date) });
    items.sort((a, b) => a.e.date.localeCompare(b.e.date));
    const late = items.filter(x => x.n < 0);
    const soon = items.filter(x => x.n >= 0 && x.n <= 30);
    const later = items.filter(x => x.n > 30 && x.n <= 183);

    let laterHTML = "";
    let month = "";
    for (const x of later) {
      const m = monthTitle(x.e.date);
      if (m !== month) { laterHTML += `${month ? "</ul>" : ""}<h3 class="month">${esc(m)}</h3><ul class="list">`; month = m; }
      laterHTML += rowHTML(x);
    }
    if (month) laterHTML += "</ul>";

    const n = db.patients.length;
    app.innerHTML = `
      <header><h1>Agenda</h1><p class="sub">${n} patient${n > 1 ? "s" : ""} suivi${n > 1 ? "s" : ""}.</p></header>
      <section class="card"><h2>En retard</h2>${late.length ? `<ul class="list">${late.map(rowHTML).join("")}</ul>` : `<p class="empty">Aucun contrôle en retard.</p>`}</section>
      <section class="card"><h2>Dans les 30 jours</h2><p class="sub">Ordonnances et rendez-vous à préparer.</p>${soon.length ? `<ul class="list">${soon.map(rowHTML).join("")}</ul>` : `<p class="empty">Rien à préparer ce mois-ci.</p>`}</section>
      <section class="card"><h2>Les 6 mois suivants</h2>${later.length ? laterHTML : `<p class="empty">Aucun contrôle prévu.</p>`}</section>`;
  }

  /* ===================== Vue : patients ===================== */
  let query = "";
  function patientsListHTML() {
    const q = query.trim().toLowerCase();
    const list = db.patients
      .filter(p => !q || p.ref.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .map(p => ({ p, next: nextOf(p) }))
      .sort((a, b) => (a.next ? a.next.date : "9999").localeCompare(b.next ? b.next.date : "9999"));
    if (!list.length) return `<p class="empty">${db.patients.length ? "Aucun patient ne correspond." : "Aucun patient pour l'instant."}</p>`;
    return `<ul class="list">${list.map(({ p, next }) => {
      const lateN = pending(p).filter(e => dueIn(e.date) < 0).length;
      return `<li><a class="item" href="#p-${esc(p.id)}">
        <span class="when-big">${next ? `<span class="d">${J.parseISO(next.date).getDate()}</span><span class="mo">${esc(J.parseISO(next.date).toLocaleDateString("fr-FR", { month: "short" }))}</span>` : `<span class="mo">Terminé</span>`}</span>
        <span class="what"><span class="who">${esc(p.ref)}</span><span class="ex">${esc(protoShort(p.op))}, opéré le ${esc(fmtShort(p.date))}</span></span>
        ${lateN ? `<span class="tag late">${lateN} en retard</span>` : ""}</a></li>`;
    }).join("")}</ul>`;
  }
  function viewPatients() {
    app.innerHTML = `
      <header><h1>Patients</h1><p class="sub">Classés par prochain contrôle.</p></header>
      <section class="card">
        <label class="search">Rechercher<input id="q" type="search" value="${esc(query)}" placeholder="Repère ou code agenda" autocomplete="off"></label>
        <div id="plist">${patientsListHTML()}</div>
      </section>`;
    document.getElementById("q").addEventListener("input", e => { query = e.target.value; document.getElementById("plist").innerHTML = patientsListHTML(); });
  }

  /* ===================== Vue : nouveau suivi ===================== */
  const firstProto = () => Object.keys(J.PROTOCOLS)[0];
  let draft = { op: firstProto(), params: {}, ref: "", age: "", date: today() };

  function draftAge() {
    const a = Number(draft.age);
    return Number.isInteger(a) && a >= 18 && a <= 110 ? a : null;
  }
  function draftPlan() {
    const age = draftAge();
    if (age == null || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return null;
    return J.buildPlan(draft.op, draft.params, draft.date, age, db.settings.stopAge);
  }
  function previewHTML() {
    const plan = draftPlan();
    if (!plan) return `<p class="empty">Renseignez l'âge et la date pour voir le calendrier.</p>`;
    const evs = plan.events.filter(e => !e.stop);
    const stop = plan.events.find(e => e.stop);
    return `<h2>Calendrier proposé</h2>${chipsHTML(plan.chips)}<p class="why">${esc(plan.why)}</p>${notesHTML(plan.alerts)}
      ${friseHTML(plan.events, draft.date)}
      <p class="hint">${evs.length} contrôle${evs.length > 1 ? "s" : ""}, du ${esc(fmtLong(evs[0].date))} au ${esc(fmtLong(evs[evs.length - 1].date))}.${stop ? ` Arrêt du suivi systématique à ${esc(db.settings.stopAge)} ans (réglage).` : ""}</p>`;
  }
  function fieldsHTML() {
    const proto = J.PROTOCOLS[draft.op];
    draft.params = Object.assign(J.defaults(draft.op), draft.params);
    return proto.fields.map(([key, label, options]) => `
      <label>${esc(label)}<select data-k="${esc(key)}">${options.map(o => {
        const v = J.optionValue(o);
        return `<option value="${esc(v)}"${String(draft.params[key]) === String(v) ? " selected" : ""}>${esc(J.optionText(o))}</option>`;
      }).join("")}</select></label>`).join("");
  }
  function viewNew() {
    if (!J.PROTOCOLS[draft.op]) draft.op = firstProto();
    const proto = J.PROTOCOLS[draft.op];
    app.innerHTML = `
      <header><h1>Nouveau suivi</h1><p class="sub">Choisissez l'intervention, puis renseignez le compte rendu.</p></header>
      <section class="card">
        <div class="choice" role="group" aria-label="Intervention">${Object.values(J.PROTOCOLS).map(pr => `<button type="button" data-op="${esc(pr.id)}" aria-pressed="${pr.id === draft.op}">${esc(pr.short)}</button>`).join("")}</div>
        <div class="grid">
          <label>Repère patient<input id="f-ref" value="${esc(draft.ref)}" maxlength="24" autocomplete="off" autocapitalize="characters" placeholder="ex. JD 58"></label>
          <label>Âge à l'intervention<input id="f-age" type="number" inputmode="numeric" min="18" max="110" value="${esc(draft.age)}"></label>
          <label class="wide">${esc(proto.dateLabel)}<input id="f-date" type="date" value="${esc(draft.date)}"></label>
        </div>
        <p class="hint">Un repère suffit : initiales, numéro interne. Évitez le nom complet et la date de naissance.</p>
      </section>
      <section class="card"><h2>Compte rendu</h2><div class="grid">${fieldsHTML()}</div></section>
      <section class="card" id="preview" aria-live="polite">${previewHTML()}</section>
      <div class="actions"><button class="btn primary" id="f-save" type="button">Enregistrer le suivi</button></div>`;

    const refresh = () => { document.getElementById("preview").innerHTML = previewHTML(); };
    app.querySelectorAll("[data-op]").forEach(b => b.addEventListener("click", () => { draft.op = b.dataset.op; draft.params = {}; viewNew(); }));
    app.querySelectorAll("select[data-k]").forEach(s => s.addEventListener("change", () => { draft.params[s.dataset.k] = s.value; refresh(); }));
    document.getElementById("f-ref").addEventListener("input", e => { draft.ref = e.target.value; });
    document.getElementById("f-age").addEventListener("input", e => { draft.age = e.target.value; refresh(); });
    document.getElementById("f-date").addEventListener("input", e => { draft.date = e.target.value; refresh(); });
    document.getElementById("f-save").addEventListener("click", saveDraft);
  }
  function saveDraft() {
    const ref = draft.ref.trim();
    if (!ref) { toast("Ajoutez un repère patient."); document.getElementById("f-ref").focus(); return; }
    const age = draftAge();
    if (age == null) { toast("Âge à l'intervention : entre 18 et 110 ans."); document.getElementById("f-age").focus(); return; }
    const plan = draftPlan();
    if (!plan) { toast("Vérifiez la date."); return; }
    const p = {
      id: newId(), code: newCode(), ref, age, op: draft.op, date: draft.date,
      params: Object.assign({}, draft.params), protocolVersion: J.PROTOCOLS[draft.op].version,
      stopAge: db.settings.stopAge, events: plan.events, created: today()
    };
    db.patients.push(p);
    if (!save()) { db.patients.pop(); return; }
    draft = { op: draft.op, params: {}, ref: "", age: "", date: today() };
    toast("Suivi enregistré.");
    location.hash = "#p-" + p.id;
  }

  /* ===================== Vue : fiche patient ===================== */
  function viewPatient(id) {
    const p = findPatient(id);
    if (!p) { location.hash = "#patients"; return; }
    const proto = J.PROTOCOLS[p.op];
    const plan = proto ? J.buildPlan(p.op, p.params, p.date, p.age, p.stopAge || db.settings.stopAge) : null;
    const versionNote = proto && proto.version !== p.protocolVersion
      ? `<div class="note info">Protocole mis à jour depuis la saisie (version ${esc(p.protocolVersion)} vers ${esc(proto.version)}). Le calendrier enregistré est conservé ; pour appliquer la nouvelle version, ressaisissez le patient.</div>` : "";

    let list = "", phase = null;
    p.events.forEach((e, i) => {
      if (e.phase !== phase) { phase = e.phase; list += `<div class="phase">${esc(phase)}</div>`; }
      list += `<div class="ev${e.done ? " done" : ""}${e.stop ? " stop" : ""}">
        ${e.stop ? "<span></span>" : `<input type="checkbox" data-i="${i}"${e.done ? " checked" : ""} aria-label="${esc(e.title)} du ${esc(fmtLong(e.date))} fait">`}
        <span class="what"><span class="when">${esc(fmtShort(e.date))} <small>${esc(e.label)}</small> ${!e.done && !e.stop ? dueTag(e.date) : ""}</span><strong>${esc(e.title)}</strong><span class="ex">${esc(e.exam)}</span></span>
      </div>`;
    });

    app.innerHTML = `
      <a class="back" href="#patients">Patients</a>
      <header>
        <h1>${esc(p.ref)}</h1>
        <p class="sub">${esc(protoName(p.op))} le ${esc(fmtLong(p.date))}, ${esc(p.age)} ans.</p>
        <p class="code">Code agenda <b>${esc(p.code)}</b>, seul identifiant exporté.</p>
      </header>
      <section class="card">${plan ? chipsHTML(plan.chips) + `<p class="why">${esc(plan.why)}</p>` + notesHTML(plan.alerts) : `<div class="note info">Ce protocole n'existe plus dans cette version de l'app. Le calendrier enregistré reste affiché.</div>`}${versionNote ? `<div class="notes">${versionNote}</div>` : ""}${friseHTML(p.events, p.date)}</section>
      <section class="card"><h2>Calendrier</h2>${list}</section>
      <section class="card stack">
        <h2>Rappels</h2>
        <p class="sub">Exporte les contrôles à venir vers l'agenda du téléphone ou de l'ordinateur, avec une alerte 30 jours avant chacun. Les événements ne portent que le code ${esc(p.code)}.</p>
        <div class="actions"><button class="btn primary" id="ics" type="button">Exporter vers l'agenda</button></div>
      </section>
      <div id="del-zone" class="actions"><button class="btn danger" id="del" type="button">Supprimer ce patient</button></div>`;

    app.querySelectorAll("input[data-i]").forEach(c => c.addEventListener("change", () => {
      p.events[Number(c.dataset.i)].done = c.checked;
      save(); viewPatient(id);
    }));
    document.getElementById("ics").addEventListener("click", () => exportICS(p));
    document.getElementById("del").addEventListener("click", () => {
      document.getElementById("del-zone").innerHTML = `<div class="confirm"><span>Supprimer définitivement ${esc(p.ref)} et son calendrier ?</span>
        <div class="actions"><button class="btn danger" id="del-yes" type="button">Supprimer</button><button class="btn" id="del-no" type="button">Annuler</button></div></div>`;
      document.getElementById("del-yes").addEventListener("click", () => {
        db.patients = db.patients.filter(x => x.id !== p.id); save(); toast("Patient supprimé."); location.hash = "#patients";
      });
      document.getElementById("del-no").addEventListener("click", () => viewPatient(id));
    });
  }

  /* ===================== Export agenda (.ics) ===================== */
  function icsText(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsFold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const parts = []; let cur = "", len = 0;
    for (const ch of line) {
      const l = enc.encode(ch).length;
      if (len + l > (parts.length ? 74 : 75)) { parts.push(cur); cur = ""; len = 0; }
      cur += ch; len += l;
    }
    parts.push(cur);
    return parts.join("\r\n ");
  }
  function exportICS(p) {
    const evs = pending(p).filter(e => dueIn(e.date) >= 0);
    if (!evs.length) { toast("Aucun contrôle à venir à exporter."); return; }
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ymd = iso => iso.replace(/-/g, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jalons//Suivi urologique//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const e of evs) {
      const end = J.isoOf(J.addDays(J.parseISO(e.date), 1));
      lines.push(
        "BEGIN:VEVENT",
        `UID:${p.id}-${e.key}@jalons`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(e.date)}`,
        `DTEND;VALUE=DATE:${ymd(end)}`,
        `SUMMARY:${icsText(`Jalons ${p.code} : ${e.short}`)}`,
        `DESCRIPTION:${icsText(`${e.title}. ${e.exam} Patient : code ${p.code} dans Jalons.`)}`,
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(`Préparer ordonnance et rendez-vous, ${p.code}`)}`, "TRIGGER:-P30D", "END:VALARM",
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    download(`jalons-${p.code}.ics`, lines.map(icsFold).join("\r\n") + "\r\n", "text/calendar");
  }

  async function download(name, text, type) {
    const blob = new Blob([text], { type });
    const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.canShare) {
      try {
        const file = new File([blob], name, { type });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ===================== Sauvegarde chiffrée ===================== */
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  function toB64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function fromB64(str) { const s = atob(str), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  async function deriveKey(pass, salt, iter) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptBackup(pass) {
    const salt = rand(16), iv = rand(12), iter = 310000;
    const key = await deriveKey(pass, salt, iter);
    const plain = new TextEncoder().encode(JSON.stringify({ patients: db.patients, settings: { stopAge: db.settings.stopAge } }));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
    return JSON.stringify({ app: "Jalons", format: "sauvegarde-chiffree", v: 1, kdf: "PBKDF2-SHA256", iter, salt: toB64(salt), iv: toB64(iv), data: toB64(data) });
  }
  async function decryptBackup(text, pass) {
    const f = JSON.parse(text);
    if (f.app !== "Jalons" || f.format !== "sauvegarde-chiffree") throw new Error("format");
    const key = await deriveKey(pass, fromB64(f.salt), f.iter);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(f.iv) }, key, fromB64(f.data));
    const d = JSON.parse(new TextDecoder().decode(plain));
    if (!Array.isArray(d.patients)) throw new Error("contenu");
    return d;
  }

  /* ===================== Verrouillage (WebAuthn) =====================
     Demande Touch ID, Face ID ou le code de l'appareil à l'ouverture et après 1 minute en arrière-plan.
     C'est un verrou d'écran : la protection de fond reste le code du téléphone. */
  async function lockAvailable() {
    try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
    catch (e) { return false; }
  }
  async function enableLock() {
    if (!(await lockAvailable())) { toast("Verrouillage biométrique indisponible sur cet appareil ou ce navigateur."); return; }
    try {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: rand(32),
        rp: { name: "Jalons", id: location.hostname },
        user: { id: rand(16), name: "jalons", displayName: "Jalons" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000
      } });
      db.settings.lockId = toB64(new Uint8Array(cred.rawId)); save();
      toast("Verrouillage activé."); viewSettings();
    } catch (e) { toast("Activation annulée."); }
  }
  let unlocking = false;
  async function unlock() {
    if (unlocking) return; unlocking = true;
    const msg = document.getElementById("lock-msg");
    try {
      const a = await navigator.credentials.get({ publicKey: {
        challenge: rand(32), rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: fromB64(db.settings.lockId) }],
        userVerification: "required", timeout: 60000
      } });
      const flags = new Uint8Array(a.response.authenticatorData)[32];
      if (!(flags & 0x04)) throw new Error("vérification absente");
      setLocked(false);
    } catch (e) {
      msg.textContent = "Échec ou annulation. Appuyez sur Déverrouiller pour réessayer.";
    }
    unlocking = false;
  }
  function setLocked(on) {
    document.getElementById("lock").hidden = !on;
    app.hidden = on; document.getElementById("tabs").hidden = on;
  }
  function showLock() {
    if (!db.settings.lockId) return;
    document.getElementById("lock-msg").textContent = "Déverrouillez avec Touch ID, Face ID ou le code de l'appareil.";
    setLocked(true); unlock();
  }
  document.getElementById("lock-btn").addEventListener("click", unlock);
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 60000 && document.getElementById("lock").hidden) showLock();
  });

  /* ===================== Vue : réglages ===================== */
  function viewSettings() {
    app.innerHTML = `
      <header><h1>Réglages</h1></header>
      <section class="card stack">
        <h2>Âge d'arrêt du suivi systématique</h2>
        <p class="sub">Choix du praticien, non issu des recommandations. S'applique aux nouveaux patients.</p>
        <label>Âge (ans)<input id="s-stop" type="number" inputmode="numeric" min="60" max="110" value="${esc(db.settings.stopAge)}"></label>
      </section>
      <section class="card stack">
        <h2>Verrouillage</h2>
        <p class="sub">${db.settings.lockId ? "Activé : Touch ID, Face ID ou le code de l'appareil sont demandés à l'ouverture et après 1 minute en arrière-plan." : "Demande Touch ID, Face ID ou le code de l'appareil à chaque ouverture. La protection de fond reste le code du téléphone."}</p>
        <div class="actions">${db.settings.lockId ? `<button class="btn danger" id="s-lock-off" type="button">Désactiver</button>` : `<button class="btn primary" id="s-lock-on" type="button">Activer</button>`}</div>
      </section>
      <section class="card stack">
        <h2>Sauvegarde chiffrée</h2>
        <p class="sub">Les données restent sur cet appareil : effacer les données du navigateur efface tout. Exportez régulièrement. Le fichier est chiffré ; sans le mot de passe, il est illisible, y compris pour vous.</p>
        <label>Mot de passe (8 caractères minimum)<input id="bk-pass" type="password" autocomplete="new-password"></label>
        <div class="actions"><button class="btn primary" id="bk-export" type="button">Exporter la sauvegarde</button></div>
        <label>Fichier de sauvegarde<input id="bk-file" type="file" accept=".json,application/json"></label>
        <label>Mot de passe de ce fichier<input id="bk-pass2" type="password" autocomplete="current-password"></label>
        <div class="actions"><button class="btn" id="bk-import" type="button">Restaurer</button></div>
        <div id="bk-confirm"></div>
      </section>
      <section class="card">
        <h2>Protocoles</h2>
        ${Object.values(J.PROTOCOLS).map(pr => `<div class="proto"><b>${esc(pr.name)}</b>, version ${esc(pr.version)}, ${pr.validated ? "validé" : "non validé"}
          <p><b>Source.</b> ${esc(pr.source)}</p><p><b>Choix locaux.</b> ${esc(pr.local)}</p></div>`).join("")}
      </section>
      <section class="card stack">
        <h2>À propos</h2>
        <p class="sub">Jalons organise le suivi ; il ne remplace pas la décision clinique. Les protocoles doivent être relus et validés avant tout usage en soins. Aucune donnée ne quitte l'appareil, sauf les fichiers que vous exportez vous-même.</p>
      </section>`;

    document.getElementById("s-stop").addEventListener("change", e => {
      const v = Number(e.target.value);
      if (!Number.isInteger(v) || v < 60 || v > 110) { toast("Âge d'arrêt : entre 60 et 110 ans."); e.target.value = db.settings.stopAge; return; }
      db.settings.stopAge = v; save(); toast("Réglage enregistré.");
    });
    const on = document.getElementById("s-lock-on"), off = document.getElementById("s-lock-off");
    if (on) on.addEventListener("click", enableLock);
    if (off) off.addEventListener("click", () => { db.settings.lockId = null; save(); toast("Verrouillage désactivé."); viewSettings(); });

    document.getElementById("bk-export").addEventListener("click", async () => {
      const pass = document.getElementById("bk-pass").value;
      if (pass.length < 8) { toast("Mot de passe trop court : 8 caractères minimum."); return; }
      try {
        const text = await encryptBackup(pass);
        document.getElementById("bk-pass").value = "";
        await download(`jalons-sauvegarde-${today()}.json`, text, "application/json");
      } catch (e) { toast("Export impossible sur ce navigateur."); }
    });
    document.getElementById("bk-import").addEventListener("click", async () => {
      const f = document.getElementById("bk-file").files[0];
      const pass = document.getElementById("bk-pass2").value;
      if (!f) { toast("Choisissez le fichier de sauvegarde."); return; }
      let data;
      try { data = await decryptBackup(await f.text(), pass); }
      catch (e) { toast("Mot de passe incorrect ou fichier non reconnu."); return; }
      const zone = document.getElementById("bk-confirm");
      zone.innerHTML = `<div class="confirm"><span>Remplacer les ${db.patients.length} patients de cet appareil par les ${data.patients.length} de la sauvegarde ?</span>
        <div class="actions"><button class="btn danger" id="bk-yes" type="button">Remplacer</button><button class="btn" id="bk-no" type="button">Annuler</button></div></div>`;
      document.getElementById("bk-yes").addEventListener("click", () => {
        db.patients = data.patients;
        if (data.settings && data.settings.stopAge) db.settings.stopAge = data.settings.stopAge;
        save(); toast(`${data.patients.length} patients restaurés.`); location.hash = "#agenda";
      });
      document.getElementById("bk-no").addEventListener("click", () => { zone.innerHTML = ""; });
    });
  }

  /* ===================== Navigation ===================== */
  function route() {
    const h = location.hash.replace(/^#/, "") || "agenda";
    const tab = h.startsWith("p-") ? "patients" : h;
    document.querySelectorAll("#tabs a").forEach(a => {
      if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (h.startsWith("p-")) viewPatient(h.slice(2));
    else if (h === "patients") viewPatients();
    else if (h === "nouveau") viewNew();
    else if (h === "reglages") viewSettings();
    else viewAgenda();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", e => { if (e.key === KEY) { load(); route(); } });

  route();
  showLock();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
