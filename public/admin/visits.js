(function () {
  const tbody = document.getElementById("tbody");
  const tokenInput = document.getElementById("token");
  const loadBtn = document.getElementById("load");
  const searchInput = document.getElementById("search");
  const metaEl = document.getElementById("meta");
  const errorEl = document.getElementById("error");
  const emptyEl = document.getElementById("empty");

  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get("token");
  if (tokenFromUrl) tokenInput.value = tokenFromUrl;

  let allVisits = [];
  let filteredVisits = [];
  let sortKey = "created_at";
  let sortDir = "desc";

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = msg ? "block" : "none";
  }

  function formatTime(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
    } catch (_) {
      return iso;
    }
  }

  function getSortValue(v, key) {
    const val = v[key];
    if (val == null) return "";
    if (key === "created_at" && typeof val === "string") return new Date(val).getTime();
    if (typeof val === "object") return JSON.stringify(val);
    return String(val).toLowerCase();
  }

  function sortVisits(list) {
    return [...list].sort(function (a, b) {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      let c = 0;
      if (va < vb) c = -1;
      else if (va > vb) c = 1;
      return sortDir === "asc" ? c : -c;
    });
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderRow(v) {
    const ua = v.ua ? String(v.ua).substring(0, 80) + (v.ua.length > 80 ? "…" : "") : "—";
    return (
      "<tr>" +
      "<td>" + escapeHtml(formatTime(v.created_at)) + "</td>" +
      "<td>" + escapeHtml(v.ip || "—") + "</td>" +
      "<td>" + escapeHtml(v.phone_from_url || "—") + "</td>" +
      '<td class="ua" title="' + escapeHtml(v.ua || "") + '">' + escapeHtml(ua) + "</td>" +
      "<td>" + escapeHtml(v.timezone || "—") + "</td>" +
      "<td>" + escapeHtml(v.platform || "—") + "</td>" +
      "<td>" + escapeHtml([v.screen_w, v.screen_h].filter(Boolean).join("×") || "—") + "</td>" +
      "<td>" + escapeHtml([v.viewport_w, v.viewport_h].filter(Boolean).join("×") || "—") + "</td>" +
      "<td>" + escapeHtml(v.language || "—") + "</td>" +
      "</tr>"
    );
  }

  function render() {
    const list = sortVisits(filteredVisits);
    tbody.innerHTML = list.map(renderRow).join("");
    emptyEl.style.display = list.length === 0 && allVisits.length > 0 ? "block" : "none";
    metaEl.textContent = "Showing " + list.length + " of " + allVisits.length + " visits.";
  }

  function filterList() {
    const q = (searchInput.value || "").trim().toLowerCase();
    if (!q) {
      filteredVisits = allVisits;
    } else {
      filteredVisits = allVisits.filter(function (v) {
        const str = JSON.stringify(v).toLowerCase();
        return str.indexOf(q) !== -1;
      });
    }
    render();
  }

  loadBtn.addEventListener("click", async function () {
    const token = (tokenInput.value || "").trim();
    if (!token) {
      showError("Enter the admin token.");
      return;
    }
    showError("");
    loadBtn.disabled = true;
    try {
      const r = await fetch("/admin/visits?token=" + encodeURIComponent(token));
      if (!r.ok) {
        if (r.status === 401) showError("Invalid or missing token.");
        else showError("Request failed: " + r.status);
        allVisits = [];
      } else {
        allVisits = await r.json();
        if (!Array.isArray(allVisits)) allVisits = [];
      }
      filteredVisits = allVisits;
      render();
    } catch (e) {
      showError("Network error: " + e.message);
      allVisits = [];
      filteredVisits = [];
      render();
    } finally {
      loadBtn.disabled = false;
    }
  });

  searchInput.addEventListener("input", function () {
    filterList();
  });
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") filterList();
  });

  document.querySelectorAll("th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      const key = th.getAttribute("data-sort");
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = "desc";
      }
      document.querySelectorAll("th .sort-icon").forEach(function (s) {
        s.textContent = "↕";
      });
      th.querySelector(".sort-icon").textContent = sortDir === "asc" ? "↑" : "↓";
      render();
    });
  });

  if (tokenFromUrl) loadBtn.click();
})();
