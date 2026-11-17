import type { CatalogStore } from "./store";
import type { Service } from "./types";

export interface SearchHit {
  name: string;
  owner: string;
  score: number;
}

const tokenize = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Tiny ranked search. Scores per query token:
 *   exact name match 10, name token match 5, tag match 3, description token match 1.
 * Deprecated services are ranked below everything else.
 */
export function search(store: CatalogStore, query: string, limit = 10): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const scored = store
    .list()
    .map((service) => ({ service, score: scoreService(service, terms) }))
    .filter((x) => x.score > 0);

  scored.sort((a, b) => {
    const deprecatedA = a.service.lifecycle === "deprecated" ? 1 : 0;
    const deprecatedB = b.service.lifecycle === "deprecated" ? 1 : 0;
    return deprecatedA - deprecatedB || b.score - a.score || a.service.name.localeCompare(b.service.name);
  });

  return scored.slice(0, limit).map(({ service, score }) => ({ name: service.name, owner: service.owner, score }));
}

function scoreService(service: Service, terms: string[]): number {
  const nameTokens = new Set(tokenize(service.name));
  const descTokens = new Set(tokenize(service.description ?? ""));
  let score = 0;
  for (const term of terms) {
    if (service.name === term) score += 10;
    else if (nameTokens.has(term)) score += 5;
    if (service.tags.includes(term)) score += 3;
    if (descTokens.has(term)) score += 1;
  }
  return score;
}
