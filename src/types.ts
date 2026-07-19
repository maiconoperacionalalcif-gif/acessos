export type UserRole = 'Administrador' | 'Supervisor' | 'Operador';

export interface User {
  id: string;
  username: string;
  name: string;
  password?: string;
  role: UserRole;
  status: 'Ativo' | 'Bloqueado';
  allowedCovenants: string[]; // List of Covenant IDs (empty = all)
  allowedBanks: string[]; // List of Bank names (empty = all)
}

export type CovenantCategory = 'Federal' | 'Estadual' | 'Municipal' | 'Militar' | 'INSS' | 'Benefício';

export interface Covenant {
  id: string;
  name: string;
  category: CovenantCategory;
  state: string;
  city: string;
  organ: string;
  manager: string;
  observations: string;
  status: 'Ativo' | 'Inativo';
}

export interface System {
  id: string;
  covenantId: string; // Belongs to a covenant
  name: string;
  description: string;
  url: string;
  icon: string; // Lucide icon name
  observations: string;
  status: 'Ativo' | 'Inativo';
}

export type LoginStatus = 'Ativo' | 'Bloqueado' | 'Em manutenção';

export interface Login {
  id: string;
  covenantId: string;
  systemId: string;
  bank: string;
  shop: string;
  username: string;
  password?: string;
  cpf: string;
  pin: string;
  token: string;
  email: string;
  phone: string;
  responsible: string;
  observations: string;
  creationDate: string;
  lastAlteration: string;
  expirationDate: string;
  status: LoginStatus;
  
  // Reservation Info
  reservedBy?: string; // name or user id
  reservedAt?: string; // ISO string
}

export interface LoginReservationLog {
  id: string;
  loginId: string;
  loginUser: string;
  systemName: string;
  reservedBy: string;
  reservedAt: string;
  releasedAt?: string;
  durationSeconds?: number;
}

export type HistoryActionType = 'Criar' | 'Alterar' | 'Excluir' | 'Visualizar Senha' | 'Copiar Senha' | 'Copiar Usuário' | 'Abrir Sistema';
export type HistoryTargetType = 'Covenant' | 'System' | 'Login' | 'User';

export interface HistoryLog {
  id: string;
  userId: string;
  userName: string;
  actionType: HistoryActionType;
  targetType: HistoryTargetType;
  targetId: string;
  targetName: string;
  timestamp: string;
  ip: string;
}

export interface SystemConfig {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  sessionTimeoutMinutes: number;
  rowsPerPage: number;
  googleAppsScriptUrl: string;
}

export interface FavoriteSystem {
  systemId: string;
  userId: string;
}
