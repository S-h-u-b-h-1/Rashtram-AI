# Dashboard Improvements Report

Date: 30 June 2026

## New information architecture

The dashboard now answers three questions:

1. What happened recently?
2. What should I read?
3. What should I continue researching?

## Changes

- Replaced giant counters and repeated document sections with one concise hero.
- Added global catalogue search in the hero.
- Moved recent research directly below the brief.
- Uses all verified legislative event types rather than Parliament-only cards.
- Shows recent State Bills as a first-class reading section.
- Shows personalized recommendations only when match score is at least 3;
  otherwise it presents verified policy records without a personalization claim.
- Hides metadata trends when fewer than three supported categories exist.
- Reduced source health to a compact footer.
- Added time-appropriate India greeting.
- Added a cached Gemini overview constrained to database evidence, with a
  deterministic database-count fallback when AI is unavailable.
- Added Demo Mode using diverse real catalogue records only.
