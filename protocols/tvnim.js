/* TVNIM : surveillance après RTUV d'une tumeur de vessie n'infiltrant pas le muscle.
   Source : CCAFU, actualisation 2024-2026 (Roumiguié M. et al., Prog Urol FMC 2024;34(7):F272).
     Tableau III : stratification en risque faible, intermédiaire, haut, très haut.
     Tableau IV  : modalités de suivi (cystoscopie, cytologie, uro-TDM, durée).
     Texte       : RTUV de réévaluation pour tout pT1 (2 à 6 semaines), RTUV complémentaire
                   si détrusor absent ou résection incomplète, tabagisme actif.
   Une récidive se saisit comme un nouveau patient : nouveau groupe, nouveau calendrier. */
(function () {
  const LIFE_AGE = 110; // borne technique du suivi « à vie » ; l'âge d'arrêt du praticien coupe avant

  const GROUPS = {
    low: { label: "Faible risque", tone: "" },
    mid: { label: "Risque intermédiaire", tone: "mid" },
    high: { label: "Haut risque", tone: "hi" },
    vhigh: { label: "Très haut risque", tone: "hi" }
  };

  function stratify(p) {
    const cisIso = p.stade === "cis", pT1 = p.stade === "pT1";
    const hg = cisIso || p.grade === "hg";
    const cis = cisIso || p.cis === "oui";
    const multi = p.nb === "multi", big = p.taille === "ge3";
    const notes = [];

    // Très haut risque (tableau III). reclass : note a du tableau, reclassement possible en haut risque.
    const vhr = [];
    if (pT1 && hg) {
      if (cis) vhr.push({ t: "pT1 HG avec CIS", reclass: true });
      if (multi) vhr.push({ t: "pT1 HG multifocal", reclass: true });
      if (big) vhr.push({ t: "pT1 HG de 3 cm ou plus", reclass: true });
      if (p.thr === "lvi") vhr.push({ t: "pT1 HG avec emboles lymphovasculaires", reclass: true });
      if (p.thr === "up") vhr.push({ t: "pT1 HG de l'urètre prostatique", reclass: false });
    }
    if (pT1 && p.thr === "st") vhr.push({ t: "pT1 de sous-type agressif", reclass: false });
    if (p.thr !== "aucun" && !vhr.length) {
      notes.push(pT1
        ? "Facteur aggravant saisi sur un pT1 de bas grade : le tableau III le réserve au haut grade, il n'est pas appliqué (à discuter en RCP)."
        : "Facteur aggravant saisi hors pT1 : non appliqué (tableau III).");
    }

    const hr = [pT1 ? "pT1" : null, hg && !cisIso ? "haut grade" : null, cis ? "CIS" : null].filter(Boolean);
    const mid = [p.ctx !== "primo" ? "récidive" : null, multi ? "multifocale" : null, big ? "3 cm ou plus" : null].filter(Boolean);

    let grp, why;
    if (vhr.length) { grp = "vhigh"; why = `Critère de très haut risque : ${vhr.map(x => x.t).join(", ")} (tableau III).`; }
    else if (hr.length) { grp = "high"; why = `Critère de haut risque : ${hr.join(", ")} (tableau III).`; }
    else if (mid.length) { grp = "mid"; why = `pTa de bas grade, ${mid.join(", ")} : risque intermédiaire (tableau III).`; }
    else { grp = "low"; why = "pTa de bas grade unifocale de moins de 3 cm, sans antécédent de tumeur de vessie : faible risque (tableau III)."; }

    return { grp, why, notes, cisIso, pT1, hg, cis, multi, big, vhr, reclass: vhr.length > 0 && vhr.every(x => x.reclass) };
  }

  Jalons.registerProtocol({
    id: "tvnim",
    name: "RTUV pour TVNIM",
    short: "RTUV (TVNIM)",
    dateLabel: "Date de la RTUV",
    version: "1",
    validated: false,
    source: "CCAFU, actualisation 2024-2026, tumeurs de la vessie n'infiltrant pas le muscle (Prog Urol FMC 2024;34(7):F272). Stratification : tableau III. Suivi : tableau IV. RTUV de réévaluation : 2 à 6 semaines après RTUV complète pour tout pT1.",
    local: "Rythmes du tableau IV comptés depuis la RTUV (haut risque : tous les 3 mois de M3 à M24, tous les 6 mois jusqu'à M60, puis annuel). Uro-TDM annuel du haut risque (note du tableau IV, durée non précisée) placé à chaque date anniversaire. Risque intermédiaire arrêté à 10 ans, durée minimale du tableau. Suivi à vie borné par l'âge d'arrêt. RTUV de réévaluation placée à 4 semaines. À valider.",
    fields: [
      ["ctx", "Contexte", [["primo", "Primo-diagnostic"], ["rec", "Récidive"], ["recbcg", "Récidive après BCG"]], "primo"],
      ["stade", "Stade", [["pTa", "pTa"], ["pT1", "pT1"], ["cis", "CIS isolé"]], "pTa"],
      ["grade", "Grade (OMS 2022)", [["bg", "Bas grade ou PUNLMP"], ["hg", "Haut grade"]], "bg"],
      ["cis", "CIS associé", [["non", "Non"], ["oui", "Oui"]], "non"],
      ["nb", "Nombre", [["uni", "Unifocale"], ["multi", "Multifocale"]], "uni"],
      ["taille", "Plus grande tumeur", [["lt3", "Moins de 3 cm"], ["ge3", "3 cm ou plus"]], "lt3"],
      ["thr", "Facteur aggravant pT1", [["aucun", "Aucun"], ["lvi", "Emboles lymphovasculaires"], ["up", "Urètre prostatique"], ["st", "Sous-type agressif"]], "aucun"],
      ["rtuv", "Qualité de la RTUV", [["ok", "Complète, détrusor vu"], ["nodet", "Détrusor absent"], ["incomp", "Résection incomplète"]], "ok"],
      ["tabac", "Tabagisme actif", [["non", "Non"], ["oui", "Oui"]], "non"]
    ],

    plan(p, ctx) {
      const s = stratify(p);
      const { grp } = s;
      const smoker = p.tabac === "oui";
      const age = ctx && Number.isFinite(ctx.age) ? ctx.age : 60;
      const capM = Math.max(120, Math.floor((LIFE_AGE - age) * 12));
      const reresect = p.rtuv !== "ok";

      /* Résumé */
      const desc = s.cisIso
        ? "CIS isolé"
        : `${p.stade} ${s.hg ? "haut grade" : "bas grade"}${s.cis ? " avec CIS" : ""}, ${s.multi ? "multifocale" : "unifocale"}, ${s.big ? "3 cm ou plus" : "moins de 3 cm"}`;
      const dur = { low: "Suivi 5 ans", mid: "Suivi 10 ans minimum", high: "Suivi à vie", vhigh: "Suivi à vie" }[grp]
        + (smoker && (grp === "low" || grp === "mid") ? ", prolongé (tabac)" : "");
      const chips = [{ text: desc }, { text: GROUPS[grp].label, tone: GROUPS[grp].tone }, { text: dur }];
      let why = s.why;
      if (s.notes.length) why += " " + s.notes.join(" ");
      if (smoker && (grp === "low" || grp === "mid")) why += " Tabagisme actif : cystoscopie annuelle maintenue tant qu'il persiste (note du tableau IV).";

      /* Alertes */
      const alerts = [];
      if (s.pT1) {
        alerts.push({ tone: "alert", lead: "pT1", text: `RTUV de réévaluation systématique, 2 à 6 semaines après la RTUV initiale${reresect ? (p.rtuv === "nodet" ? ", qui couvre aussi l'absence de détrusor" : ", qui couvre aussi la résection incomplète") : ""}. Ajoutée au calendrier.` });
      } else if (reresect) {
        alerts.push({ tone: "alert", lead: p.rtuv === "nodet" ? "Détrusor absent" : "Résection incomplète", text: "RTUV complémentaire. Ajoutée au calendrier." });
      }
      if (s.pT1 || reresect) alerts.push({ tone: "info", text: "Groupe de risque provisoire : à recalculer sur le résultat de la re-résection (nouvelle saisie)." });
      if (p.stade === "pTa" && s.hg) alerts.push({ tone: "info", text: "pTa de haut grade : RTUV de réévaluation non systématique mais à envisager (niveau de preuve 4)." });

      if (grp === "vhigh") {
        alerts.push({ tone: "alert", lead: "Très haut risque", text: "BCG avec entretien de 3 ans ou cystectomie précoce avec curage ganglionnaire étendu. Dossier à présenter en RCP." });
        if (s.reclass) alerts.push({ tone: "info", text: "Reclassement en haut risque possible si la dernière re-résection est inférieure à pT1 avec muscle vu (cystectomie alors optionnelle)." });
      } else if (grp === "high") {
        alerts.push({ tone: "info", text: "Traitement adjuvant : BCG, induction puis entretien de 3 ans. Les instillations ne figurent pas dans ce calendrier." });
      } else if (grp === "mid") {
        alerts.push({ tone: "info", text: "Traitement adjuvant : instillations de chimiothérapie (mitomycine C ou épirubicine) en première intention, BCG avec entretien de 12 mois en cas d'échec." });
      } else {
        alerts.push({ tone: "info", text: "Traitement adjuvant : IPOP seule, aucun autre traitement complémentaire." });
      }

      if (p.ctx === "recbcg") {
        if (s.hg) alerts.push({ tone: "alert", lead: "Récidive de haut grade après BCG", text: "Vérifier les critères de non-réponse (BCG optimal, récidive dans les 6 mois si papillaire, 12 mois si CIS). Si non répondeur : cystectomie avec curage étendu dans les 3 mois ou essai thérapeutique, en RCP." });
        else alerts.push({ tone: "info", text: "Récidive de bas grade après BCG : poursuite ou nouveau schéma d'instillations (BCG ou chimiothérapie)." });
      } else if (p.ctx === "rec" && grp === "mid") {
        alerts.push({ tone: "info", text: "Récidive de bas grade : surveillance active ou fulguration envisageables chez des patients sélectionnés (critères CCAFU, recommandation n° 9)." });
      }
      if (s.cis) alerts.push({ tone: "info", text: "CIS : biopsies vésicales possibles avec la cystoscopie à 3 mois pour vérifier la réponse au BCG." });
      alerts.push({ tone: "info", text: "Signes évoquant la voie excrétrice supérieure, ou cytologie positive isolée : uro-TDM et recherche de CIS, quel que soit le groupe." });

      /* Calendrier (tableau IV) */
      const byKey = new Map();
      const cyto = grp !== "low";
      const uroTDM = grp === "high" || grp === "vhigh";
      const cysto = (m, phase, extra) => {
        const tdm = uroTDM && m % 12 === 0;
        // Le titre nomme les examens ; le détail ne donne que ce qui sert à l'ordonnance.
        const parts = [cyto ? "Cytologie sur urines de 2e miction du matin" : "Cytologie non indiquée"];
        if (tdm) parts.push("uro-IRM possible à la place de l'uro-TDM si examens répétés ou contre-indication");
        if (s.cis && m === 3) parts.push("biopsies si CIS initial");
        if (extra) parts.push(extra);
        byKey.set(`m${m}`, {
          m, phase,
          title: "Fibroscopie vésicale" + (cyto ? " et cytologie" : "") + (tdm ? ", uro-TDM" : ""),
          exam: parts.join(" ; ") + ".",
          short: "cysto" + (cyto ? " + cyto" : "") + (tdm ? " + uro-TDM" : "")
        });
      };

      if (s.pT1 || reresect) {
        byKey.set("w4", {
          w: 4, phase: "Réévaluation",
          title: s.pT1 ? "RTUV de réévaluation" : "RTUV complémentaire",
          exam: "Entre 2 et 6 semaines après la RTUV initiale. Recalculer le groupe de risque sur le résultat.",
          short: s.pT1 ? "RTUV de réévaluation" : "RTUV complémentaire"
        });
      }

      let end;
      if (grp === "low") {
        cysto(3, "Contrôle à 3 mois");
        for (let m = 12; m <= 60; m += 12) cysto(m, "Annuel, 5 ans");
        end = 60;
      } else if (grp === "mid") {
        cysto(3, "Contrôle à 3 mois");
        for (let m = 6; m <= 24; m += 6) cysto(m, "Tous les 6 mois, 2 ans");
        for (let m = 36; m <= 120; m += 12) cysto(m, "Annuel, 10 ans minimum");
        end = 120;
      } else {
        for (let m = 3; m <= 24; m += 3) cysto(m, "Tous les 3 mois, 2 ans");
        for (let m = 30; m <= 60; m += 6) cysto(m, "Tous les 6 mois jusqu'à 5 ans");
        for (let m = 72; m <= capM; m += 12) cysto(m, "Annuel, à vie");
        end = capM;
      }
      if (smoker && end < capM) {
        for (let m = end + 12; m <= capM; m += 12) cysto(m, "Prolongé, tabagisme actif", "à arrêter après sevrage tabagique");
      }

      return { chips, why, alerts, ev: [...byKey.values()] };
    }
  });
})();
