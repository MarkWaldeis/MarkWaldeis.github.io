/* ============================================================
   main.js — Orchestrierung: Scroll, Parallax, Reveals,
   Counter, Tilt, Cursor, Sektionen & Tiger-Regie
   ============================================================ */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;

  /* Test-Modus für Screenshots: index.html?static=1&scroll=0.35 */
  if (/[?&]static=1/.test(location.search)) {
    document.documentElement.classList.add("static-test");
    var sm = location.search.match(/[?&]scroll=([0-9.]+)/);
    if (sm) {
      window.addEventListener("load", function () {
        setTimeout(function () {
          window.scrollTo(0, parseFloat(sm[1]) * (document.documentElement.scrollHeight - window.innerHeight));
        }, 60);
      });
    }
  }

  /* ---------- Toast ---------- */
  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }

  /* ---------- Loader ---------- */
  var loader = document.getElementById("loader");
  var tigerImg = document.getElementById("tiger");
  var loaded = new Promise(function (res) {
    if (document.readyState === "complete") res();
    else window.addEventListener("load", res, { once: true });
  });
  var decoded = tigerImg.decode ? tigerImg.decode().catch(function () {}) : Promise.resolve();
  var minWait = new Promise(function (res) { setTimeout(res, reduced ? 0 : 900); });
  var timeout = new Promise(function (res) { setTimeout(res, 4500); });
  Promise.race([Promise.all([loaded, decoded, minWait]), timeout]).then(function () {
    loader.classList.add("done");
    setTimeout(function () { loader.remove(); }, 900);
  });

  /* ---------- Eigener Cursor ---------- */
  if (!coarse) {
    var dot = document.querySelector(".cursor-dot");
    var ring = document.querySelector(".cursor-ring");
    var rx = -100, ry = -100, mx = -100, my = -100;
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + (mx - 4) + "px," + (my - 4) + "px)";
    }, { passive: true });
    (function ringLoop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = "translate(" + (rx - 19) + "px," + (ry - 19) + "px)";
      requestAnimationFrame(ringLoop);
    })();
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest("a, button, .card, .shot, .tilt")) document.body.classList.add("cursor-hover");
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest("a, button, .card, .shot, .tilt")) document.body.classList.remove("cursor-hover");
    });
  }

  /* ---------- Scroll-Fortschritt + Nav + Dämmerung ---------- */
  var progressBar = document.getElementById("progressBar");
  var navEl = document.getElementById("nav");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  var root = document.documentElement;
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    progressBar.style.width = (p * 100) + "%";
    navEl.classList.toggle("scrolled", window.scrollY > 60);
    /* Der Dschungel erwacht: Dämmerung steigt mit dem Scrollen */
    root.style.setProperty("--dawn", (p * p * 0.75).toFixed(3));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Parallax-Ebenen ----------
     data-para        = Maus + Scroll
     data-para-m      = nur Maus
     data-para-scroll = eigener Scroll-Faktor (überschreibt d*0.12) */
  var paraLayers = Array.prototype.slice.call(document.querySelectorAll("[data-para], [data-para-m]"));
  var parallaxMouse = { x: 0, y: 0 };
  if (!reduced) {
    window.addEventListener("mousemove", function (e) {
      parallaxMouse.x = e.clientX / window.innerWidth - 0.5;
      parallaxMouse.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    (function paraLoop() {
      var sy = window.scrollY;
      paraLayers.forEach(function (el) {
        var mouseOnly = el.hasAttribute("data-para-m");
        var d = parseFloat(el.getAttribute(mouseOnly ? "data-para-m" : "data-para")) || 0;
        var sFactor = el.hasAttribute("data-para-scroll")
          ? parseFloat(el.getAttribute("data-para-scroll")) || 0
          : d * 0.12;
        var px = parallaxMouse.x * 26 * d;
        var py = parallaxMouse.y * 16 * d - (mouseOnly ? 0 : sy * sFactor);
        el.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)";
      });
      requestAnimationFrame(paraLoop);
    })();
  }

  /* ---------- Reveals ---------- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        revealIO.unobserve(en.target);
        if (en.target.hasAttribute("data-count")) runCounter(en.target);
        en.target.querySelectorAll("[data-count]").forEach(function (c) { runCounter(c); });
      }
    });
  }, { threshold: 0.18 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealIO.observe(el); });

  /* ---------- Zähler ---------- */
  function runCounter(el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    var target = parseFloat(el.getAttribute("data-count")) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var dur = 1500, t0 = null;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * eased).toLocaleString("de-DE") + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    if (reduced) { el.textContent = target.toLocaleString("de-DE") + suffix; return; }
    requestAnimationFrame(step);
  }

  /* ---------- 3D-Tilt-Karten ---------- */
  if (!coarse && !reduced) {
    document.querySelectorAll(".tilt").forEach(function (el) {
      var rect = null;
      el.addEventListener("mouseenter", function () { rect = el.getBoundingClientRect(); });
      el.addEventListener("mousemove", function (e) {
        var r = rect || el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.transform =
          "perspective(900px) rotateX(" + ((0.5 - py) * 9).toFixed(2) + "deg) rotateY(" + ((px - 0.5) * 11).toFixed(2) + "deg) translateY(-3px)";
        el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
        rect = null;
      });
    });
  }

  /* ---------- Sektionen -> Tiger-Regie + Kapitel ---------- */
  var chapterLabel = document.getElementById("chapterLabel");
  var sectionIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var t = (en.target.getAttribute("data-tiger") || "0.5,0.8").split(",");
      if (window.Tiger) Tiger.setAnchor(parseFloat(t[0]), parseFloat(t[1]));
      if (chapterLabel) chapterLabel.textContent = en.target.getAttribute("data-title") || "";
      navLinks.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id);
      });
    });
  }, { threshold: 0.32 });
  document.querySelectorAll(".section").forEach(function (s) { sectionIO.observe(s); });

  /* ---------- Klick-Interaktion: Tiger kommt (oder schnaubt) ---------- */
  function onInteractive(e) {
    return e.target && e.target.closest && !!e.target.closest("a, button, input, textarea, select");
  }
  document.addEventListener("click", function (e) {
    if (onInteractive(e)) return;
    if (window.Tiger) {
      var fx = e.clientX / window.innerWidth;
      if (!reduced && Tiger.getX && Math.abs(fx - Tiger.getX()) < 0.11) {
        Tiger.snort();                       /* fast erwischt! */
        toast("Ein leises Schnauben …");
      } else {
        Tiger.dashTo(fx);                    /* bei reduced: sofortiges Umsetzen */
      }
      if (window.Jungle && !reduced) Jungle.burst(e.clientX, e.clientY);
    }
  });

  /* Doppelklick: Tiger schnaubt */
  document.addEventListener("dblclick", function (e) {
    if (onInteractive(e)) return;
    if (window.Tiger && !reduced) {
      Tiger.snort();
      if (window.Jungle) Jungle.burst(e.clientX, e.clientY);
      toast("Ein leises Schnauben …");
    }
  });

  /* Taste T: Tiger rufen */
  document.addEventListener("keydown", function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "t" && e.key !== "T") return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    if (callBtn) callBtn.click();
  });

  /* ---------- Buttons ---------- */
  var callBtn = document.getElementById("callTiger");
  if (callBtn) callBtn.addEventListener("click", function () {
    if (window.Tiger) {
      if (!reduced) Tiger.pulse();
      Tiger.dashTo(0.5);
    }
    if (window.Jungle && !reduced) Jungle.burst(window.innerWidth * 0.5, window.innerHeight * 0.8);
    toast("Er kommt — ganz ruhig bleiben.");
  });

  var pateBtn = document.getElementById("pateBtn");
  if (pateBtn) pateBtn.addEventListener("click", function () {
    if (window.Jungle) {
      Jungle.burst(window.innerWidth * 0.3, window.innerHeight * 0.6);
      Jungle.burst(window.innerWidth * 0.7, window.innerHeight * 0.6);
    }
    if (window.Tiger && !reduced) Tiger.pulse();
    toast("Der Dschungel dankt dir. (Demo — kein echter Patenschaft-Aufruf)");
  });

  /* ---------- Start ---------- */
  if (window.Jungle) Jungle.start();
  if (window.Tiger) Tiger.start();
})();
