/* PostHog wiring. Every event Dana's weekly summary needs is defined here, and
   nothing else in the app calls posthog directly.

   Privacy stance, because her visitors are parents and children:
     - no names, emails or phone numbers are ever sent
     - session recording is off
     - autocapture is off, so no click text can leak a student's name
     - no person profiles, so nothing is tied to an individual over time
   What we send is counts and paths: which tutor, which subject, which step. */

(function () {
  var cfg = window.ABC_CONFIG || {};
  var ready = false;

  if (cfg.posthogKey && cfg.posthogKey.indexOf("PHC_KEY") !== 0) {
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    posthog.init(cfg.posthogKey, {
      api_host: cfg.posthogHost,
      autocapture: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      capture_pageview: false          // sent below, with the traffic source attached
    });
    ready = true;
  }

  /* Turn the referrer into something Dana can read in a weekly email.
     The Facebook group link she posts should carry ?utm_source=facebook_group. */
  function trafficSource() {
    var utm = new URLSearchParams(location.search).get("utm_source");
    if (utm) return utm;

    var ref = document.referrer;
    if (!ref) return "direct";
    try {
      var host = new URL(ref).hostname.replace(/^www\./, "");
      if (host === location.hostname) return "internal";
      if (/facebook|fb\.com/.test(host)) return "facebook";
      if (/google|bing|duckduckgo|yahoo/.test(host)) return "search";
      return host;
    } catch (e) { return "unknown"; }
  }

  var source = trafficSource();

  function send(name, props) {
    var payload = Object.assign({ traffic_source: source }, props || {});
    if (ready) posthog.capture(name, payload);
    if (location.hostname === "localhost" || location.protocol === "file:") {
      console.log("[analytics]", name, payload);
    }
  }

  window.ABC_TRACK = {
    source: source,

    pageView: function () {
      send("$pageview", {});
    },

    /* "Which tutors do people look at most?" */
    tutorViewed: function (t) {
      send("tutor_viewed", { tutor: t.name, subject: t.subject, rate: t.rate });
    },

    /* "Do they book, or just leave?" — the funnel is
       $pageview -> tutor_viewed -> booking_started -> booking_completed */
    bookingStarted: function (t, slotStart) {
      send("booking_started", { tutor: t.name, subject: t.subject, slot: slotStart });
    },

    bookingCompleted: function (t, slotStart, grade) {
      send("booking_completed", {
        tutor: t.name, subject: t.subject, slot: slotStart,
        student_grade: grade, rate: t.rate
      });
    },

    bookingAbandoned: function (t, lastField) {
      send("booking_abandoned", {
        tutor: t.name, subject: t.subject, last_field: lastField || "none"
      });
    },

    /* "Which subjects are people looking for?" */
    subjectFiltered: function (subject, results) {
      send("subject_filtered", { subject: subject, results: results });
    },

    subjectUnavailable: function (subject) {
      send("subject_unavailable", { subject: subject });
    },

    subjectRequested: function (subject) {
      send("subject_requested", { subject: subject });
    }
  };
})();
