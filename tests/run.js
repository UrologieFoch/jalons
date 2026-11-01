/* Tests de Jalons. Depuis le dossier de l'app :  node tests/run.js
   Aucune dépendance. À relancer après toute modification d'un protocole ou du moteur.
   Les calendriers attendus sont écrits à la main depuis les recommandations, jamais recopiés
   depuis le code : c'est ce qui permet de détecter une règle mal codée. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");

/* Charge le moteur et les protocoles déclarés dans index.html, dans le même ordre (sans l'interface). */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const ctx = {}; vm.createContext(ctx);
for (const f of scripts.filter(s => s !== "js/app.js")) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const J = ctx.Jalons;

/* ---------- Outils ---------- */
let pass = 0, fail = 0;
function check(name, ok, detail) { if (ok) { pass++; return; } fail++; console.log(`ÉCHEC  ${name}${detail ? "\n       " + detail : ""}`); }
const seq = (a, b, step) => { const r = []; for (let m = a; m <= b; m += step) r.push(m); return r; };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const diff = (got, exp) => `attendu ${JSON.stringify(exp)}\n       obtenu  ${JSON.stringify(got)}`;
const run = (op, params, age = 65) => J.PROTOCOLS[op].plan(Object.assign(J.defaults(op), params), { age });
const sorted = r => [...r.ev].sort((a, b) => J.offsetMonths(a) - J.offsetMonths(b));
const months = r => sorted(r).filter(e => e.m != null).map(e => e.m);
const weeks = r => sorted(r).filter(e => e.w != null).map(e => e.w);
const group = r => r.chips[1].text;
const alertText = r => r.alerts.map(a => (a.lead ? a.lead + " : " : "") + a.text).join(" | ");

/* ---------- 1. Fichiers déclarés partout ---------- */
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
for (const f of [...scripts, "css/app.css", "manifest.webmanifest"]) check(`${f} listé dans sw.js`, sw.includes(`"${f}"`));
for (const f of scripts) check(`${f} existe`, fs.existsSync(path.join(ROOT, f)));

/* ---------- 2. Moteur ---------- */
check("31 janvier + 1 mois = 28 février", J.isoOf(J.addMonths(J.parseISO("2026-01-31"), 1)) === "2026-02-28");
check("31 janvier 2028 + 1 mois = 29 février (bissextile)", J.isoOf(J.addMonths(J.parseISO("2028-01-31"), 1)) === "2028-02-29");
check("15 mars + 12 mois = 15 mars suivant", J.isoOf(J.addMonths(J.parseISO("2026-03-15"), 12)) === "2027-03-15");
check("Écart en jours, passage à l'heure d'été", J.daysBetween("2026-03-28", "2026-03-30") === 2);
check("Libellés M3, A2, S4", J.labelOf({ m: 3 }) === "M3" && J.labelOf({ m: 24 }) === "A2" && J.labelOf({ w: 4 }) === "S4");

/* ---------- 3. Structure : tous les protocoles, toutes les combinaisons ---------- */
function combos(fields) {
  let out = [{}];
  for (const [k, , opts] of fields) out = out.flatMap(c => opts.map(o => ({ ...c, [k]: J.optionValue(o) })));
  return out;
}
for (const pr of Object.values(J.PROTOCOLS)) {
  for (const [k, , opts, def] of pr.fields) check(`${pr.id} : défaut de « ${k} » parmi les options`, opts.map(J.optionValue).includes(def));
  let n = 0, bad = 0;
  for (const p of combos(pr.fields)) for (const age of [40, 70, 95]) {
    n++;
    const r = pr.plan(p, { age });
    const keys = r.ev.map(J.keyOf), offs = r.ev.map(J.offsetMonths);
    const txt = JSON.stringify(r);
    const problems = [];
    if (new Set(keys).size !== keys.length) problems.push("deux contrôles au même moment");
    if (!offs.every(o => o > 0)) problems.push("contrôle à J0 ou avant");
    if (/undefined|NaN/.test(txt)) problems.push("texte undefined ou NaN");
    if (!r.ev.every(e => e.title && e.exam && e.phase && e.short)) problems.push("contrôle incomplet");
    if (!r.chips.length || !r.chips.every(c => c.text) || typeof r.why !== "string") problems.push("résumé incomplet");
    if (!r.alerts.every(a => a.text && (a.tone === "alert" || a.tone === "info"))) problems.push("alerte mal formée");
    const plan = J.buildPlan(pr.id, p, "2026-06-15", age, 85);
    if (plan.events.filter(e => e.stop).length > 1) problems.push("plusieurs marqueurs de fin");
    if (problems.length) { bad++; if (bad <= 3) check(`${pr.id} ${JSON.stringify(p)} ${age} ans`, false, problems.join(", ")); }
  }
  check(`${pr.id} : ${n} combinaisons sans anomalie`, bad === 0, `${bad} combinaisons en anomalie`);
}

