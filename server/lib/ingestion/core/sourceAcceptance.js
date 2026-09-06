const { pilots } = require('../../../config/source-acceptance.json');
const REQUIRED_GATES = ['identity','datePrecision','pdfQuality','accessReview','databaseConcurrency','listingWindow','pagination'];
const acceptanceFor = (name) => pilots[name] || null;
const isScheduleAccepted = (name) => {
  const entry = acceptanceFor(name);
  return !entry || (entry.decision === 'ACCEPTED_FOR_SCHEDULE' &&
    ['daily','weekly','monthly'].includes(entry.cadence) &&
    REQUIRED_GATES.every((gate)=>entry.gates?.[gate] === true) && Boolean(entry.evidenceReport));
};
const assertScheduleAccepted = (name) => {
  if (!isScheduleAccepted(name)) throw new Error(`Source ${name} has not passed schedule acceptance`);
};
module.exports = { acceptanceFor, isScheduleAccepted, assertScheduleAccepted, REQUIRED_GATES };
