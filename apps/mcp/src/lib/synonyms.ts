/**
 * Synonym mapping for common developer terms
 * Helps match natural language queries to tool keywords
 *
 * Structure: { term: [synonym1, synonym2, ...] }
 */

export const SYNONYMS: Record<string, string[]> = {
  // GitHub/Git terms (include uppercase variants)
  pr: ["pull", "request", "pull_request", "pullrequest"],
  PR: ["pull", "request", "pull_request", "pullrequest"],
  "pull request": ["pr", "PR", "merge", "review", "pull_request"],
  "merge request": ["pr", "PR", "pull", "request", "pull_request"],
  review: ["pr", "PR", "pull", "request", "code", "review"],
  commit: ["change", "diff", "patch"],
  repo: ["repository", "project"],
  repository: ["repo", "project"],

  // Issue tracking
  ticket: ["issue", "task", "bug"],
  issue: ["ticket", "task", "bug", "problem"],
  task: ["issue", "ticket", "item", "todo"],
  bug: ["issue", "problem", "error"],

  // Database terms
  table: ["relation", "collection"],
  query: ["select", "search", "find"],
  insert: ["add", "create", "new"],
  update: ["modify", "change", "edit"],
  delete: ["remove", "drop"],
  row: ["record", "entry", "item"],

  // General actions
  create: ["add", "new", "make"],
  search: ["find", "query", "look", "lookup"],
  list: ["show", "display", "get"],
  get: ["fetch", "retrieve", "show"],
  update: ["edit", "modify", "change"],
  delete: ["remove", "destroy"]
};

/**
 * Expand a term with its synonyms
 * @param term - The original term
 * @returns Array of the term plus all synonyms
 */
export function expandTerm(term: string): string[] {
  const normalized = term.toLowerCase().trim();
  const original = term.trim(); // Keep original case for uppercase acronyms

  // Check if this term has synonyms (try both normalized and original)
  const synonyms = SYNONYMS[normalized] || SYNONYMS[original];

  if (synonyms) {
    return [normalized, ...synonyms];
  }

  // Check if this term is a synonym of something else
  for (const [mainTerm, synonymList] of Object.entries(SYNONYMS)) {
    if (synonymList.includes(normalized) || synonymList.includes(original)) {
      return [normalized, mainTerm, ...synonymList];
    }
  }

  // No synonyms found, return original
  return [normalized];
}

/**
 * Expand all terms in a query with synonyms
 * @param terms - Array of search terms
 * @returns Expanded array with all synonyms
 */
export function expandQuery(terms: string[]): string[] {
  const expanded = new Set<string>();

  for (const term of terms) {
    const synonyms = expandTerm(term);
    synonyms.forEach((syn) => expanded.add(syn));
  }

  return Array.from(expanded);
}

/**
 * Check if two terms are synonyms of each other
 */
export function areSynonyms(term1: string, term2: string): boolean {
  const t1 = term1.toLowerCase();
  const t2 = term2.toLowerCase();

  if (t1 === t2) return true;

  const t1Synonyms = expandTerm(t1);
  return t1Synonyms.includes(t2);
}
