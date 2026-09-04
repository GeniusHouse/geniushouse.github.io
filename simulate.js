#!/usr/bin/env node
/* Simulates a week of visitors so Dana's dashboard has real shape to it.
   Sends the same events the live site sends — no names, no emails.

   Usage:  POSTHOG_KEY=phc_xxx node simulate.js
           POSTHOG_KEY=phc_xxx POSTHOG_HOST=https://eu.i.posthog.com node simulate.js
           node simulate.js --dry-run          (prints a summary, sends nothing)
*/

const KEY  = process.env.POSTHOG_KEY;
const HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
const DRY  = process.argv.includes("--dry-run");
const RUN  = "run_" + new Date().toISOString().slice(0,16).replace(/[-:T]/g,"");

if (!KEY && !DRY) {
  console.error("Set POSTHOG_KEY, or pass --dry-run.");
  process.exit(1);
}

const TUTORS = [
  { name: "Maya Rivera",   subject: "Math",    rate: 45, weight: 26 },
  { name: "Priya Raman",   subject: "Math",    rate: 48, weight: 24 },
  { name: "Daniel Okafor", subject: "Math",    rate: 40, weight: 18 },
  { name: "Grace Kim",     subject: "Math",    rate: 38, weight: 12 },
  { name: "Tomas Alvarez", subject: "Science", rate: 45, weight: 13 },
  { name: "Ruth Bennett",  subject: "Reading", rate: 40, weight:  7 }
];

// Dana's real question: is the local Facebook group working?
const SOURCES = [
  { name: "facebook_group", weight: 38, converts: 1.35 },
  { name: "search",         weight: 24, converts: 0.85 },
  { name: "direct",         weight: 21, converts: 1.10 },
  { name: "instagram",      weight: 11, converts: 0.60 },
  { name: "flyer_qr",       weight:  6, converts: 1.20 }
];

const WANTED_BUT_MISSING = ["Spanish", "Chemistry", "Spanish", "Physics",
                            "Spanish", "French", "Chemistry", "Writing"];
const GRADES = ["5","6","6","7","7","7","8","8","9","10","4","11"];
const FIELDS = ["parentName", "parentEmail", "studentName", "studentGrade", "subject"];

const rand   = n => Math.floor(Math.random() * n);
const chance = p => Math.random() < p;
const pick   = a => a[rand(a.length)];

function weighted(list) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of list) { r -= x.weight; if (r <= 0) return x; }
  return list[list.length - 1];
}

const queue = [];
function emit(event, distinct_id, ts, props) {
  queue.push({
    event,
    properties: { distinct_id, $lib: "abc-simulation", run_id: RUN, ...props },
    timestamp: new Date(ts).toISOString()
  });
}

/* Weekday afternoons and evenings are when mothers actually browse. */
function sessionTime(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const hour = chance(0.55) ? 19 + rand(3) : 12 + rand(6);
  d.setHours(hour, rand(60), rand(60), 0);
  return d.getTime();
}

let sessions = 0, bookings = 0;
const DAYS = 7;

