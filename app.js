(function () {
  var TUTORS = window.ABC_TUTORS;
  var TRACK  = window.ABC_TRACK;
  var STORE  = "abc_bookings_v1";

  var listEl    = document.getElementById("tutor-list");
  var noMatchEl = document.getElementById("no-match");
  var sheet     = document.getElementById("sheet");
  var scrim     = document.getElementById("scrim");

  var current = { tutor: null, slot: null, lastField: null };

  /* ---------- stored bookings ---------- */

  function bookings() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; }
    catch (e) { return []; }
  }

  function isTaken(slotId) {
    return bookings().some(function (b) { return b.slotId === slotId; });
  }

  function saveBooking(b) {
    var all = bookings();
    all.push(b);
    try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) {}
  }

  /* ---------- formatting ---------- */

  function initials(name) {
    return name.split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2);
  }

  function slotLabel(iso) {
    var d = new Date(iso);
    var day = d.toLocaleDateString(undefined, { weekday: "short" });
    var hour = d.getHours();
    var suffix = hour >= 12 ? "pm" : "am";
    var h12 = hour % 12 === 0 ? 12 : hour % 12;
    return day + " " + h12 + suffix;
  }

  function slotLabelLong(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
         + " at " + slotLabel(iso).split(" ")[1];
  }

  function openSlots(tutorId) {
    return window.ABC_SLOTS.filter(function (s) {
      return s.tutorId === tutorId && !isTaken(s.id);
    });
  }

  /* ---------- rendering ---------- */

  var seen = {};
  var observer = ("IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.dataset.tutorId;
          if (seen[id]) return;
          seen[id] = true;
          TRACK.tutorViewed(TUTORS.find(function (t) { return t.id === id; }));
        });
      }, { threshold: 0.6 })
    : null;

  function render(filter) {
    listEl.innerHTML = "";
    var shown = TUTORS.filter(function (t) {
      return filter === "all" || t.subject === filter;
    });

    shown.forEach(function (t) {
      var slots = openSlots(t.id);

      var li = document.createElement("li");
      li.className = "tutor";
      li.dataset.tutorId = t.id;

      var face = document.createElement("span");
      face.className = "tutor-face";
      face.setAttribute("aria-hidden", "true");
      face.textContent = initials(t.name);

      var body = document.createElement("div");
      var h3 = document.createElement("h3");
      h3.className = "tutor-name";
      h3.textContent = t.name;

      var meta = document.createElement("p");
      meta.className = "tutor-meta";
      meta.textContent = t.teaches;

      var meta2 = document.createElement("p");
      meta2.className = "tutor-meta";
      meta2.textContent = t.grades + " · ";
      var rate = document.createElement("span");
      rate.className = "tutor-rate";
      rate.textContent = "$" + t.rate + "/hr";
      meta2.appendChild(rate);

      body.append(h3, meta, meta2);

      var slotWrap = document.createElement("div");
      if (slots.length) {
        slotWrap.className = "slots";
        slots.forEach(function (s) {
          var b = document.createElement("button");
          b.className = "slot";
          b.type = "button";
          b.textContent = slotLabel(s.start);
          b.setAttribute("aria-label", "Book " + t.name + ", " + slotLabelLong(s.start));
          b.addEventListener("click", function () { openSheet(t, s); });
          slotWrap.appendChild(b);
        });
      } else {
        slotWrap.className = "slots-none";
        slotWrap.textContent = "Fully booked this week.";
      }

      li.append(face, body, slotWrap);
      listEl.appendChild(li);
      if (observer) observer.observe(li);
    });

    return shown.length;
  }

  /* ---------- filters ---------- */

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.querySelectorAll(".chip").forEach(function (c) {
        c.classList.remove("is-on");
        c.setAttribute("aria-pressed", "false");
      });
      chip.classList.add("is-on");
      chip.setAttribute("aria-pressed", "true");

      var f = chip.dataset.filter;

      if (f === "other") {
        listEl.innerHTML = "";
        noMatchEl.hidden = false;
        document.getElementById("no-match-subject").textContent = "second";
        document.querySelector(".no-match-head").textContent =
          "Looking for something we don't list?";
        TRACK.subjectFiltered("other", 0);
        TRACK.subjectUnavailable("unlisted");
        return;
      }

      noMatchEl.hidden = true;
      var n = render(f);
      TRACK.subjectFiltered(f, n);
    });
  });

  document.getElementById("ask-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = document.getElementById("ask-subject").value.trim();
    if (!v) return;
    TRACK.subjectRequested(v);
    e.target.hidden = true;
    document.getElementById("ask-thanks").hidden = false;
  });

  /* ---------- booking sheet ---------- */

  var subjectSel = document.getElementById("booking-subject");

  function openSheet(tutor, slot) {
    current = { tutor: tutor, slot: slot, lastField: null };

    document.getElementById("sheet-tutor").textContent = tutor.name;
    document.getElementById("sheet-slot").textContent = slotLabelLong(slot.start);

    subjectSel.innerHTML = "";
    tutor.teaches.split(", ").forEach(function (s) {
      var o = document.createElement("option");
      o.textContent = s;
      subjectSel.appendChild(o);
    });

    document.getElementById("sheet-form-view").hidden = false;
    document.getElementById("sheet-done-view").hidden = true;
    document.getElementById("form-error").hidden = true;
    document.getElementById("booking-form").reset();

    sheet.hidden = false;
    scrim.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("parent-name").focus();

    TRACK.bookingStarted(tutor, slot.start);
  }

  function closeSheet(completed) {
    if (!completed && current.tutor) TRACK.bookingAbandoned(current.tutor, current.lastField);
    sheet.hidden = true;
    scrim.hidden = true;
    document.body.style.overflow = "";
    current = { tutor: null, slot: null, lastField: null };
  }

  document.getElementById("sheet-close").addEventListener("click", function () { closeSheet(false); });
  scrim.addEventListener("click", function () { closeSheet(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !sheet.hidden) closeSheet(false);
  });

  document.getElementById("booking-form").addEventListener("focusin", function (e) {
    if (e.target.name) current.lastField = e.target.name;
  });

  document.getElementById("booking-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    var err = document.getElementById("form-error");

    if (!f.checkValidity()) {
      var missing = f.querySelector(":invalid");
      err.textContent = missing && missing.type === "email" && missing.value
        ? "That email address doesn't look right."
        : "Please fill in every field so we know who to expect.";
      err.hidden = false;
      if (missing) missing.focus();
      return;
    }

    var grade = f.studentGrade.value;
    var tutor = current.tutor, slot = current.slot;

    saveBooking({
      slotId: slot.id, tutorId: tutor.id, at: slot.start,
      bookedAt: new Date().toISOString()
    });

    TRACK.bookingCompleted(tutor, slot.start, grade);

    document.getElementById("done-line").textContent =
      tutor.name + ", " + slotLabelLong(slot.start) + ".";
    document.getElementById("done-email").textContent = f.parentEmail.value;
    document.getElementById("sheet-form-view").hidden = true;
    document.getElementById("sheet-done-view").hidden = false;

    render(document.querySelector(".chip.is-on").dataset.filter || "all");
  });

  document.getElementById("done-close").addEventListener("click", function () {
    closeSheet(true);
  });

  /* ---------- go ---------- */

  TRACK.pageView();
  render("all");

  document.querySelector('[data-cta="hero"]').addEventListener("click", function () {
    TRACK.subjectFiltered("all", TUTORS.length);
  });
})();
