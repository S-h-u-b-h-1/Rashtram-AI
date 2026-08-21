# Next.js 16 Security Upgrade

## Decision

The frontend was upgraded from Next.js 15.5.23 to 16.3.2, with React and
React DOM 19.2.8 and `eslint-config-next` 16.3.2 pinned exactly. The production
dependency audit moved from four high-severity findings to zero known
vulnerabilities.

## Repository compatibility review

- The runtime exceeds the Next.js 16 minimum of Node.js 20.9.
- No `middleware` file exists, so no middleware-to-proxy migration was needed.
- No synchronous `cookies`, `headers`, `draftMode`, server `params`, or server
  `searchParams` access was found. The official async-request codemod dry run
  examined 195 files and changed none.
- No custom webpack, experimental PPR/dynamic IO, AMP, runtime config,
  `next/legacy/image`, or `images.domains` configuration exists.
- Image hosts already use `remotePatterns`.
- No parallel-route slots require new `default.js` files.
- The project already invokes ESLint directly and uses flat config. The config
  now imports Next 16's native flat Core Web Vitals preset rather than wrapping
  it with legacy `FlatCompat`.
- The production build succeeds with the default Next 16 Turbopack builder.

## Deliberate non-change

React 19.2's new compiler-oriented lint rules identify existing state/effect
patterns throughout the mature UI. The React Compiler is not enabled, and a
large unrelated refactor would add release risk. Those compiler-only rules
remain disabled in the lint config until a dedicated measured migration. Core
Next.js, accessibility, hooks dependency, and Core Web Vitals rules remain
active.

## Verification

- official Next.js async-request codemod: 195 files, 0 changes, 0 errors
- frontend tests: pass
- ESLint: pass with warnings only
- Next.js 16 production build: pass
- production dependency audit: 0 vulnerabilities

References:

- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/docs/app/guides/upgrading/codemods
