(() => {
  "use strict";
  const toggle = document.querySelector("#nav-toggle");
  const close = document.querySelector("#nav-close");
  const nav = document.querySelector("#site-nav");
  if (!toggle || !close || !nav) return;

  const closeNav = () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    nav.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  });

  close.addEventListener("click", () => {
    closeNav();
    toggle.focus();
  });

  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
})();