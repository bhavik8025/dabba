/* Dabba website — forms, reveal animations, anonymous pageview counter. No cookies, no trackers. */
(function () {
  "use strict";

  var SB_URL = "https://bklkhixrkwfbdxcttmls.supabase.co/rest/v1/";
  var SB_KEY = "sb_publishable_xCupzxdv-Hf_Uw55ijb1eg_VtDnMU-k"; // public, write-only tables

  function sbInsert(table, row) {
    return fetch(SB_URL + table, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  }

  /* ── anonymous pageview (one per session, stored in OUR db, no third parties) ── */
  try {
    if (!sessionStorage.getItem("dabba-pv")) {
      sessionStorage.setItem("dabba-pv", "1");
      sbInsert("events", {
        name: "site_pageview",
        meta: { path: location.pathname, ref: document.referrer || null },
      }).catch(function () {});
    }
  } catch (e) { /* storage blocked — fine */ }

  /* ── scroll reveal ── */
  try {
    var items = document.querySelectorAll(
      "section .wrap > h2, section .wrap > .kicker, .card, .steps li, .shots figure, .faq details, .form-card, .chat .bubble"
    );
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      items.forEach(function (el, i) {
        el.classList.add("reveal");
        el.style.transitionDelay = (i % 6) * 60 + "ms";
        io.observe(el);
      });
    }
  } catch (e) {}

  /* ── forms ── */
  function wireForm(id, table, build) {
    var form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var msg = form.querySelector(".form-msg");
      var btn = form.querySelector("button[type=submit]");
      var fd = new FormData(form);

      if (fd.get("website")) { // honeypot — pretend success
        msg.textContent = "Sent — thank you! 🍱";
        msg.className = "form-msg ok";
        return;
      }
      var row = build(fd);
      if (!row) return;

      btn.disabled = true;
      btn.textContent = "Sending…";
      sbInsert(table, row)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          msg.textContent = "Sent — thank you! I read every one. 🍱";
          msg.className = "form-msg ok";
          form.reset();
        })
        .catch(function () {
          msg.textContent = "Couldn't send — please try again (or DM me on LinkedIn).";
          msg.className = "form-msg err";
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = id === "lead-form" ? "Get set-up help — free" : "Send feedback";
        });
    });
  }

  wireForm("lead-form", "leads", function (fd) {
    var contact = String(fd.get("contact") || "").trim();
    if (!contact) return null;
    return {
      name: String(fd.get("name") || "").trim() || null,
      contact: contact,
      message: String(fd.get("message") || "").trim() || null,
      source: "website",
    };
  });

  wireForm("feedback-form", "feedback", function (fd) {
    var message = String(fd.get("message") || "").trim();
    if (!message) return null;
    var rating = parseInt(fd.get("rating"), 10);
    return {
      rating: rating >= 1 && rating <= 5 ? rating : null,
      message: message,
      contact: String(fd.get("contact") || "").trim() || null,
      page: location.pathname,
      source: "website",
    };
  });
})();
