// EatWellStories — progressive enhancement only (no data is sent to a server in this build)
(function () {
  "use strict";

  // Root-aware path prefix (articles ../../, categories ../, root ./)
  var depth = location.pathname.replace(/\/$/, "").split("/").filter(Boolean).length;
  var rootPrefix = depth > 1 ? "../".repeat(depth - 1) : "./";

  /* ---------- Mobile navigation toggle ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- Header search button (injected on every page) ---------- */
  var headerInner = document.querySelector(".header-inner");
  if (headerInner && !document.querySelector(".nav-search-btn")) {
    var btn = document.createElement("a");
    btn.href = rootPrefix + "search.html";
    btn.className = "nav-search-btn";
    btn.setAttribute("aria-label", "Search the EatWellStories guides");
    btn.title = "Search guides";
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg><span class="nav-search-label">Search</span>';
    if (nav && nav.parentNode === headerInner) {
      headerInner.insertBefore(btn, nav.nextSibling);
    } else {
      headerInner.appendChild(btn);
    }
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) { yearEl.textContent = new Date().getFullYear(); }

  /* ---------- Newsletter / lead forms: prepare for future Brevo integration.
       No email address is ever placed in a URL; no subscription claim is simulated.
       On valid input we reveal the direct free PDF download. ---------- */
  document.querySelectorAll("form.newsletter-form").forEach(function (form) {
    if (form.classList.contains("contact-form")) { return; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector("input[type=email]");
      if (!email || !email.checkValidity()) { if (email) email.focus(); return; }
      var done = document.getElementById("nl-success");
      if (!done) {
        done = document.createElement("div");
        done.id = "nl-success";
        done.className = "nl-success";
        done.setAttribute("role", "status");
        done.innerHTML =
          "<p><strong>Thank you — your free guide is ready below.</strong></p>" +
          '<p><a class="btn" href="' + rootPrefix + 'assets/lead-magnet/7-day-healthy-meal-planner.pdf" download rel="noopener">Download the free 7-Day Healthy Meal Planner (PDF)</a></p>' +
          "<p class=\"fine-print\">Your email is not stored in this static build. The newsletter list opens when the email provider (Brevo) is connected; you can check the planner now without waiting.</p>";
        form.parentNode.insertBefore(done, form.nextSibling);
      }
      form.style.display = "none";
      done.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  /* ---------- Hero search on the homepage: go to the search page ---------- */
  var heroForm = document.querySelector("form.hero-search");
  if (heroForm) {
    heroForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = (heroForm.querySelector("input[name=q]") || heroForm.querySelector("input[type=search]")).value.trim();
      window.location.href = "search.html" + (q ? "?q=" + encodeURIComponent(q) : "");
    });
  }

  /* ---------- Respect the sitelink SearchAction: /?s=term -> search page ---------- */
  var params = new URLSearchParams(window.location.search);
  if (params.has("s") && !document.getElementById("q")) {
    window.location.replace("search.html?q=" + encodeURIComponent(params.get("s") || ""));
  }

  /* ---------- Functional site search (search.html) ---------- */
  var input = document.getElementById("q");
  if (input && document.getElementById("search-results")) {
    var list = document.getElementById("search-results");
    var status = document.getElementById("search-status");
    var emptyBox = document.getElementById("search-empty");
    var data = null;
    var activeIdx = -1;
    var RAW_URL = "assets/search-index.json";

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    function tokens(q) {
      return q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
    }
    function score(a, q) {
      var ts = tokens(q); var s = 0;
      var t = a.title.toLowerCase(), c = a.category.toLowerCase(),
          k = (a.keywords || "").toLowerCase(), d = a.description.toLowerCase();
      ts.forEach(function (w) {
        if (t.indexOf(w) >= 0) s += 6;
        if (k.indexOf(w) >= 0) s += 3;
        if (c.indexOf(w) >= 0) s += 2;
        if (d.indexOf(w) >= 0) s += 1;
        if ((t + " " + k + " " + c + " " + d).indexOf(w) < 0) s -= 8;
      });
      return s;
    }
    function card(a) {
      return '<article class="card search-result" data-score="' + score(a, input.value.trim()) + '">' +
        '<a class="card-media" href="' + a.url + '" tabindex="-1">' +
        '<img src="' + a.image + '" alt="' + esc(a.title) + '" loading="lazy" width="1200" height="630"></a>' +
        '<div class="card-body">' +
        '<span class="badge">' + esc(a.category) + "</span>" +
        "<h3><a href=\"" + a.url + '">' + esc(a.title) + "</a></h3>" +
        "<p>" + esc(a.description) + "</p>" +
        '<p class="card-meta">' + a.minutes + " min read</p>" +
        "</div></article>";
    }
    function renderAll() {
      emptyBox.hidden = false;
      list.innerHTML = data.map(card).join("");
      status.textContent = "Showing all " + data.length + " guides. Type a keyword to filter.";
      activeIdx = -1;
    }
    function render() {
      if (!data) { return; }
      var q = input.value.trim();
      activeIdx = -1;
      if (!q) { renderAll(); return; }
      var hits = data.map(function (a) { return { a: a, s: score(a, q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (x, y) { return y.s - x.s; });
      emptyBox.hidden = hits.length > 0;
      if (hits.length) {
        list.innerHTML = hits.map(function (x) { return card(x.a); }).join("");
        status.textContent = hits.length + (hits.length === 1 ? " guide matches" : " guides match") + " “" + q + "”.";
      } else {
        list.innerHTML = data.map(card).join("");
        status.textContent = 'No guide matches “' + q + '”. Try one of the popular keywords below or browse all guides.';
      }
    }
    function moveActive(dir) {
      var links = Array.prototype.slice.call(list.querySelectorAll("a[href]"));
      if (!links.length) return;
      activeIdx += dir;
      if (activeIdx < 0) activeIdx = links.length - 1;
      if (activeIdx >= links.length) activeIdx = 0;
      links.forEach(function (l, i) { l.parentElement.classList.toggle("active", i === activeIdx); });
      links[activeIdx].focus();
    }
    fetch(RAW_URL).then(function (r) { return r.json(); }).then(function (j) {
      data = j.articles;
      var initial = params.get("q") || "";
      if (initial) { input.value = initial; }
      render();
    }).catch(function () {
      status.textContent = "The search index could not load. Please browse the categories below.";
    });

    var debounce;
    input.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(render, 140);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Escape") { input.value = ""; render(); input.focus(); }
    });
    document.getElementById("search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      render();
      var first = list.querySelector("a[href]");
      if (first) { first.focus(); }
    });
  }

  /* ---------- Homepage category filter chips ---------- */
  var latestGrid = document.querySelector(".card-grid-latest");
  if (latestGrid) {
    var cards = Array.prototype.slice.call(latestGrid.querySelectorAll(".card"));
    var cats = [];
    cards.forEach(function (c) {
      var b = c.querySelector(".badge");
      var t = b ? b.textContent.trim() : "";
      if (t && cats.indexOf(t) < 0) { cats.push(t); }
      c.setAttribute("data-category", t);
    });
    var chipWrap = document.createElement("div");
    chipWrap.className = "filter-chips";
    chipWrap.setAttribute("role", "group");
    chipWrap.setAttribute("aria-label", "Filter guides by category");
    var status = document.createElement("p");
    status.className = "filter-status";
    status.setAttribute("aria-live", "polite");
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-chip active";
    allBtn.setAttribute("aria-pressed", "true");
    allBtn.textContent = "All guides";
    allBtn.dataset.cat = "";
    chipWrap.appendChild(allBtn);
    cats.forEach(function (cat) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "filter-chip";
      b.setAttribute("aria-pressed", "false");
      b.textContent = cat;
      b.dataset.cat = cat;
      chipWrap.appendChild(b);
    });
    latestGrid.parentNode.insertBefore(chipWrap, latestGrid);
    latestGrid.parentNode.insertBefore(status, latestGrid.nextSibling);
    function applyFilter(cat) {
      var shown = 0;
      cards.forEach(function (c) {
        var show = !cat || c.getAttribute("data-category") === cat;
        c.hidden = !show;
        if (show) { shown++; }
      });
      status.textContent = shown + " guide" + (shown === 1 ? "" : "s") + " shown" + (cat ? " in " + cat : "") + ".";
    }
    chipWrap.addEventListener("click", function (e) {
      var b = e.target.closest(".filter-chip");
      if (!b) { return; }
      chipWrap.querySelectorAll(".filter-chip").forEach(function (x) {
        x.classList.remove("active");
        x.setAttribute("aria-pressed", "false");
      });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      applyFilter(b.dataset.cat);
    });
    applyFilter("");
  }

  /* ---------- Article share buttons (articles only) ---------- */
  var articleMain = document.querySelector("article.article-main");
  if (articleMain) {
    var canonical = document.querySelector("link[rel=canonical]");
    var shareUrl = canonical ? canonical.href : window.location.href;
    var shareTitle = document.title;
    var ogImage = document.querySelector('meta[property="og:image"]');
    var mediaUrl = ogImage ? ogImage.content : shareUrl;
    function enc(s) { return encodeURIComponent(s); }
    var bar = document.createElement("div");
    bar.className = "share-bar";
    bar.setAttribute("aria-label", "Share this guide");
    var html = "";
    if (navigator.share) {
      html += '<button type="button" class="share-btn" data-share="native">Share</button>';
    }
    html += '<button type="button" class="share-btn" data-share="copy">Copy link</button>' +
      '<a class="share-btn" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=' + enc(shareUrl) + '&text=' + enc(shareTitle) + '">Post on X</a>' +
      '<a class="share-btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + enc(shareUrl) + '">Share on Facebook</a>' +
      '<a class="share-btn" target="_blank" rel="noopener" href="https://pinterest.com/pin/create/button/?url=' + enc(shareUrl) + '&media=' + enc(mediaUrl) + '&description=' + enc(shareTitle) + '">Pin on Pinterest</a>';
    bar.innerHTML = html;
    var articleHead = articleMain.querySelector(".article-head");
    articleHead.parentNode.insertBefore(bar, articleHead.nextSibling);
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-share]");
      if (!b) { return; }
      e.preventDefault();
      if (b.dataset.share === "native" && navigator.share) {
        navigator.share({ title: shareTitle, url: shareUrl }).catch(function () {});
      } else if (b.dataset.share === "copy") {
        var done = function () {
          b.classList.add("copied");
          b.textContent = "Link copied";
          setTimeout(function () { b.classList.remove("copied"); b.textContent = "Copy link"; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(done, done);
        } else {
          var ta = document.createElement("textarea");
          ta.value = shareUrl;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch (x) {}
          ta.remove();
          done();
        }
      }
    });

    /* Planner download card injected into the article aside */
    var asideEl = document.querySelector(".article-aside");
    if (asideEl) {
      var planner = document.createElement("div");
      planner.className = "aside-card";
      planner.innerHTML =
        "<h2>Free 7-Day meal planner</h2>" +
        "<p>Balanced days, a categorized grocery list and prep tips in one free PDF.</p>" +
        '<a class="btn" href="' + rootPrefix + 'assets/lead-magnet/7-day-healthy-meal-planner.pdf" download rel="noopener">Download the PDF</a> ' +
        '<a class="btn btn-outline" href="' + rootPrefix + 'lead-magnet.html" style="margin-top:8px">About the planner</a>';
      asideEl.appendChild(planner);
    }
  }

  /* ---------- Cookie preferences button: reopen the consent banner ---------- */
  document.querySelectorAll("[data-cookie-preferences]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      try { localStorage.removeItem("ews_consent"); } catch (e) {}
      var bar = document.getElementById("ews-consent");
      if (bar) { bar.style.display = "flex"; }
    });
  });

  /* ---------- Mark external links with rel noopener ---------- */
  document.querySelectorAll("a[href^='http']").forEach(function (a) {
    if (!a.getAttribute("rel")) { a.setAttribute("rel", "noopener"); }
  });
})();