/* ---------- 4. TVNIM, CCAFU 2024-2026, tableaux III et IV ----------
   Patient de 65 ans : suivi « à vie » borné techniquement à 110 ans, soit M540. */
const LOW = [3, ...seq(12, 60, 12)];
const MID = [3, ...seq(6, 24, 6), ...seq(36, 120, 12)];
const HIGH = (cap = 540) => [...seq(3, 24, 3), ...seq(30, 60, 6), ...seq(72, cap, 12)];

const TV = [
  // [cas, saisie, groupe attendu, mois attendus, semaines attendues, contrôles supplémentaires]
  ["pTa BG unifocale < 3 cm, primo", {}, "Faible risque", LOW, [],
    r => [["pas de cytologie", r.ev.every(e => !e.short.includes("cyto"))], ["pas d'uro-TDM", r.ev.every(e => !e.short.includes("uro-TDM"))], ["IPOP seule", alertText(r).includes("IPOP")]]],
  ["faible risque, tabagisme actif", { tabac: "oui" }, "Faible risque", [...LOW, ...seq(72, 540, 12)], [],
    r => [["phase tabac après 5 ans", r.ev.filter(e => e.m > 60).every(e => e.phase.includes("tabagisme"))]]],
  ["récidive pTa BG", { ctx: "rec" }, "Risque intermédiaire", MID, [],
    r => [["cytologie à chaque contrôle", r.ev.every(e => e.short.includes("cyto"))], ["surveillance active évoquée", alertText(r).includes("surveillance active")]]],
  ["pTa BG multifocale", { nb: "multi" }, "Risque intermédiaire", MID, []],
  ["pTa BG de 3 cm ou plus", { taille: "ge3" }, "Risque intermédiaire", MID, []],
  ["intermédiaire, tabagisme actif", { nb: "multi", tabac: "oui" }, "Risque intermédiaire", [...MID, ...seq(132, 540, 12)], []],
  ["pTa HG", { grade: "hg" }, "Haut risque", HIGH(), [],
    r => [["uro-TDM aux dates anniversaires seulement", r.ev.every(e => e.short.includes("uro-TDM") === (e.m % 12 === 0))], ["réévaluation à envisager", alertText(r).includes("niveau de preuve 4")]]],
  ["pT1 BG", { stade: "pT1" }, "Haut risque", HIGH(), [4],
    r => [["S4 = RTUV de réévaluation", (sorted(r)[0] || {}).title === "RTUV de réévaluation"]]],
  ["pT1 HG unifocal < 3 cm sans CIS", { stade: "pT1", grade: "hg" }, "Haut risque", HIGH(), [4]],
  ["pT1 HG avec CIS", { stade: "pT1", grade: "hg", cis: "oui" }, "Très haut risque", HIGH(), [4],
    r => [["cystectomie et RCP", alertText(r).includes("cystectomie") && alertText(r).includes("RCP")], ["reclassement possible", alertText(r).includes("Reclassement")], ["biopsies à M3", (r.ev.find(e => e.m === 3) || { exam: "" }).exam.includes("biopsies")]]],
  ["pT1 HG multifocal", { stade: "pT1", grade: "hg", nb: "multi" }, "Très haut risque", HIGH(), [4]],
  ["pT1 HG de 3 cm ou plus", { stade: "pT1", grade: "hg", taille: "ge3" }, "Très haut risque", HIGH(), [4]],
  ["pT1 HG avec emboles", { stade: "pT1", grade: "hg", thr: "lvi" }, "Très haut risque", HIGH(), [4],
    r => [["reclassement possible", alertText(r).includes("Reclassement")]]],
  ["pT1 HG de l'urètre prostatique", { stade: "pT1", grade: "hg", thr: "up" }, "Très haut risque", HIGH(), [4],
    r => [["pas de reclassement", !alertText(r).includes("Reclassement")]]],
  ["pT1 BG de sous-type agressif", { stade: "pT1", thr: "st" }, "Très haut risque", HIGH(), [4]],
  ["emboles sur pT1 BG : non appliqué", { stade: "pT1", thr: "lvi" }, "Haut risque", HIGH(), [4],
    r => [["mention « non appliqué »", r.why.includes("pas appliqué")]]],
  ["emboles saisis sur pTa BG : non appliqué", { thr: "lvi" }, "Faible risque", LOW, [],
    r => [["mention « non appliqué »", r.why.includes("non appliqué")]]],
  ["CIS isolé", { stade: "cis" }, "Haut risque", HIGH(), [],
    r => [["biopsies à M3", (r.ev.find(e => e.m === 3) || { exam: "" }).exam.includes("biopsies")]]],
  ["détrusor absent", { rtuv: "nodet" }, "Faible risque", LOW, [4],
    r => [["S4 = RTUV complémentaire", (sorted(r)[0] || {}).title === "RTUV complémentaire"], ["groupe provisoire", alertText(r).includes("provisoire")]]],
  ["récidive HG après BCG", { ctx: "recbcg", stade: "pT1", grade: "hg" }, "Haut risque", HIGH(), [4],
    r => [["critères de non-réponse", alertText(r).includes("non-réponse")]]],
  ["récidive BG après BCG", { ctx: "recbcg" }, "Risque intermédiaire", MID, [],
    r => [["nouveau schéma d'instillations", alertText(r).includes("bas grade après BCG")]]]
];
for (const [name, params, grp, expM, expW, extra] of TV) {
  const r = run("tvnim", params);
  check(`TVNIM ${name} : groupe`, group(r) === grp, `attendu ${grp}, obtenu ${group(r)}`);
  check(`TVNIM ${name} : mois`, same(months(r), expM), diff(months(r), expM));
  check(`TVNIM ${name} : semaines`, same(weeks(r), expW), diff(weeks(r), expW));
  if (extra) for (const [label, ok] of extra(r)) check(`TVNIM ${name} : ${label}`, ok);
}

