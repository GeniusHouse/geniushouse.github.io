/* Six tutors: four math, one science, one reading. K-12, weighted to middle school.
   Photos are initials for now — swap in real headshots when Dana sends them. */

window.ABC_TUTORS = [
  { id: "rivera",  name: "Maya Rivera",    subject: "Math",
    teaches: "Pre-Algebra, Algebra I, Algebra II", grades: "Grades 7-12", rate: 45 },
  { id: "okafor",  name: "Daniel Okafor",  subject: "Math",
    teaches: "Elementary math, Pre-Algebra",       grades: "Grades 3-8",  rate: 40 },
  { id: "raman",   name: "Priya Raman",    subject: "Math",
    teaches: "Algebra I, Algebra II, Geometry",    grades: "Grades 8-12", rate: 48 },
  { id: "kim",     name: "Grace Kim",      subject: "Math",
    teaches: "Elementary math",                    grades: "Grades K-5",  rate: 38 },
  { id: "alvarez", name: "Tomas Alvarez",  subject: "Science",
    teaches: "General science, Biology",           grades: "Grades 6-12", rate: 45 },
  { id: "bennett", name: "Ruth Bennett",   subject: "Reading",
    teaches: "Phonics, reading comprehension",     grades: "Grades K-5",  rate: 40 }
];

/* Availability is generated from today so the prototype never looks stale.
   Each tutor gets weekday afternoon slots across the coming week. */
window.ABC_SLOTS = (function buildSlots() {
  var patterns = {
    rivera:  [[1, 16], [2, 17], [4, 16], [4, 18]],
    okafor:  [[1, 15], [3, 16], [5, 15]],
    raman:   [[2, 16], [3, 17], [5, 16], [5, 18]],
    kim:     [[1, 14], [3, 15], [4, 14]],
    alvarez: [[2, 15], [4, 17], [5, 17]],
    bennett: [[1, 13], [3, 14], [5, 14]]
  };

  var out = [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  Object.keys(patterns).forEach(function (tutorId) {
    patterns[tutorId].forEach(function (pair) {
      var weekday = pair[0], hour = pair[1];
      // next occurrence of that weekday, at least one day out
      var d = new Date(today);
      var delta = (weekday - today.getDay() + 7) % 7;
      d.setDate(today.getDate() + (delta === 0 ? 7 : delta));
      d.setHours(hour, 0, 0, 0);
      out.push({
        id: tutorId + "-" + d.toISOString().slice(0, 10) + "-" + hour,
        tutorId: tutorId,
        start: d.toISOString()
      });
    });
  });

  return out.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
})();
