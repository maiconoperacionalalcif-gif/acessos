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

/**
 * Checks if two logins, covenants, or credentials share the exact same username and the same bank.
 */
export function isSameLoginAndBank(
  l1: { username?: string; login?: string; bank?: string } | null | undefined,
  l2: { username?: string; login?: string; bank?: string } | null | undefined
): boolean {
  if (!l1 || !l2) return false;
  const u1 = normalizeText(l1.username || (l1 as any).login);
  const u2 = normalizeText(l2.username || (l2 as any).login);
  const b1 = normalizeText(l1.bank);
  const b2 = normalizeText(l2.bank);
  if (!u1 || !u2 || !b1 || !b2) return false;
  return u1 === u2 && b1 === b2;
}

/**
 * Finds all logins from the given array that match the exact same username and bank.
 */
export function findMatchingBankLogins<T extends { username?: string; login?: string; bank?: string; id?: string }>(
  target: { username?: string; login?: string; bank?: string; id?: string } | null | undefined,
  allLogins: T[]
): T[] {
  if (!target) return [];
  const targetUser = normalizeText(target.username || (target as any).login);
  const targetBank = normalizeText(target.bank);
  if (!targetUser || !targetBank) return [];

  return (allLogins || []).filter(l => isSameLoginAndBank(target, l));
}

/**
 * Synchronizes passwords across all logins and covenants that share the same username and bank.
 */
export function synchronizePasswordAcrossSameLoginAndBank(
  target: { username?: string; login?: string; bank?: string; password?: string; id?: string },
  logins: any[],
  covenants: any[] = []
): { updatedLogins: any[]; updatedCovenants: any[]; affectedCount: number } {
  const targetUser = normalizeText(target.username || (target as any).login);
  const targetBank = normalizeText(target.bank);
  const newPassword = target.password ?? '';

  if (!targetUser || !targetBank) {
    return { updatedLogins: logins, updatedCovenants: covenants, affectedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  let affectedCount = 0;

  const updatedLogins = (logins || []).map(l => {
    if (isSameLoginAndBank(target, l)) {
      affectedCount++;
      return {
        ...l,
        password: newPassword,
        lastAlteration: nowIso
      };
    }
    return l;
  });

  const updatedCovenants = (covenants || []).map(c => {
    if (isSameLoginAndBank(target, c)) {
      return {
        ...c,
        password: newPassword
      };
    }
    return c;
  });

  return { updatedLogins, updatedCovenants, affectedCount };
}
