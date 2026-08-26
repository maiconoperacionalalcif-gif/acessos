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
