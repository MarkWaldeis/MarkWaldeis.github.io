const STORAGE_KEY = "kabinett-custom-v1";

const wall = document.querySelector("#wand");
const status = document.querySelector("#status");
const search = document.querySelector("#search");
const stage = document.querySelector("#stage");
const frame = document.querySelector("#stage-frame");
const stageTitle = document.querySelector("#stage-title");
const stageOpen = document.querySelector("#stage-open");
const stageNote = document.querySelector("#stage-note");
const stageClose = document.querySelector("#stage-close");
const form = document.querySelector("#add-form");
const formMsg = document.querySelector("#form-msg");

let catalog = [];
let custom = loadCustom();
let kind = "alle";
let lastFocus = null;

function loadCustom() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.href) : [];
  } catch {
    return [];
  }
}

function saveCustom() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

function safeHref(value) {
  const raw = String(value || "").trim();
  if (/^spiele\/[\w./-]+\.html?$/i.test(raw) && !raw.includes("..")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function allProjects() {
  return catalog.concat(custom);
}

function visibleProjects() {
  const query = search.value.trim().toLowerCase();
  return allProjects().filter((project) => {
    if (kind !== "alle" && project.kind !== kind) return false;
    if (!query) return true;
    const haystack = [project.title, project.blurb, project.kind, ...(project.tags || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function updateCounts() {
  const items = allProjects();
  document.querySelector("#count-alle").textContent = String(items.length);
  for (const name of ["Spiel", "Szene", "Website"]) {
    document.querySelector("#count-" + name).textContent = String(
      items.filter((project) => project.kind === name).length
    );
  }
}

function render() {
  const items = visibleProjects();
  updateCounts();
  wall.replaceChildren();
  if (!items.length) {
    status.textContent = catalog.length
      ? "Nichts passt zu dieser Suche."
      : "Die Liste lädt noch.";
    return;
  }
  status.textContent = items.length === 1 ? "1 Projekt" : items.length + " Projekte";
  for (const project of items) {
    const card = document.createElement("article");
    card.className = "card" + (project.featured ? " is-featured" : "");
    card.dataset.kind = project.kind || "Spiel";
    card.dataset.id = project.id;
    card.tabIndex = 0;
    const tags = (project.tags || [])
      .map((tag) => "<span>" + escapeHtml(tag) + "</span>")
      .join("");
    const local = project.custom ? '<span class="local-tag">nur dieser Browser</span>' : "";
    card.innerHTML =
      '<span class="card-kind"><i></i>' + escapeHtml(project.kind || "Spiel") + "</span>" +
      '<h2 class="card-title">' + escapeHtml(project.title) + "</h2>" +
      '<p class="card-blurb">' + escapeHtml(project.blurb || "") + "</p>" +
      '<div class="card-tags">' + tags + local + "</div>";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "card-go";
    open.textContent = project.play === "external" ? "Repository öffnen" : "Spielen";
    open.addEventListener("click", () => openProject(project, open));
    card.appendChild(open);
    if (project.custom) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "card-go remove";
      remove.textContent = "Entfernen";
      remove.addEventListener("click", () => {
        custom = custom.filter((item) => item.id !== project.id);
        saveCustom();
        render();
      });
      card.appendChild(remove);
    }
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openProject(project, card);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openProject(project, card);
    });
    wall.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openProject(project, opener) {
  const href = safeHref(project.href);
  if (!href) return;
  lastFocus = opener || document.activeElement;
  stage.hidden = false;
  stageTitle.textContent = project.title;
  stageOpen.href = href;
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", "#" + encodeURIComponent(project.id));
  if (project.play === "external") {
    frame.hidden = true;
    frame.removeAttribute("src");
    stageNote.hidden = false;
    stageNote.innerHTML =
      "<div><p>" + escapeHtml(project.blurb || project.title) + "</p>" +
      '<p><a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">Im neuen Fenster öffnen</a></p></div>';
  } else {
    stageNote.hidden = true;
    stageNote.replaceChildren();
    frame.hidden = false;
    frame.src = href;
  }
  stageClose.focus();
}

function closeStage() {
  stage.hidden = true;
  frame.removeAttribute("src");
  frame.hidden = false;
  stageNote.hidden = true;
  document.body.style.overflow = "";
  history.replaceState(null, "", location.pathname + location.search);
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
}

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    kind = chip.dataset.kind;
    document.querySelectorAll(".chip").forEach((other) => {
      const on = other === chip;
      other.classList.toggle("is-on", on);
      other.setAttribute("aria-selected", on ? "true" : "false");
    });
    render();
  });
});

search.addEventListener("input", render);
stageClose.addEventListener("click", closeStage);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !stage.hidden) closeStage();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const href = safeHref(data.get("href"));
  if (!href) {
    formMsg.textContent = "Die Adresse muss mit https:// beginnen oder so aussehen: spiele/name/index.html";
    return;
  }
  const title = String(data.get("title") || "").trim();
  const entry = {
    id: "custom-" + Date.now().toString(36),
    title,
    kind: String(data.get("kind") || "Spiel"),
    blurb: String(data.get("blurb") || "").trim(),
    href,
    tags: ["selbst hinzugefügt"],
    custom: true,
    play: data.get("external") ? "external" : "embed",
  };
  custom.push(entry);
  saveCustom();
  form.reset();
  formMsg.textContent = "Hängt an der Wand, auf diesem Gerät.";
  kind = "alle";
  document.querySelectorAll(".chip").forEach((chip) => {
    const on = chip.dataset.kind === "alle";
    chip.classList.toggle("is-on", on);
    chip.setAttribute("aria-selected", on ? "true" : "false");
  });
  render();
  const card = wall.querySelector('[data-id="' + entry.id + '"]');
  if (card) card.scrollIntoView({ block: "center" });
});

document.querySelector("#export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(custom, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "kabinett-eigene.json";
  link.click();
  URL.revokeObjectURL(link.href);
  formMsg.textContent = custom.length
    ? "JSON gespeichert. Die Einträge kannst du in projects.json übernehmen."
    : "Noch keine eigenen Einträge auf diesem Gerät.";
});

async function boot() {
  try {
    const response = await fetch("projects.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    catalog = Array.isArray(data.projects) ? data.projects : [];
  } catch {
    status.textContent = "projects.json ließ sich nicht laden.";
    return;
  }
  render();
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!hash) return;
  const project = allProjects().find((item) => item.id === hash);
  if (project) openProject(project, wall.querySelector('[data-id="' + project.id + '"]'));
}

boot();
