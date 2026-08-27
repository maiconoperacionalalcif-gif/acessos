/**
 * Normalizes a string by removing diacritics (accents) and converting to lowercase.
 * Example: "São Paulo" -> "sao paulo", "Exército" -> "exercito", "Itaú" -> "itau", "Goiânia" -> "goiania"
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Performs an accent-insensitive and case-insensitive substring search.
 */
export function matchesSearch(target: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (!target) return false;
  return normalizeText(target).includes(normalizeText(query));
}

/**
 * Returns all unique covenant IDs associated with a Login (primary covenantId + covenantIds array).
 */
export function getLoginCovenantIds(login: { covenantId?: string; covenantIds?: string[] } | null | undefined): string[] {
  if (!login) return [];
  const set = new Set<string>();
  if (login.covenantId?.trim()) {
    set.add(login.covenantId.trim());
  }
  if (Array.isArray(login.covenantIds)) {
    login.covenantIds.forEach(id => {
      if (id && typeof id === 'string' && id.trim()) {
        set.add(id.trim());
      }
    });
  }
  return Array.from(set);
}

/**
 * Checks if a login is associated with a given covenant ID.
 */
export function isLoginAssociatedWithCovenant(
  login: { covenantId?: string; covenantIds?: string[] } | null | undefined,
  covenantId: string
): boolean {
  if (!login || !covenantId) return false;
  if (login.covenantId === covenantId) return true;
  if (Array.isArray(login.covenantIds) && login.covenantIds.includes(covenantId)) return true;
  return false;
}
