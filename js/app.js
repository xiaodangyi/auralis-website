import { MODULES } from "./data.js";
import { CubeExperience } from "./cube.js";

const cubeStage = document.getElementById("cubeStage");
const moduleGrid = document.getElementById("moduleGrid");
const modulePanel = document.getElementById("modulePanel");
const panelBody = document.getElementById("panelBody");
const panelClose = document.getElementById("panelClose");
const navToggle = document.getElementById("navToggle");
const navIcon = document.getElementById("navIcon");
const mobileNav = document.getElementById("mobileNav");
const contactForm = document.getElementById("contactForm");
const formSuccess = document.getElementById("formSuccess");
const year = document.getElementById("year");
const hero = document.getElementById("top");

let cube = null;
let panelTimer = null;

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function buildModuleCards() {
  moduleGrid.innerHTML = MODULES.map((module, index) => `
    <article class="module-card" tabindex="0" role="button" data-face="${index}" aria-label="${module.name}，点击查看 3D 模块">
      <div class="module-icon"><i data-lucide="${module.icon}"></i></div>
      <h3>${module.name}</h3>
      <p class="module-en">${module.en}</p>
      <p>${module.desc}</p>
      <div class="module-tags">
        ${module.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <span class="module-link"><i data-lucide="arrow-up-right"></i>查看模块</span>
    </article>
  `).join("");
  refreshIcons();
}

function showModulePanel(index) {
  const module = MODULES[index];
  if (!module) return;
  clearTimeout(panelTimer);
  panelBody.innerHTML = `
    <div class="panel-head">
      <div class="panel-icon"><i data-lucide="${module.icon}"></i></div>
      <div>
        <h3>${module.name}</h3>
        <span class="module-en">${module.en}</span>
      </div>
    </div>
    <p>${module.desc}</p>
    <ul class="panel-points">
      ${module.tags.map((tag) => `<li><i data-lucide="check"></i><span>${tag}</span></li>`).join("")}
    </ul>
    <a class="btn btn-primary btn-block" href="#contact">
      <i data-lucide="arrow-right"></i><span>了解${module.name}</span>
    </a>
  `;
  modulePanel.hidden = false;
  requestAnimationFrame(() => modulePanel.classList.add("open"));
  refreshIcons();
}

function hideModulePanel() {
  if (modulePanel.hidden) return;
  modulePanel.classList.remove("open");
  if (cube) cube.deselect();
  panelTimer = setTimeout(() => {
    modulePanel.hidden = true;
  }, 260);
}

function selectModule(index) {
  if (cube) cube.selectFace(index);
  showModulePanel(index);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  hero.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  mobileNav.hidden = true;
  navToggle.setAttribute("aria-expanded", "false");
  navIcon.innerHTML = '<i data-lucide="menu"></i>';
  refreshIcons();
}

function initCube() {
  try {
    cube = new CubeExperience(cubeStage, MODULES, {
      onSelect: (index) => showModulePanel(index)
    });
  } catch (error) {
    console.error("Cube failed to start.", error);
  }
}

moduleGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".module-card");
  if (card) selectModule(Number(card.dataset.face));
});

moduleGrid.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    const card = event.target.closest(".module-card");
    if (card) {
      event.preventDefault();
      selectModule(Number(card.dataset.face));
    }
  }
});

panelClose.addEventListener("click", hideModulePanel);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideModulePanel();
});

navToggle.addEventListener("click", () => {
  const willOpen = mobileNav.hidden;
  mobileNav.hidden = !willOpen;
  navToggle.setAttribute("aria-expanded", String(willOpen));
  navIcon.innerHTML = willOpen ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
  refreshIcons();
});

mobileNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    mobileNav.hidden = true;
    navToggle.setAttribute("aria-expanded", "false");
    navIcon.innerHTML = '<i data-lucide="menu"></i>';
    refreshIcons();
  }
});

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formSuccess.hidden = false;
  refreshIcons();
  contactForm.reset();
});

const onScroll = () => {
  document.body.classList.toggle("scrolled", window.scrollY > 12);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

if ("IntersectionObserver" in window && cubeStage) {
  new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (cube) cube.setActive(entry.isIntersecting);
    });
  }, { threshold: 0.04 }).observe(hero);
}

year.textContent = String(new Date().getFullYear());
buildModuleCards();
initCube();
window.__auralisCube = cube;
refreshIcons();
