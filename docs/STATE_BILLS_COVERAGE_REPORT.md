# State Bills Coverage Report

Date: 30 June 2026

## Production coverage

- State Bills: 8,646
- State jurisdictions represented: 31
- Records with PDF URLs: 8,351
- Current official-source authority value: PRS Legislative Research

Largest State Bill collections include Maharashtra, Kerala, Karnataka, Tamil
Nadu, Haryana, Madhya Pradesh, Rajasthan, Goa, Himachal Pradesh, and West
Bengal.

## Product implementation

- Added first-class route `/app/state-bills`.
- Added navigation and global-search entries.
- Reused the universal repository, filters, pagination, document route, and
  document chat; no State-specific duplicate backend was introduced.
- Supports State, Legislature/authority, status, year, category, ministry,
  source, PDF availability, sorting, semantic search, Open, Research, PDF, and
  source actions.

## Source limitation

The historical source records do not currently provide standardized status
values and provide only sparse legislature metadata. Missing values remain null
and the page explains the limitation; no “Published” or legislature value is
fabricated.
