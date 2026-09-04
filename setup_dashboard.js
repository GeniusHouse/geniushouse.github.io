#!/usr/bin/env node
/* Builds Dana's PostHog dashboard: four insights, one per question she asked.

   Needs a personal API key (not the project key) with write access.
   Put it in .env as POSTHOG_PERSONAL_KEY=phx_...  — .env is gitignored.

   Usage:  node setup_dashboard.js
           WEEKLY_EMAIL=dana@example.com node setup_dashboard.js   (also adds the Monday email)
*/

const fs = require("fs");

function loadEnv() {
  if (process.env.POSTHOG_PERSONAL_KEY) return process.env.POSTHOG_PERSONAL_KEY;
  try {
    const line = fs.readFileSync(".env", "utf8")
      .split("\n").find(l => l.trim().startsWith("POSTHOG_PERSONAL_KEY="));
    if (line) return line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  } catch (e) {}
  return null;
}

const KEY  = loadEnv();
const HOST = process.env.POSTHOG_HOST_APP || "https://us.posthog.com";
const RUN  = process.env.RUN_ID || "run_202609040254";   // "" to include every run

if (!KEY) {
  console.error("No personal API key found.\n" +
    "  echo 'POSTHOG_PERSONAL_KEY=phx_your_key' > .env\n" +
    "then run this again.");
  process.exit(1);
}

async function api(path, method = "GET", body) {
  const res = await fetch(`${HOST}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { raw: text.slice(0, 400) }; }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}\n${JSON.stringify(json, null, 2).slice(0, 800)}`);
  }
  return json;
}

/* Only count the tagged simulation run, so the dashboard matches the slides. */
const runFilter = RUN ? {
  type: "AND",
  values: [{ type: "AND", values: [
    { key: "run_id", value: [RUN], operator: "exact", type: "event" }
  ]}]
} : undefined;

const dateRange = { date_from: "-14d" };

function trends(event, breakdown, math = "total") {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      series: [{ kind: "EventsNode", event, math }],
      ...(breakdown ? { breakdownFilter: { breakdown, breakdown_type: "event" } } : {}),
      trendsFilter: { display: breakdown ? "ActionsBarValue" : "ActionsLineGraph" },
      dateRange,
      ...(runFilter ? { properties: runFilter } : {})
    }
  };
}

function funnel(events) {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      series: events.map(e => ({ kind: "EventsNode", event: e })),
      dateRange,
      ...(runFilter ? { properties: runFilter } : {})
    }
  };
}

const INSIGHTS = [
  { name: "Which tutors do people look at most?",
    description: "Times each tutor's card was seen. Compare with the bookings chart — the most-viewed tutor is not always the most booked.",
    query: trends("tutor_viewed", "tutor") },

  { name: "Do they book, or just leave?",
    description: "Every visit, how many reach the booking form, and how many finish.",
    query: funnel(["$pageview", "booking_started", "booking_completed"]) },

  { name: "Subjects parents asked for that we don't teach",
    description: "Typed in by a parent who filtered and found nothing. Unmet demand.",
    query: trends("subject_requested", "subject") },

  { name: "Where visitors came from",
    description: "Bookings by source. Answers whether the local Facebook group is pulling its weight.",
    query: trends("booking_completed", "traffic_source") }
];

(async () => {
  const project = await api("/projects/@current/");
  const pid = project.id;
  console.log(`Project: ${project.name} (id ${pid})`);
  if (RUN) console.log(`Filtering to run_id = ${RUN}\n`);

  const dash = await api(`/projects/${pid}/dashboards/`, "POST", {
    name: "ABC Tutoring — weekly",
    description: "The four things Dana asked to know about visitors to the site."
  });
  console.log(`Dashboard created: ${dash.name}`);

  for (const spec of INSIGHTS) {
    const insight = await api(`/projects/${pid}/insights/`, "POST", {
      name: spec.name,
      description: spec.description,
      query: spec.query,
      dashboards: [dash.id]
    });
    console.log(`  + ${insight.name}`);
  }

  const dashUrl = `${HOST}/project/${pid}/dashboard/${dash.id}`;

  if (process.env.WEEKLY_EMAIL) {
    const start = new Date();
    start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); // next Monday
    start.setHours(8, 0, 0, 0);
    try {
      await api(`/projects/${pid}/subscriptions/`, "POST", {
        dashboard: dash.id,
        target_type: "email",
        target_value: process.env.WEEKLY_EMAIL,
        frequency: "weekly",
        interval: 1,
        byweekday: ["monday"],
        start_date: start.toISOString(),
        title: "ABC Tutoring — your week"
      });
      console.log(`\nWeekly email to ${process.env.WEEKLY_EMAIL}, Mondays from ${start.toDateString()}`);
    } catch (e) {
      console.log(`\nDashboard is up, but the email subscription failed:\n${e.message}`);
    }
  } else {
    console.log("\nNo WEEKLY_EMAIL set, so no email subscription was created.");
  }

  console.log(`\n${dashUrl}`);
})().catch(e => { console.error("\nFailed:\n" + e.message); process.exit(1); });
