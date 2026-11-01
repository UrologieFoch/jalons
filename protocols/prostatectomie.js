/* Prostatectomie totale : surveillance du PSA.
   Source : CCAFU, actualisation 2024-2026, cancer de la prostate, traitement de la récidive
   et de la maladie métastatique (Prog Urol FMC 2024) :
     premier PSA total dans les 3 mois ; s'il est indétectable, tous les 6 mois pendant 3 à 5 ans,
     puis tous les ans. PSA attendu indétectable 6 semaines après la prostatectomie.
   Les deux marges laissées par la recommandation (3 à 5 ans, fin du suivi annuel) sont des
   champs de saisie : c'est le praticien qui choisit, l'app ne devine pas. */
(function () {
  const LIFE_AGE = 110;

  Jalons.registerProtocol({
    id: "prostatectomie",
    name: "Prostatectomie totale",
    short: "Prostatectomie",
    dateLabel: "Date de la prostatectomie",
    version: "1",
    validated: false,
    source: "CCAFU, actualisation 2024-2026, cancer de la prostate, traitement de la récidive et de la maladie métastatique (Prog Urol FMC 2024). Premier PSA total dans les 3 mois ; s'il est indétectable, tous les 6 mois pendant 3 à 5 ans, puis tous les ans. Définition de la récidive biologique : CCAFU 2022-2024.",
    local: "Premier PSA placé à 6 semaines. Durée de la phase semestrielle (3 à 5 ans) et fin du suivi annuel (non précisée par la recommandation) choisies à la saisie, 5 ans et à vie par défaut. À valider.",
    fields: [
      ["pt", "Stade pT", ["pT2", "pT3a", "pT3b", "pT4"], "pT2"],
      ["isup", "Groupe ISUP", ["1", "2", "3", "4", "5"], "2"],
      ["marges", "Marges", ["R0", "R1"], "R0"],
      ["pn", "Ganglions", ["pN0", "pN1", "pNx"], "pN0"],
      ["sem", "PSA tous les 6 mois", [["3", "Pendant 3 ans"], ["4", "Pendant 4 ans"], ["5", "Pendant 5 ans"]], "5"],
      ["fin", "Puis PSA annuel", [["10", "Jusqu'à 10 ans"], ["15", "Jusqu'à 15 ans"], ["vie", "À vie"]], "vie"]
    ],

    plan(p, ctx) {
      const sem = Number(p.sem);
      const age = ctx && Number.isFinite(ctx.age) ? ctx.age : 65;
      const endM = p.fin === "vie" ? Math.max(120, Math.floor((LIFE_AGE - age) * 12)) : Number(p.fin) * 12;

      const adverse = [
        p.pt !== "pT2" ? p.pt : null,
        Number(p.isup) >= 4 ? `ISUP ${p.isup}` : null,
        p.marges === "R1" ? "marge R1" : null,
        p.pn === "pN1" ? "pN1" : null
      ].filter(Boolean);

      const horizon = p.fin === "vie" ? "à vie" : `jusqu'à ${p.fin} ans`;
      const chips = [
        { text: `${p.pt}, ISUP ${p.isup}, ${p.marges}, ${p.pn}` },
        adverse.length ? { text: "Facteurs défavorables", tone: "hi" } : { text: "Pas de facteur défavorable" },
        { text: `PSA semestriel ${sem} ans, puis annuel ${horizon}` }
      ];
      const why = `Premier PSA dans les 3 mois, puis tous les 6 mois pendant ${sem} ans (la recommandation laisse 3 à 5 ans, choix du praticien), puis annuel ${horizon}.`;

      const alerts = [];
      if (adverse.length) {
        alerts.push({ tone: "alert", lead: adverse.join(", "), text: "Facteurs anatomopathologiques défavorables : discuter en RCP un traitement complémentaire ou une stratégie de rattrapage précoce." });
      }
      alerts.push({ tone: "info", text: "PSA attendu indétectable 6 semaines après la prostatectomie. S'il reste détectable : situation particulière, à discuter en RCP." });
      alerts.push({ tone: "info", text: "Récidive biologique : PSA supérieur à 0,2 ng/mL et ascendant, confirmé sur 2 dosages successifs (définition CCAFU)." });

      const ev = [{
        w: 6, phase: "Premier contrôle",
        title: "Consultation et PSA total",
        exam: "PSA attendu indétectable. Continence, fonction érectile.",
        short: "PSA"
      }];
      for (let m = 6; m <= sem * 12; m += 6) {
        ev.push({ m, phase: `Tous les 6 mois, ${sem} ans`, title: "PSA total", exam: "PSA tous les 6 mois tant qu'il reste indétectable.", short: "PSA" });
      }
      for (let m = sem * 12 + 12; m <= endM; m += 12) {
        ev.push({ m, phase: `Annuel, ${horizon}`, title: "PSA total", exam: "PSA annuel.", short: "PSA" });
      }
      return { chips, why, alerts, ev };
    }
  });
})();