/* ---------- 5. Prostatectomie, CCAFU 2024-2026 ----------
   Premier PSA dans les 3 mois (placé à S6), puis tous les 6 mois pendant 3 à 5 ans, puis annuel. */
const PR = [
  ["par défaut : semestriel 5 ans puis annuel à vie", {}, [...seq(6, 60, 6), ...seq(72, 540, 12)],
    r => [["premier PSA à S6", same(weeks(r), [6])], ["pas d'alerte rouge", !r.alerts.some(a => a.tone === "alert")]]],
  ["semestriel 3 ans puis annuel jusqu'à 10 ans", { sem: "3", fin: "10" }, [...seq(6, 36, 6), ...seq(48, 120, 12)]],
  ["semestriel 4 ans puis annuel jusqu'à 15 ans", { sem: "4", fin: "15" }, [...seq(6, 48, 6), ...seq(60, 180, 12)]],
  ["marge R1 : alerte RCP", { marges: "R1" }, [...seq(6, 60, 6), ...seq(72, 540, 12)],
    r => [["alerte avec marge R1", r.alerts.some(a => a.tone === "alert" && a.lead.includes("marge R1") && a.text.includes("RCP"))]]],
  ["pT3b ISUP 5 pN1 : tous les facteurs listés", { pt: "pT3b", isup: "5", pn: "pN1" }, [...seq(6, 60, 6), ...seq(72, 540, 12)],
    r => [["facteurs listés", r.alerts[0].lead === "pT3b, ISUP 5, pN1"]]]
];
for (const [name, params, expM, extra] of PR) {
  const r = run("prostatectomie", params);
  check(`Prostatectomie ${name} : mois`, same(months(r), expM), diff(months(r), expM));
  if (extra) for (const [label, ok] of extra(r)) check(`Prostatectomie ${name} : ${label}`, ok);
}
{
  const r = run("prostatectomie", {}, 104);
  check("Prostatectomie 104 ans, à vie : schéma complet jusqu'à M120", same(months(r), [...seq(6, 60, 6), ...seq(72, 120, 12)]), diff(months(r), [...seq(6, 60, 6), ...seq(72, 120, 12)]));
}

