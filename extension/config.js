/**
 * ── Extraction selectors ──────────────────────────────────────────
 *
 * Two LinkedIn layouts exist:
 *
 * 1. SEARCH / COLLECTIONS  (/jobs/collections/*, /jobs/search/*)
 *    Container: .jobs-search__job-details
 *    Uses stable BEM-style class names.
 *
 * 2. DIRECT VIEW  (/jobs/view/*)
 *    Container: <main>
 *    Still uses some BEM classes; falls back to full <main> text
 *    if none match (e.g. after a LinkedIn deploy changes markup).
 */

// ── Search / Collections layout ──────────────────────────────────
const BASE_SELECTOR_SEARCH = ".jobs-search__job-details";

const SUB_SELECTOR_SEARCH = `
  .job-details-jobs-unified-top-card__company-name,
  .job-details-jobs-unified-top-card__job-title,
  span[dir="ltr"] > .tvm__text--low-emphasis:first-child,
  .jobs-description__content,
  .jobs-description-content,
  .jobs-company__box > h2.text-heading-large,
  .jobs-company__company-description
`;

// ── Direct View layout (/jobs/view/*) ────────────────────────────
// LinkedIn uses CSS-module hashed classes here, so no stable selectors.
// We grab all of <main> and clean the noise in content.js.
const BASE_SELECTOR_VIEW = "main";

// ── Resolve which layout we're on ────────────────────────────────
function getSelectors() {
  const path = window.location.pathname;

  if (path.startsWith("/jobs/view/")) {
    return {
      BASE_SELECTOR: BASE_SELECTOR_VIEW,
      SUB_SELECTOR: null,
      fallbackToFullText: true,
    };
  }

  return {
    BASE_SELECTOR: BASE_SELECTOR_SEARCH,
    SUB_SELECTOR: SUB_SELECTOR_SEARCH,
    fallbackToFullText: false,
  };
}

// ── API ───────────────────────────────────────────────────────────
// Base URL of the Rails API.
// Change to your production URL when deploying.
const API_BASE_URL = "http://localhost:3000/api";
