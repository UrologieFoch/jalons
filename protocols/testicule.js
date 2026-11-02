/* Tumeurs germinales du testicule : suivi.
   Source : CCAFU, actualisation 2024-2026, tumeurs germinales du testicule
   (Murez T. et al., Prog Urol FMC 2024;34:F250-F271).
     Tableau IX : suivi des TG de stade I (TGS ; TGNS sans et avec invasion lymphovasculaire).
     Tableau X  : suivi des TG de stade II et III en rémission après chimiothérapie.
   Deux protocoles, car le point de départ diffère : l'orchidectomie (stade I) ou la fin de chimiothérapie. */
(function () {
  const exam = (mk, tdm, clinNote) => ({
    title: "Examen clinique, marqueurs" + (tdm ? ", scanner TAP" : ""),
    exam: "AFP, hCG totale, LDH" + (tdm ? " ; scanner thoraco-abdomino-pelvien" : "") + (clinNote ? ". " + clinNote : "."),
    short: "marqueurs" + (tdm ? " + TDM TAP" : "")
  });
  function build(markers, scans, phaseOf, clinNote) {
    const months = [...new Set([...markers, ...scans])].sort((a, b) => a - b);
    return months.map(m => Object.assign({ m, phase: phaseOf(m) }, exam(markers.includes(m), scans.includes(m), clinNote)));
  }

  /* ---------- Stade I, après orchidectomie (tableau IX) ---------- */
  const IX = {
    tgs: { markers: [1, 6, 12, 18, 24, 30, 36, 48, 60], scans: [6, 12, 18, 24, 36, 60] },
    ilvNeg: { markers: [1, 3, 6, 9, 12, 15, 18, 21, 24, 36, 48, 60], scans: [6, 12, 24, 36, 60] },
    ilvPos: { markers: [1, 3, 6, 9, 12, 15, 18, 21, 24, 30, 36, 42, 48, 54, 60], scans: [6, 12, 18, 24, 36, 60] }
  };

  Jalons.registerProtocol({
    id: "testicule-1",
    name: "Tumeur germinale du testicule, stade I",
    short: "Testicule stade I",
    dateLabel: "Date de l'orchidectomie",
    version: "1",
    validated: false,
    source: "CCAFU, actualisation 2024-2026, tumeurs germinales du testicule (Prog Urol FMC 2024;34:F250-F271). Suivi : tableau IX. Stratégie : recommandations 2 (TGS) et 3 (TGNS).",
    local: "Tableau IX retenu quand il diffère du texte : TGS sans marqueurs à M42 (le texte indique des marqueurs semestriels la 4e année), TGNS sans emboles sans marqueurs à M30 (le texte indique des marqueurs semestriels la 3e année). Tableau appliqué quelle que soit la stratégie adjuvante. Suivi arrêté à 5 ans. À valider.",
    fields: [
      ["histo", "Histologie", [["tgs", "Séminome pur (TGS)"], ["tgns", "Non séminomateuse (TGNS)"]], "tgs"],
      ["ilv", "Invasion lymphovasculaire", [["non", "Non"], ["oui", "Oui"]], "non"],
      ["strat", "Stratégie", [["surv", "Surveillance"], ["carbo", "Carboplatine AUC7"], ["bep", "1 cycle de BEP"], ["rt", "Radiothérapie lombo-aortique"]], "surv"]
    ],
    plan(p) {
      const tgs = p.histo === "tgs";
      const key = tgs ? "tgs" : (p.ilv === "oui" ? "ilvPos" : "ilvNeg");
      const t = IX[key];
      const label = tgs ? "Séminome pur, stade I" : (p.ilv === "oui" ? "TGNS stade I, haut risque (ILV+)" : "TGNS stade I, faible risque (ILV-)");
      const strat = { surv: "surveillance", carbo: "carboplatine AUC7", bep: "1 cycle de BEP", rt: "radiothérapie lombo-aortique" }[p.strat];
      const chips = [{ text: label, tone: !tgs && p.ilv === "oui" ? "hi" : "" }, { text: `Stratégie : ${strat}` }, { text: "Suivi 5 ans" }];
      let why = `Tableau IX, ligne « ${tgs ? "TGS stade I" : (p.ilv === "oui" ? "TGNS stade I ILV+" : "TGNS stade I ILV-")} ».`;
      if (tgs && p.ilv === "oui") why += " L'invasion lymphovasculaire ne modifie pas le calendrier des séminomes.";

      const alerts = [];
      if (tgs) {
        if (p.strat === "bep") alerts.push({ tone: "alert", lead: "Stratégie inhabituelle", text: "Le BEP adjuvant concerne les TGNS ; pour un séminome de stade I, les options sont la surveillance ou le carboplatine AUC7. À vérifier." });
        else if (p.strat === "rt") alerts.push({ tone: "alert", lead: "Radiothérapie", text: "Non recommandée en première intention en cas de traitement adjuvant, à éviter chez le sujet jeune (recommandation 2)." });
        else alerts.push({ tone: "info", text: "Séminome de stade I : la surveillance est l'option recommandée si le patient est compliant ; un cycle de carboplatine AUC7 est une option (recommandation 2)." });
      } else {
        if (p.strat === "carbo" || p.strat === "rt") alerts.push({ tone: "alert", lead: "Stratégie inhabituelle", text: "Pour une TGNS de stade I, les options sont la surveillance ou un cycle de BEP. À vérifier." });
        else if (p.ilv === "oui" && p.strat === "surv") alerts.push({ tone: "alert", lead: "TGNS ILV+ en surveillance", text: "Un cycle de BEP est l'option recommandée (récidive jusqu'à 44 % sous surveillance) ; surveillance si inéligibilité à la chimiothérapie. Patient informé, RCP." });
        else if (p.ilv !== "oui" && p.strat === "bep") alerts.push({ tone: "info", text: "TGNS ILV- : la surveillance est l'option recommandée si le patient est compliant ; un BEP se discute si la surveillance rapprochée n'est pas possible (recommandation 3)." });
        alerts.push({ tone: "info", text: "Sans plainte fonctionnelle, l'examen clinique peut n'être réalisé que tous les 6 mois." });
      }
      alerts.push({ tone: "info", text: "Marqueurs postopératoires : ils doivent se normaliser selon leur demi-vie. S'ils persistent ou remontent sans lésion au scanner (stade IS) : traitement d'une TG métastatique de bon pronostic." });
      alerts.push({ tone: "info", text: "Autopalpation recommandée. Échographie annuelle du testicule restant s'il porte au moins 5 microlithiases par champ (ESUR)." });

      const phaseOf = m => (m === 1 ? "Marqueurs postopératoires" : m <= 24 ? "Années 1 et 2" : m <= 36 ? "Année 3" : "Années 4 et 5");
      return { chips, why, alerts, ev: build(t.markers, t.scans, phaseOf, "") };
    }
  });

  /* ---------- Stades II et III, en rémission après chimiothérapie (tableau X) ---------- */
  const X = {
    a: { markers: [1, 3, 6, 9, 12, 15, 18, 21, 24, 30, 36, 42, 48, 54, 60], scans: [6, 12, 24, 36, 48, 60] },
    b: { markers: [2, 4, 6, 8, 10, 12, 18, 24, 30, 36, 42, 48, 54, 60], scans: [4, 8, 12, 18, 24, 30, 36, 48, 60] }
  };

  Jalons.registerProtocol({
    id: "testicule-m",
    name: "Tumeur germinale métastatique, après chimiothérapie",
    short: "Testicule, après chimio",
    dateLabel: "Date de fin de chimiothérapie",
    version: "1",
    validated: false,
    source: "CCAFU, actualisation 2024-2026, tumeurs germinales du testicule (Prog Urol FMC 2024;34:F250-F271). Suivi des TG de stade II et III en rémission : tableau X.",
    local: "Calendrier compté depuis la fin de la chimiothérapie. Suivi arrêté à 5 ans ; un suivi au-delà se discute au cas par cas dans les formes agressives. À valider.",
    fields: [
      ["histo", "Histologie", [["tgs", "Séminome (TGS)"], ["tgns", "Non séminomateuse (TGNS)"]], "tgns"],
      ["prono", "Pronostic IGCCCG", [["bon", "Bon"], ["inter", "Intermédiaire"], ["mauvais", "Mauvais"]], "bon"],
      ["resid", "Masses résiduelles", [["non", "Aucune lésion active"], ["active", "Lésion active réséquée"]], "non"]
    ],
    plan(p) {
      const b = p.prono === "mauvais" || p.resid === "active";
      const t = b ? X.b : X.a;
      const prono = { bon: "bon", inter: "intermédiaire", mauvais: "mauvais" }[p.prono];
      const chips = [
        { text: `${p.histo === "tgs" ? "TGS" : "TGNS"}, pronostic ${prono}${p.resid === "active" ? ", lésion active résiduelle" : ""}` },
        { text: b ? "Suivi rapproché (tableau X, 2e ligne)" : "Suivi standard (tableau X, 1re ligne)", tone: b ? "hi" : "" },
        { text: "Suivi 5 ans" }
      ];
      const why = b
        ? `${p.prono === "mauvais" ? "Pronostic IGCCCG mauvais" : "Lésion active dans les masses résiduelles"} : marqueurs tous les 2 mois et scanner tous les 4 mois la 1re année (tableau X).`
        : "Pronostic IGCCCG bon ou intermédiaire, rémission complète sans lésion active : marqueurs trimestriels et scanner à 6 mois, 1 an et 2 ans, puis semestriels et annuel (tableau X).";
      const alerts = [];
      if (p.prono === "mauvais" && p.histo === "tgs") alerts.push({ tone: "alert", lead: "À vérifier", text: "La classification IGCCCG des séminomes n'a pas de groupe de mauvais pronostic (tableau V)." });
      if (b) alerts.push({ tone: "info", text: "Formes agressives : un suivi au-delà de 5 ans peut être proposé au cas par cas." });
      alerts.push({ tone: "info", text: b
        ? "Si les dosages restent normaux, l'examen clinique peut n'être réalisé qu'un dosage sur deux."
        : "Sans plainte fonctionnelle, l'examen clinique peut n'être réalisé que tous les 6 mois." });
      alerts.push({ tone: "info", text: "Récidive tardive possible au-delà de 2 ans : chirurgie d'emblée si marqueurs normaux, chimiothérapie première s'ils sont élevés, en centre expert." });

      const phaseOf = b
        ? m => (m <= 12 ? "1re année" : m <= 36 ? "Années 2 et 3" : "Années 4 et 5")
        : m => (m <= 24 ? "Années 1 et 2" : "Années 3 à 5");
      return { chips, why, alerts, ev: build(t.markers, t.scans, phaseOf, "") };
    }
  });
})();