for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
  const isWeekend = [0, 6].includes(new Date(Date.now() - daysAgo * 864e5).getDay());
  const count = (isWeekend ? 18 : 30) + rand(12);

  for (let i = 0; i < count; i++) {
    sessions++;
    const id  = `sim_${daysAgo}_${i}_${rand(1e6)}`;
    const src = weighted(SOURCES);
    let t     = sessionTime(daysAgo);
    const base = { traffic_source: src.name };

    emit("$pageview", id, t, { ...base, $current_url: "https://geniushouse.github.io/" });

    // a chunk of visitors bounce off the homepage
    if (!chance(0.76)) continue;
    t += 4000 + rand(20000);

    // some filter by subject first
    if (chance(0.42)) {
      const s = weighted([
        { name: "Math", weight: 62 }, { name: "Science", weight: 16 },
        { name: "Reading", weight: 12 }, { name: "other", weight: 17 }
      ]).name;

      if (s === "other") {
        emit("subject_filtered", id, t, { ...base, subject: "other", results: 0 });
        emit("subject_unavailable", id, t + 900, { ...base, subject: "unlisted" });
        if (chance(0.72)) {
          emit("subject_requested", id, t + 6000, { ...base, subject: pick(WANTED_BUT_MISSING) });
        }
        continue;
      }
      emit("subject_filtered", id, t, { ...base, subject: s,
        results: s === "Math" ? 4 : 1 });
      t += 3000 + rand(9000);
    }

    // browse two or three tutors
    const looked = new Set();
    const n = 1 + rand(3);
    for (let k = 0; k < n; k++) {
      const tu = weighted(TUTORS);
      if (looked.has(tu.name)) continue;
      looked.add(tu.name);
      t += 3000 + rand(14000);
      emit("tutor_viewed", id, t, { ...base, tutor: tu.name, subject: tu.subject, rate: tu.rate });
    }

    // start a booking?
    if (!chance(0.34 * src.converts)) continue;
    const tu = weighted(TUTORS.filter(x => looked.has(x.name)).length
      ? TUTORS.filter(x => looked.has(x.name)) : TUTORS);
    t += 5000 + rand(12000);
    const slot = new Date(t + (1 + rand(6)) * 864e5).toISOString();
    emit("booking_started", id, t, { ...base, tutor: tu.name, subject: tu.subject, slot });

    // finish it?
    t += 20000 + rand(70000);
    if (chance(0.57)) {
      bookings++;
      emit("booking_completed", id, t, {
        ...base, tutor: tu.name, subject: tu.subject, slot,
        student_grade: pick(GRADES), rate: tu.rate
      });
    } else {
      emit("booking_abandoned", id, t, {
        ...base, tutor: tu.name, subject: tu.subject,
        last_field: weighted([
          { name: "parentEmail", weight: 34 }, { name: "studentName", weight: 24 },
          { name: "parentName",  weight: 18 }, { name: "studentGrade", weight: 14 },
          { name: "subject",     weight: 10 }
        ]).name
      });
    }
  }
}

queue.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);

const tally = queue.reduce((m, e) => (m[e.event] = (m[e.event] || 0) + 1, m), {});
console.log(`${DAYS + 1} days · ${sessions} sessions · ${queue.length} events · ${bookings} bookings`);
console.table(tally);

/* Write down what this run actually contained, so the numbers can be checked
   later without querying PostHog. */
function countBy(event, prop) {
  return queue.filter(e => e.event === event)
    .reduce((m, e) => (m[e.properties[prop]] = (m[e.properties[prop]] || 0) + 1, m), {});
}
const summary = {
  generated_at: new Date().toISOString(), run_id: RUN,
  days: DAYS + 1, sessions, events: queue.length, bookings,
  by_event: tally,
  tutor_views:      countBy("tutor_viewed", "tutor"),
  bookings_by_tutor: countBy("booking_completed", "tutor"),
  sessions_by_source: countBy("$pageview", "traffic_source"),
  bookings_by_source: countBy("booking_completed", "traffic_source"),
  abandoned_at_field: countBy("booking_abandoned", "last_field"),
  subjects_requested: countBy("subject_requested", "subject")
};
require("fs").writeFileSync("simulation-summary.json", JSON.stringify(summary, null, 2));
console.log("Wrote simulation-summary.json");

if (DRY) { console.log("\nDry run — nothing sent."); process.exit(0); }

(async () => {
  const CHUNK = 500;
  for (let i = 0; i < queue.length; i += CHUNK) {
    const batch = queue.slice(i, i + CHUNK);
    const res = await fetch(`${HOST}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: KEY, batch })
    });
    if (!res.ok) {
      console.error(`Batch failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    process.stdout.write(`  sent ${Math.min(i + CHUNK, queue.length)}/${queue.length}\r`);
  }
  console.log(`\nSent ${queue.length} events to ${HOST}. Give PostHog a minute to ingest.`);
})();
