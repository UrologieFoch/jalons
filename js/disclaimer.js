/* Jalons : avertissement sur le statut de l'outil.
   Bandeau en tête de chaque écran et acceptation explicite au premier lancement.
   Changer VERSION_AVERTISSEMENT si le texte change : chaque utilisateur devra l'accepter de nouveau. */
(function () {
  if (typeof document === "undefined") return; // chargé aussi par les tests (Node) : rien à faire
  const VERSION_AVERTISSEMENT = "1";
  const KEY = "jalons-avertissement";

  const BANDEAU = "<div class=\"note info\" role=\"note\" data-avertissement><strong>Version de test.</strong> " +
    "Jalons n'est pas un dispositif médical. Il ne doit pas fonder, à lui seul, une décision médicale : " +
    "chaque calendrier est à vérifier par le praticien.</div>";

  const app = document.getElementById("app");
  function ajouterBandeau() {
    if (app.firstElementChild && !app.querySelector("[data-avertissement]")) {
      app.insertAdjacentHTML("afterbegin", BANDEAU);
    }
  }
  new MutationObserver(ajouterBandeau).observe(app, { childList: true });
  ajouterBandeau();

  let accepte = null;
  try { accepte = localStorage.getItem(KEY); } catch (e) { /* stockage indisponible : on affiche à chaque ouverture */ }
  if (accepte === VERSION_AVERTISSEMENT) return;

  const voile = document.createElement("div");
  voile.className = "lock";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-labelledby", "avert-titre");
  voile.innerHTML =
    "<div class=\"lock-box\">" +
    "<h1 id=\"avert-titre\">Version de test</h1>" +
    "<p>Jalons est un prototype en cours d'évaluation, mis à disposition pour test.</p>" +
    "<p>Ce n'est pas un dispositif médical : il n'a pas de marquage CE et n'est destiné ni au diagnostic ni au choix d'un traitement.</p>" +
    "<p>Il ne doit pas participer à une décision médicale isolée. Les calendriers et les alertes reprennent les recommandations du CCAFU sans avoir été validés ; ils doivent être vérifiés par le praticien, qui reste seul responsable de la prise en charge.</p>" +
    "<button class=\"btn primary\" type=\"button\" id=\"avert-ok\">J'ai compris</button>" +
    "</div>";
  document.body.appendChild(voile);
  const bouton = voile.querySelector("#avert-ok");
  bouton.focus();
  bouton.addEventListener("click", () => {
    try { localStorage.setItem(KEY, VERSION_AVERTISSEMENT); } catch (e) { /* rien */ }
    voile.remove();
  });
})();
