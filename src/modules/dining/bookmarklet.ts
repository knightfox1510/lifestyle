/**
 * "Copy menu to Hearth": a bookmark you click on a restaurant page you've
 * opened yourself (Swiggy, Zomato, a restaurant's own site). It opens the
 * collapsed menu sections, scrolls so every dish loads, copies the page text
 * (with veg/non-veg labels) and hands it to a Hearth tab. No crawling, no
 * logins: it only reads the one page you're looking at.
 */

/**
 * Runs in the restaurant's page. Plain JavaScript in a string (not compiled
 * by the app's build), with __HEARTH__ replaced by Hearth's origin.
 */
const GRAB = String.raw`(function () {
  var H = "__HEARTH__";
  var w = window.open(H + "/dining/from-page", "_blank");
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var note = document.createElement("div");
  note.textContent = "Hearth: copying the menu…";
  note.style.cssText = "position:fixed;z-index:2147483647;top:12px;right:12px;max-width:320px;background:#111;color:#fff;padding:10px 14px;border-radius:10px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.3)";
  document.body.appendChild(note);
  (async function () {
    var root = document.querySelector("main") || document.body;
    root.querySelectorAll('[aria-expanded="false"]').forEach(function (e) {
      if (!e.closest("header,nav,footer,a,[role=dialog],[role=menu]")) { try { e.click(); } catch (x) {} }
    });
    for (var y = 0; y < document.documentElement.scrollHeight; y += 900) { window.scrollTo(0, y); await wait(150); }
    await wait(800);
    window.scrollTo(0, 0);
    var out = [];
    var walk = function (n) {
      if (n.nodeType === 3) { var t = (n.textContent || "").replace(/\s+/g, " ").trim(); if (t) out.push(t + " "); return; }
      if (n.nodeType !== 1 || n === note) return;
      var tag = n.tagName.toLowerCase();
      if (["script", "style", "noscript", "template", "iframe", "header", "footer", "nav"].indexOf(tag) >= 0) return;
      var st = getComputedStyle(n);
      if (st.display === "none" || st.visibility === "hidden") return;
      var label = n.getAttribute("aria-label") || n.getAttribute("alt") || n.getAttribute("title") || "";
      if (/\b(non[- ]?veg|veg|egg)/i.test(label) && label.length < 40) out.push("[" + label + "] ");
      if (tag === "svg" || tag === "img") return;
      var block = /^(div|p|li|h[1-6]|section|article|tr|br|button)$/.test(tag);
      if (block) out.push("\n");
      n.childNodes.forEach(walk);
      if (block) out.push("\n");
    };
    walk(root);
    var text = out.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim().slice(0, 300000);
    var data = { type: "hearth-menu", title: document.title, url: location.href, text: text };
    note.textContent = "Hearth: menu copied (" + Math.round(text.length / 1000) + "k characters). Switch to the Hearth tab.";
    var sent = false;
    window.addEventListener("message", function (e) {
      if (e.origin === H && e.data === "hearth-ready" && !sent && e.source) { e.source.postMessage(data, H); sent = true; }
    });
    setTimeout(function () {
      if (sent) return;
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      a.download = "hearth-menu.json";
      a.click();
      note.textContent = "Hearth: couldn't reach the Hearth tab, so the menu was downloaded as hearth-menu.json. Upload it on the Hearth tab.";
      if (!w) window.open(H + "/dining/from-page", "_blank");
    }, 15000);
    setTimeout(function () { note.remove(); }, 30000);
  })();
})()`;

/** The bookmark's address for this Hearth. */
export function bookmarkletHref(origin: string) {
  const code = GRAB.replace(/__HEARTH__/g, origin.replace(/[^\w:/.\-]/g, ""));
  return `javascript:${encodeURIComponent(`${code};void 0`)}`;
}

/** The restaurant name from a page title like "Order Burger Singh, Baner, Pune Online | Swiggy". */
export function placeFromTitle(title: string) {
  return title
    .replace(/^(order (food )?(online )?from |order )/i, "")
    .split(/\s[|–—-]\s|\s+menu\b|,|\s+order online\b|\s+online\b/i)[0]
    .trim()
    .slice(0, 120);
}
