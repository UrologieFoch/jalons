/* Jalons : moteur de calcul.
   Aucune règle clinique ici. Les règles vivent dans protocols/, un fichier par pathologie.
   Chargé par index.html (navigateur) et par tests/run.js (Node), sans dépendance. */
(function (root) {
  "use strict";

  /* ---------- Dates (calendrier local, sans fuseau) ---------- */
  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 12); // midi : à l'abri des changements d'heure
  }
  function isoOf(date) {
    const p = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }
  // Ajoute n mois en restant dans le mois cible (31 janvier + 1 mois = 28 ou 29 février).
  function addMonths(date, n) {
    const y = date.getFullYear(), m = date.getMonth() + n, d = date.getDate();
    const last = new Date(y, m + 1, 0, 12).getDate();
    return new Date(y, m, Math.min(d, last), 12);
  }
  function addDays(date, n) { const r = new Date(date); r.setDate(r.getDate() + n); return r; }
  function todayISO() { return isoOf(new Date()); }
  function daysBetween(fromISO, toISO) { return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86400000); }

  /* ---------- Repères temporels d'un contrôle ----------
     Un contrôle est placé soit en mois (m), soit en semaines (w) après l'intervention. */
  function offsetMonths(e) { return e.w != null ? e.w * 7 / 30.4375 : e.m; }
  function labelOf(e) {
    if (e.w != null) return `S${e.w}`;
    if (e.m >= 12 && e.m % 12 === 0) return `A${e.m / 12}`;
    return `M${e.m}`;
  }
  function keyOf(e) { return e.w != null ? `w${e.w}` : `m${e.m}`; }

  /* ---------- Registre ---------- */
  const PROTOCOLS = {};
  const REQUIRED = ["id", "name", "short", "version", "source", "local", "fields", "plan"];

  function registerProtocol(def) {
    for (const k of REQUIRED) {
      if (def[k] == null) throw new Error(`Protocole ${def.id || "sans id"} : « ${k} » manquant`);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(def.id)) throw new Error(`Protocole ${def.id} : identifiant invalide`);
    if (PROTOCOLS[def.id]) throw new Error(`Protocole ${def.id} déclaré deux fois`);
    if (typeof def.plan !== "function") throw new Error(`Protocole ${def.id} : plan doit être une fonction`);
    for (const [k, g] of Object.entries(def.programs || {})) {
      if (!g.name || typeof g.plan !== "function") throw new Error(`Protocole ${def.id} : programme ${k} incomplet`);
    }
    PROTOCOLS[def.id] = Object.assign({ dateLabel: "Date de l'intervention", validated: false }, def);
  }

  function optionValue(o) { return Array.isArray(o) ? o[0] : o; }
  function optionText(o) { return Array.isArray(o) ? o[1] : o; }
  function defaults(id) {
    const out = {};
    for (const [key, , options, def] of PROTOCOLS[id].fields) out[key] = def != null ? def : optionValue(options[0]);
    return out;
  }

  /* ---------- Calendrier ----------
     Applique le protocole, date chaque contrôle, puis coupe à l'âge d'arrêt choisi
     par le praticien (réglage, pas une recommandation). */
  function buildPlan(id, params, dateISO, age, stopAge) {
    const proto = PROTOCOLS[id];
    if (!proto) throw new Error(`Protocole inconnu : ${id}`);
    const p = Object.assign(defaults(id), params);
    const res = proto.plan(p, { age: Number(age) });
    const start = parseISO(dateISO);
    const limit = Number(stopAge) || Infinity;

    const sorted = [...res.ev].sort((a, b) => offsetMonths(a) - offsetMonths(b));
    const events = [];
    for (const e of sorted) {
      const om = offsetMonths(e);
      const ageThen = Number(age) + om / 12;
      const date = isoOf(e.w != null ? addDays(start, e.w * 7) : addMonths(start, e.m));
      if (ageThen > limit) {
        events.push({
          key: "fin", stop: true, date, phase: e.phase, label: "Fin",
          title: `Fin du suivi systématique à ${Math.floor(ageThen)} ans`,
          exam: "Âge d'arrêt choisi dans les réglages. Suivi ensuite sur point d'appel ou décision individuelle.",
          short: ""
        });
        break;
      }
      events.push({ key: keyOf(e), m: e.m, w: e.w, label: labelOf(e), date, phase: e.phase, title: e.title, exam: e.exam, short: e.short, done: false });
    }
    return { chips: res.chips, why: res.why, alerts: res.alerts, meta: res.meta || {}, events };
  }

  /* ---------- Programmes de traitement (instillations) ----------
     Un protocole peut déclarer des programmes (BCG, chimiothérapie) dont le calendrier part
     de la date de la première administration, saisie sur la fiche patient.
     Un événement de programme : { base (jours), m (mois), d (jours), ... } ; date = début + base,
     + m mois (recalé sur le même jour de la semaine si sameWeekday), + d jours. */
  function programsFor(id, meta) {
    const pr = PROTOCOLS[id];
    if (!pr || !pr.programs) return [];
    return Object.entries(pr.programs)
      .filter(([, g]) => !g.available || g.available(meta || {}))
      .map(([k, g]) => Object.assign({ id: k }, g));
  }
  function programDefaults(id, progId, meta) {
    const g = PROTOCOLS[id].programs[progId];
    const out = {};
    for (const [key, , options, def] of (g.fields || [])) out[key] = def != null ? def : optionValue(options[0]);
    return Object.assign(out, g.defaults ? g.defaults(meta || {}) : {});
  }
  function sameWeekdayNear(date, weekday) {
    const delta = (weekday - date.getDay() + 7) % 7;
    return addDays(date, delta <= 3 ? delta : delta - 7);
  }
  function buildProgram(id, progId, opts, startISO, meta) {
    const g = PROTOCOLS[id] && PROTOCOLS[id].programs && PROTOCOLS[id].programs[progId];
    if (!g) throw new Error(`Programme inconnu : ${id}/${progId}`);
    const o = Object.assign(programDefaults(id, progId, meta), opts);
    const start = parseISO(startISO);
    const events = g.plan(o).map(e => {
      const base = addDays(start, e.base || 0);
      let at = addMonths(base, e.m || 0);
      if (g.sameWeekday && e.m) at = sameWeekdayNear(at, base.getDay());
      return {
        key: `${progId}-b${e.base || 0}-m${e.m || 0}-d${e.d || 0}`,
        date: isoOf(addDays(at, e.d || 0)),
        label: e.label, phase: e.phase, title: e.title, exam: e.exam, short: e.short,
        kind: "instil", done: false
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    return { options: o, events };
  }

  root.Jalons = Object.assign(root.Jalons || {}, {
    parseISO, isoOf, addMonths, addDays, todayISO, daysBetween,
    offsetMonths, labelOf, keyOf,
    PROTOCOLS, registerProtocol, defaults, optionValue, optionText, buildPlan,
    programsFor, programDefaults, buildProgram
  });
})(typeof window !== "undefined" ? window : globalThis);