/* ---------- 6. Calendrier daté et âge d'arrêt ---------- */
{
  const plan = J.buildPlan("tvnim", { grade: "hg" }, "2026-01-10", 80, 85);
  const due = plan.events.filter(e => !e.stop).map(e => e.m);
  check("Âge d'arrêt 85 ans, patient de 80 ans : contrôles jusqu'à M60", same(due, [...seq(3, 24, 3), ...seq(30, 60, 6)]), diff(due, [...seq(3, 24, 3), ...seq(30, 60, 6)]));
  const last = plan.events[plan.events.length - 1];
  check("Marqueur de fin à 86 ans", last.stop === true && last.title.includes("86 ans"), JSON.stringify(last));
  check("M3 = RTUV + 3 mois", plan.events[0].date === "2026-04-10", plan.events[0].date);
  const p2 = J.buildPlan("tvnim", { stade: "pT1" }, "2026-01-10", 60, 85);
  check("S4 = RTUV + 28 jours", p2.events[0].date === "2026-02-07" && p2.events[0].label === "S4", JSON.stringify(p2.events[0]));
  const p3 = J.buildPlan("prostatectomie", {}, "2026-01-31", 60, 85);
  check("Prostatectomie du 31 janvier : M6 le 31 juillet", (p3.events.find(e => e.m === 6) || {}).date === "2026-07-31");
  check("Clés uniques pour l'export agenda", new Set(p3.events.map(e => e.key)).size === p3.events.length);
}

/* ---------- 7. Programmes d'instillations (TVNIM), CCAFU 2024-2026 ----------
   Dates attendues calculées à la main (et vérifiées hors du code de l'app).
   Première instillation le lundi 2 février 2026 ; cycles recalés sur le lundi le plus proche. */
{
  const meta = g => ({ group: g });
  const ids = g => J.programsFor("tvnim", meta(g)).map(x => x.id).join(",");
  check("Faible risque : aucun programme d'instillation", ids("low") === "");
  check("Risque intermédiaire : BCG et mitomycine", ids("mid") === "bcg,chimio");
  check("Haut et très haut risque : BCG seul", ids("high") === "bcg" && ids("vhigh") === "bcg");
  check("Le protocole transmet son groupe de risque", J.buildPlan("tvnim", { grade: "hg" }, "2026-01-10", 60, 85).meta.group === "high");
  check("Entretien BCG par défaut : 1 an si intermédiaire, 3 ans sinon",
    J.programDefaults("tvnim", "bcg", meta("mid")).entretien === "12" && J.programDefaults("tvnim", "bcg", meta("high")).entretien === "36");

  const bcg1 = J.buildProgram("tvnim", "bcg", { entretien: "12" }, "2026-02-02", meta("mid")).events.map(e => e.date);
  const expBcg1 = ["2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23", "2026-03-02", "2026-03-09",
    "2026-05-04", "2026-05-11", "2026-05-18", "2026-08-03", "2026-08-10", "2026-08-17", "2027-02-01", "2027-02-08", "2027-02-15"];
  check("BCG 1 an : 6 inductions puis 3 instillations à M3, M6 et M12", same(bcg1, expBcg1), diff(bcg1, expBcg1));

  const bcg3 = J.buildProgram("tvnim", "bcg", { entretien: "36" }, "2026-02-02", meta("high")).events;
  check("BCG 3 ans : 27 instillations, dernier cycle à M36", bcg3.length === 27 && bcg3[24].date === "2029-02-05" && bcg3[26].date === "2029-02-19",
    `${bcg3.length} instillations, ${bcg3[24] && bcg3[24].date} à ${bcg3[26] && bcg3[26].date}`);
  check("BCG 3 ans : clés uniques pour l'export agenda", new Set(bcg3.map(e => e.key)).size === 27);
  check("BCG : toutes les instillations tombent un lundi", bcg3.every(e => J.parseISO(e.date).getDay() === 1));

  const mmc = J.buildProgram("tvnim", "chimio", {}, "2026-02-02", meta("mid")).events.map(e => e.date);
  const expMmc = ["2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23", "2026-03-02", "2026-03-09",
    "2026-04-20", "2026-05-18", "2026-06-22", "2026-07-20", "2026-08-17", "2026-09-21", "2026-10-19", "2026-11-23", "2026-12-21"];
  check("Mitomycine : 6 inductions, puis 9 mensuelles dès 6 semaines après la dernière induction", same(mmc, expMmc), diff(mmc, expMmc));

  const bcgDef = J.PROTOCOLS.tvnim.programs.bcg;
  check("Début BCG proposé : RTUV + 3 semaines, ou + 7 semaines si pT1",
    bcgDef.startWeeks(J.defaults("tvnim")) === 3 && bcgDef.startWeeks(Object.assign(J.defaults("tvnim"), { stade: "pT1" })) === 7);
}

console.log(`\n${pass} vérifications réussies, ${fail} échec${fail > 1 ? "s" : ""}.`);
process.exit(fail ? 1 : 0);
