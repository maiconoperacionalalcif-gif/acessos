import { Covenant, Login } from '../types';
import { normalizeText, isLoginAssociatedWithCovenant } from './utils';

export interface DuplicateCovenantGroup {
  id: string;
  key: string;
  name: string;
  state: string;
  category: string;
  covenants: Covenant[];
  totalLogins: number;
}

export interface DuplicateLoginGroup {
  id: string;
  key: string;
  covenantId: string;
  covenantName: string;
  covenantState?: string;
  bank: string;
  username: string;
  logins: Login[];
}

export interface DuplicatesReport {
  duplicateCovenants: DuplicateCovenantGroup[];
  duplicateLogins: DuplicateLoginGroup[];
  totalDuplicateCovenantGroups: number;
  totalDuplicateLoginGroups: number;
  redundantCovenantsCount: number;
  redundantLoginsCount: number;
  totalRedundantItems: number;
  hasDuplicates: boolean;
  duplicateCovenantIdSet: Set<string>;
  duplicateLoginIdSet: Set<string>;
}

/**
 * Scans all covenants and logins to identify duplicate registrations.
 */
export function detectDuplicates(covenants: Covenant[] = [], logins: Login[] = []): DuplicatesReport {
  // 1. Group Covenants by normalized name + normalized state
  const covMap = new Map<string, Covenant[]>();

  covenants.forEach(c => {
    const normName = normalizeText(c.name || '').trim();
    if (!normName) return;
    const normState = (c.state || '').trim().toUpperCase();
    const key = `${normName}:::${normState}`;
    
    if (!covMap.has(key)) {
      covMap.set(key, []);
    }
    covMap.get(key)!.push(c);
  });

  const duplicateCovenants: DuplicateCovenantGroup[] = [];
  const duplicateCovenantIdSet = new Set<string>();
  let redundantCovenantsCount = 0;

  covMap.forEach((group, key) => {
    if (group.length > 1) {
      let totalLoginsForGroup = 0;
      group.forEach(c => {
        duplicateCovenantIdSet.add(c.id);
        totalLoginsForGroup += logins.filter(l => isLoginAssociatedWithCovenant(l, c.id)).length;
      });

      redundantCovenantsCount += (group.length - 1);
      duplicateCovenants.push({
        id: `dup-cov-${key}`,
        key,
        name: group[0].name,
        state: group[0].state || 'BR',
        category: group[0].category || 'Geral',
        covenants: group,
        totalLogins: totalLoginsForGroup
      });
    }
  });

  // 2. Group Logins by covenantId + normalized(bank) + normalized(username)
  const loginMap = new Map<string, Login[]>();

  logins.forEach(l => {
    const normBank = normalizeText(l.bank || 'geral').trim();
    const normUser = normalizeText(l.username || '').trim();
    if (!normUser) return;
    const covId = l.covenantId || 'no-cov';
    const key = `${covId}:::${normBank}:::${normUser}`;

    if (!loginMap.has(key)) {
      loginMap.set(key, []);
    }
    loginMap.get(key)!.push(l);
  });

  const duplicateLogins: DuplicateLoginGroup[] = [];
  const duplicateLoginIdSet = new Set<string>();
  let redundantLoginsCount = 0;

  loginMap.forEach((group, key) => {
    if (group.length > 1) {
      const first = group[0];
      const cov = covenants.find(c => c.id === first.covenantId);
      group.forEach(l => duplicateLoginIdSet.add(l.id));
      redundantLoginsCount += (group.length - 1);

      duplicateLogins.push({
        id: `dup-log-${key}`,
        key,
        covenantId: first.covenantId,
        covenantName: cov?.name || 'Convênio Não Encontrado',
        covenantState: cov?.state,
        bank: first.bank || 'Banco Principal',
        username: first.username,
        logins: group
      });
    }
  });

  const totalRedundantItems = redundantCovenantsCount + redundantLoginsCount;

  return {
    duplicateCovenants,
    duplicateLogins,
    totalDuplicateCovenantGroups: duplicateCovenants.length,
    totalDuplicateLoginGroups: duplicateLogins.length,
    redundantCovenantsCount,
    redundantLoginsCount,
    totalRedundantItems,
    hasDuplicates: totalRedundantItems > 0,
    duplicateCovenantIdSet,
    duplicateLoginIdSet
  };
}
