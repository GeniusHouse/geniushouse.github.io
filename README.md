# ABC Tutoring

A prototype booking site for ABC Tutoring, with PostHog telemetry.

Static HTML, CSS and JavaScript — no build step. Open `index.html`, or serve the
folder and visit it. Published at https://geniushouse.github.io.

## What it does

Parents browse six tutors (name, subjects, grade levels, hourly rate, open
times), filter by subject, and book a time. A booked slot stops showing as
available, and stays gone on reload.

## What Dana wanted to know, and where it comes from

| Her question | Event |
|---|---|
| Which tutors do people look at most? | `tutor_viewed` |
| Do they book, or just leave? | `$pageview` → `tutor_viewed` → `booking_started` → `booking_completed`, with `booking_abandoned` recording the field they stopped at |
| Which subjects are people looking for? | `subject_filtered`, `subject_unavailable`, `subject_requested` |
| Where did visitors come from — is the Facebook group working? | `traffic_source` on every event |

Post the Facebook group link as
`https://geniushouse.github.io/?utm_source=facebook_group` so that traffic is
attributable.

## Privacy

Visitors here are parents and children, so the site sends counts and paths, never
people:

- no names, email addresses or phone numbers are sent to PostHog
- session recording is off
- autocapture is off, so no click text can carry a student's name
- no person profiles, so nothing is tied to an individual across visits

The booking form's contents stay in the browser. Student grade is sent as a
number on its own, which identifies no one.

## Setup

Put the PostHog project key in `config.js`:

```js
window.ABC_CONFIG = {
  posthogKey:  "phc_...",
  posthogHost: "https://us.i.posthog.com"
};
```

The project key is a public client-side key and belongs in the repo. A personal
API key does not.

## Simulated traffic

`simulate.js` sends about a week of realistic visits so the dashboard has
something in it before real traffic arrives.

```
node simulate.js --dry-run          # print the shape, send nothing
POSTHOG_KEY=phc_... node simulate.js
```

Simulated events carry `$lib: abc-simulation`, so they can be filtered out of
real traffic later.

## Prototype limits

- Bookings live in the visitor's browser (`localStorage`), not a shared database.
  Two different people can book the same slot.
- No confirmation email or text is actually sent — the screen says one is coming.
- Tutor photos are initials until real headshots arrive.
