/**
 * Synonym mapping for common developer terms
 * Helps match natural language queries to tool keywords
 *
 * Structure: { term: [synonym1, synonym2, ...] }
 */

export const SYNONYMS: Record<string, string[]> = {
  // GitHub/Git terms (include uppercase variants and plurals)
  pr: ["pull", "request", "pull_request", "pullrequest", "review", "merge", "pull_request"],
  PR: ["pull", "request", "pull_request", "pullrequest", "review", "merge", "pull_request"],
  prs: ["pull", "request", "pull_request", "pullrequest", "review", "merge", "pull_requests"],
  PRs: ["pull", "request", "pull_request", "pullrequest", "review", "merge", "pull_requests"],
  "pull request": ["pr", "PR", "merge", "review", "pull_request", "code", "changes"],
  "pull requests": ["prs", "PRs", "merge", "review", "pull_request", "code", "changes"],
  "merge request": ["pr", "PR", "pull", "request", "pull_request", "review"],
  review: ["pr", "PR", "pull", "request", "code", "review", "pull_request", "changes", "diff"],
  "code review": ["pr", "PR", "pull", "request", "review", "pull_request", "changes"],
  commit: ["change", "diff", "patch", "update"],
  repo: ["repository", "project", "codebase"],
  repos: ["repository", "repositories", "project", "projects"],
  repository: ["repo", "project", "codebase"],
  repositories: ["repo", "repos", "projects"],

  // Code-related terms
  code: ["file", "source", "script", "program"],
  file: ["document", "code", "content"],
  contents: ["content", "file", "data"],

  // Issue tracking
  ticket: ["issue", "task", "bug", "item", "search"],
  tickets: ["issues", "tasks", "bugs", "items", "search"],
  issue: ["ticket", "task", "bug", "problem", "item", "search"],
  issues: ["tickets", "tasks", "bugs", "items", "search"],
  task: ["issue", "ticket", "item", "todo", "work"],
  bug: ["issue", "problem", "error", "defect"],

  // Database terms
  table: ["relation", "collection", "dataset"],
  tables: ["relations", "collections", "datasets"],
  database: ["db", "data", "store", "storage"],
  db: ["database", "data"],
  query: ["select", "search", "find", "fetch"],
  insert: ["add", "create", "new", "write"],
  row: ["record", "entry", "item", "data"],

  // Supabase-specific
  supabase: ["database", "db", "postgres", "backend", "project", "table"],
  postgres: ["postgresql", "database", "db", "sql"],
  postgresql: ["postgres", "database", "db"],

  // Project/workspace terms
  project: ["workspace", "repo", "repository", "board"],
  workspace: ["project", "organization", "team"],

  // General actions
  create: ["add", "new", "make", "insert", "build"],
  add: ["create", "new", "insert", "make"],
  search: ["find", "query", "look", "lookup", "locate"],
  find: ["search", "query", "look", "lookup", "locate", "get"],
  list: ["show", "display", "get", "fetch", "retrieve", "search"],
  show: ["list", "display", "get", "view"],
  get: ["fetch", "retrieve", "show", "find", "list"],
  fetch: ["get", "retrieve", "load", "pull"],
  update: ["edit", "modify", "change", "set"],
  edit: ["update", "modify", "change"],
  delete: ["remove", "destroy", "drop", "erase"],
  remove: ["delete", "destroy", "drop"]
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
