export type UserRole = 'Administrador' | 'Supervisor' | 'Operador' | 'Operacional';

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

export type CovenantCategory = 'Federal' | 'Forças Armadas' | 'Estadual' | 'Prefeituras' | 'Governos' | 'Municipal' | 'Militar' | 'INSS' | 'Benefício';

export type AccessRequestCategory = 'Federal' | 'Estadual' | 'Prefeitura';
export type AccessRequestStatus = 'Pendente' | 'Em Andamento' | 'Concluído' | 'Rejeitado';

export interface AccessRequest {
  id: string;
  covenantName: string; // NOME DO CONVÊNIO
  category: AccessRequestCategory; // FEDERAL, ESTADUAL OU PREFEITURA
  state: string; // ESTADO (SELECIONÁVEL - UF)
  bank: string; // BANCO
  observations?: string; // Observações do analista
  requestedBy: string; // Nome do analista solicitante
  requestedByUserId?: string;
  requestedAt: string; // ISO string
  
  // Gestão / Esteira Admin
  status: AccessRequestStatus;
  ticketNumber?: string; // NÚMERO DO CHAMADO DA SOLICITAÇÃO
  assignedTo?: string; // Responsável que pegou a solicitação
  assignedAt?: string;
  completedAt?: string;
  adminNotes?: string; // Resposta / Notas do Administrador para o analista
  createdLoginId?: string;
}

export interface Covenant {
  id: string;
  name: string;
  category: CovenantCategory;
  state: string;
  managerUrl?: string; // Link da Gestora
  observations: string;
  status: 'Ativo' | 'Inativo';
  city?: string;
  organ?: string;
  manager?: string;
  login?: string;
  password?: string;
  bank?: string;
}

export interface System {
  id: string;
  covenantId?: string; // Optional, Gestoras can be global
  name: string; // e.g. Consigx, Zetasoft, Neoconsig
  description: string;
  url: string; // Base URL / Portal
  icon: string; // Lucide icon name
  observations: string;
  status: 'Ativo' | 'Inativo';
}

export type LoginStatus = 'Ativo' | 'Bloqueado' | 'Em manutenção';

export interface Login {
  id: string;
  covenantId: string; // Primary covenant ID
  covenantIds?: string[]; // Multiple associated covenant IDs (for multi-covenant bank access)
  systemId: string;
  url?: string; // Specific portal link (e.g., https://saec.consigx.com.br/Login.aspx)
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
export type HistoryTargetType = 'Covenant' | 'System' | 'Login' | 'User' | 'AccessRequest';

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
  googleSheetsSyncUrl?: string;
}

export interface FavoriteSystem {
  systemId: string;
  userId: string;
}
