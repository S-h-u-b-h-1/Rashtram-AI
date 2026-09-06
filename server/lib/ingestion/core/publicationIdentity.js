const { sha256 } = require('./hashing');

// Keep semantic parameters (including year, edition and resource IDs).
// Remove only known analytics decoration, never arbitrary query parameters.
const canonicalPublicationUrl = (value) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid publication URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
};
const publicationIdentity = ({publisher, publisherId, landingUrl, resourceUrl, title, date, edition}) => {
  if (!publisher) throw new Error('Publisher is required for publication identity');
  const identity = publisherId ? ['id', String(publisherId)]
    : landingUrl ? ['landing', canonicalPublicationUrl(landingUrl)]
    : resourceUrl ? ['resource', canonicalPublicationUrl(resourceUrl)]
    : ['title', String(title || '').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase(), date || null];
  if (!publisherId && !landingUrl && !resourceUrl && !title) throw new Error('Publication identity requires an identifier');
  return sha256(JSON.stringify([publisher, ...identity, edition || null])).slice(0,40);
};
module.exports = { canonicalPublicationUrl, publicationIdentity };
