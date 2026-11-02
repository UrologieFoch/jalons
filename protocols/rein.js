/* Cancer du rein localisé ou localement avancé : suivi après traitement.
   Source : CCAFU, actualisation 2024-2026, cancer du rein (Bigot P. et al., Prog Urol FMC 2024;34:F333-F393).
     Tableau III : classification UISS (stade T, grade de Fuhrman, ECOG).
     Tableau IV  : suivi postopératoire selon le risque UISS.
     Texte       : suivi après ablation thermique (3 mois, 6 mois, 1 an puis annuel) ;
                   fonction rénale et pression artérielle ; recommandation 21 (pembrolizumab adjuvant). */
(function () {
  const GROUPS = {
    low: { label: "Risque faible (UISS)", tone: "" },
    mid: { label: "Risque intermédiaire (UISS)", tone: "mid" },
    high: { label: "Risque élevé (UISS)", tone: "hi" }
  };

  // UISS standard pour les tumeurs N0M0 (le tableau III de la recommandation en est une forme condensée).
  function uiss(T, g, ecog) {
    if (T === 4) return "high";
    if (T === 1) return g <= 2 && ecog === 0 ? "low" : "mid";
    if (T === 2) return "mid";
    if (g === 1) return "mid";
    return ecog === 0 ? "mid" : "high";
  }

  Jalons.registerProtocol({
    id: "rein",
    name: "Cancer du rein localisé",
    short: "Rein",
    dateLabel: "Date du traitement",
    version: "1",
    validated: false,
    source: "CCAFU, actualisation 2024-2026, cancer du rein (Prog Urol FMC 2024;34:F333-F393). Risque : UISS (tableau III). Suivi après chirurgie : tableau IV. Après ablation thermique : imagerie à 3 mois, 6 mois, 1 an puis tous les ans. Adjuvant : recommandation 21.",
    local: "Tableau III imprimé sous forme condensée : algorithme UISS standard N0M0 appliqué. pN+ classé en risque élevé (UISS défini pour N0M0). Grade non pris en compte pour le chromophobe (traité comme bas grade). Risque faible lu comme M6, puis M12, M24, M36, ultime contrôle à M60. Durée du suivi annuel après ablation (non définie par la recommandation) choisie à la saisie. À valider.",
    fields: [
      ["trt", "Traitement", [["np", "Néphrectomie partielle"], ["ne", "Néphrectomie élargie"], ["ta", "Ablation thermique"]], "np"],
      ["histo", "Histologie", [["cc", "Cellules claires"], ["pap", "Papillaire"], ["chromo", "Chromophobe"], ["autre", "Autre"]], "cc"],
      ["pt", "Stade pT", ["pT1a", "pT1b", "pT2a", "pT2b", "pT3a", "pT3b", "pT3c", "pT4"], "pT1a"],
      ["g", "Grade (Fuhrman/ISUP)", ["1", "2", "3", "4"], "2"],
      ["ecog", "ECOG", [["0", "0"], ["1", "1 ou plus"]], "0"],
      ["pn", "Ganglions", [["n0", "pN0 ou pNx"], ["n1", "pN1"]], "n0"],
      ["sarco", "Composante sarcomatoïde", [["non", "Non"], ["oui", "Oui"]], "non"],
      ["fin", "Après ablation : suivi annuel", [["5", "Jusqu'à 5 ans"], ["10", "Jusqu'à 10 ans"]], "5"]
    ],

    plan(p) {
      const ablation = p.trt === "ta";
      const T = p.pt.startsWith("pT1") ? 1 : p.pt.startsWith("pT2") ? 2 : p.pt.startsWith("pT3") ? 3 : 4;
      const g = Number(p.g), ecog = Number(p.ecog);
      const gEff = p.histo === "chromo" ? 1 : g;
      const grp = p.pn === "n1" ? "high" : uiss(T, gEff, ecog);
      const histo = { cc: "cellules claires", pap: "papillaire", chromo: "chromophobe", autre: "autre histologie" }[p.histo];

      const chips = ablation
        ? [{ text: `Ablation thermique, ${histo}` }, { text: "Suivi spécifique après ablation" }, { text: `Suivi ${p.fin} ans` }]
        : [{ text: `${p.pt} ${p.pn === "n1" ? "pN1" : "N0"}, grade ${p.histo === "chromo" ? "non applicable" : g}, ECOG ${ecog ? "1 ou plus" : "0"}, ${histo}` },
           { text: GROUPS[grp].label, tone: GROUPS[grp].tone }, { text: grp === "low" ? "Suivi 5 ans" : "Suivi 10 ans" }];

      let why;
      if (ablation) {
        why = `Après ablation thermique : imagerie à 3 mois, 6 mois, 1 an puis tous les ans ; durée non définie par la recommandation, ${p.fin} ans retenus.`;
      } else {
        why = `Groupe UISS : stade ${p.pt}, grade ${p.histo === "chromo" ? "non applicable" : g}, ECOG ${ecog ? "1 ou plus" : "0"} (tableaux III et IV).`;
        if (p.pn === "n1") why += " pN1 : l'UISS est défini pour les tumeurs N0M0, classement en risque élevé par choix local.";
        if (p.histo === "chromo") why += " Grade non validé pour le chromophobe : non pris en compte.";
        if (p.histo === "autre") why += " UISS établi sur les trois sous-types les plus fréquents : classement à confirmer.";
      }

      const alerts = [];
      const keynote = !ablation && p.histo === "cc" && (
        (T === 2 && (g === 4 || p.sarco === "oui")) || T === 3 || T === 4 || p.pn === "n1");
      if (keynote) {
        alerts.push({ tone: "alert", lead: "Pembrolizumab adjuvant", text: "Cellules claires de risque intermédiaire-haut ou haut (critères KEYNOTE-564) : traitement standard à proposer, débuté dans les 12 semaines après la néphrectomie, pour 12 mois au plus. Information sur les effets secondaires. RCP." });
      }
      if (ablation) {
        alerts.push({ tone: "info", text: "Imagerie par IRM ou TDM. Si le suivi repose sur l'IRM : scanner thoracique annuel sans injection." });
        alerts.push({ tone: "info", text: "Récidive locale : prise de contraste ovalaire en périphérie de la zone traitée, à comparer à l'imagerie pré-thérapeutique ; la biopsie n'est pas requise." });
      } else if (grp === "low") {
        alerts.push({ tone: "info", text: "Risque faible : limiter les examens irradiants, alternance possible avec échographie ou IRM rénale." });
      }
      alerts.push({ tone: "info", text: "À chaque contrôle : fonction rénale et pression artérielle, mesures de néphroprotection." });

      /* Calendrier */
      const img = ablation ? "IRM ou TDM rénale (scanner thoracique annuel si IRM)"
        : grp === "low" ? "TDM TAP (alternance possible avec échographie ou IRM rénale)"
        : "TDM TAP, ou IRM abdominale et TDM thoracique";
      const ev = [];
      const push = (m, phase) => ev.push({ m, phase, title: "Consultation et imagerie", exam: `${img} ; créatinine et DFG, pression artérielle.`, short: "imagerie + créat" });
      if (ablation) {
        push(3, "Contrôles initiaux"); push(6, "Contrôles initiaux");
        for (let m = 12; m <= Number(p.fin) * 12; m += 12) push(m, `Annuel, ${p.fin} ans`);
      } else if (grp === "low") {
        push(6, "Contrôle à 6 mois");
        [12, 24, 36].forEach(m => push(m, "Annuel, 3 ans"));
        push(60, "Ultime contrôle à 5 ans");
      } else if (grp === "mid") {
        [6, 12, 18, 24].forEach(m => push(m, "Tous les 6 mois, 2 ans"));
        [36, 48, 60, 72].forEach(m => push(m, "Annuel, 4 ans"));
        [96, 120].forEach(m => push(m, "Tous les 2 ans, 4 ans"));
      } else {
        [3, 6, 9, 12].forEach(m => push(m, "Tous les 3 mois, 1 an"));
        for (let m = 18; m <= 60; m += 6) push(m, "Tous les 6 mois, 4 ans");
        for (let m = 72; m <= 120; m += 12) push(m, "Annuel, 5 ans");
      }
      return { chips, why, alerts, meta: { group: ablation ? "ablation" : grp }, ev };
    }
  });
})();
