import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sun, 
  Moon, 
  LogOut, 
  Building2, 
  Lock, 
  User as UserIcon,
  HelpCircle,
  Wifi,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Shield,
  KeyRound
} from 'lucide-react';
import { api, FullDatabase } from './lib/api';
import { User, Covenant, System, Login, HistoryLog, SystemConfig } from './types';
import { auth, db as firestoreDb } from './lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

// Import all tabs
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Accesses from './components/Accesses';
import Covenants from './components/Covenants';
import Logins from './components/Logins';
import Users from './components/Users';
import History from './components/History';
import Settings from './components/Settings';
import OperationalView from './components/OperationalView';
import AccessRequestsQueue from './components/AccessRequestsQueue';
import ErrorBoundary from './components/ErrorBoundary';
import { detectDuplicates } from './lib/duplicateDetector';
import { synchronizePasswordAcrossSameLoginAndBank } from './lib/utils';

const MOCK_DATABASE: FullDatabase = {
  config: {
    companyName: 'ACESSOS ALCIF',
    logoUrl: '',
    primaryColor: '#2563eb',
    sessionTimeoutMinutes: 30,
    rowsPerPage: 10,
    googleAppsScriptUrl: '',
    googleSheetsSyncUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQcMpLh93RfKdkQ6mGju40CgMTaz7RhBP7S_5LiNWF1BY0ZigqO8dpZpSh1gtx_oAiDtIyXX8Jc-gbC/pubhtml'
  },
  users: [
    {
      id: 'usr-1',
      username: 'admin',
      name: 'Administrador Geral',
      password: 'admin',
      role: 'Administrador',
      status: 'Ativo',
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: 'usr-alcif',
      username: 'alcif.op',
      name: 'Operacional ALCIF',
      password: 'admin',
      role: 'Operacional',
      status: 'Ativo',
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: 'usr-2',
      username: 'operacional',
      name: 'Operador de Atendimento',
      password: 'operacional',
      role: 'Operacional',
      status: 'Ativo',
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: 'usr-3',
      username: 'operador',
      name: 'Bruno Silva (Operador)',
      password: 'operador',
      role: 'Operador',
      status: 'Ativo',
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: 'usr-4',
      username: 'supervisor',
      name: 'Amanda Lima (Supervisor)',
      password: 'supervisor',
      role: 'Supervisor',
      status: 'Ativo',
      allowedCovenants: [],
      allowedBanks: []
    }
  ],
  covenants: [
    // Prefeituras
    {
      id: "cov-pmsp",
      name: "Prefeitura de São Paulo - PMSP",
      category: "Prefeituras",
      state: "SP",
      city: "São Paulo",
      organ: "Secretaria Municipal de Gestão",
      manager: "Consiglog",
      managerUrl: "https://pmsp.consiglog.com.br",
      login: "pmsp.bb01",
      password: "PmspPass@2026",
      bank: "Banco do Brasil",
      observations: "Consignado servidores municipais de SP ativos e aposentados.",
      status: "Ativo"
    },
    {
      id: "cov-pmrj",
      name: "Prefeitura do Rio de Janeiro - PCRJ",
      category: "Prefeituras",
      state: "RJ",
      city: "Rio de Janeiro",
      organ: "Secretaria Municipal de Fazenda",
      manager: "Ergon Carioca",
      managerUrl: "https://ergon.rio.rj.gov.br",
      login: "pcrj.sant01",
      password: "RioPass#2026",
      bank: "Santander",
      observations: "Acessos via chave de segurança e certificação.",
      status: "Ativo"
    },
    {
      id: "cov-pmbh",
      name: "Prefeitura de Belo Horizonte - PBH",
      category: "Prefeituras",
      state: "MG",
      city: "Belo Horizonte",
      organ: "Secretaria de Planejamento e Gestão",
      manager: "PBH Servidor",
      managerUrl: "https://servicos.pbh.gov.br",
      login: "pbh.bb.op",
      password: "BHPw#2026",
      bank: "Banco do Brasil",
      observations: "Liberação de margem consignada PBH.",
      status: "Ativo"
    },
    {
      id: "cov-pmctba",
      name: "Prefeitura de Curitiba",
      category: "Prefeituras",
      state: "PR",
      city: "Curitiba",
      organ: "Secretaria de Administração e RH",
      manager: "RH 24 Horas",
      managerUrl: "https://rh24horas.curitiba.pr.gov.br",
      login: "curitiba.caixa",
      password: "CtbaPass#2026",
      bank: "Caixa Econômica",
      observations: "Consulta de margem consignável dos servidores municipais de Curitiba.",
      status: "Ativo"
    },
    {
      id: "cov-pmsa",
      name: "Prefeitura de Salvador",
      category: "Prefeituras",
      state: "BA",
      city: "Salvador",
      organ: "Secretaria Municipal de Gestão",
      manager: "Portal Servidor Salvador",
      managerUrl: "https://portaldoservidor.salvador.ba.gov.br",
      login: "salvador.bb",
      password: "SsaPass#2026",
      bank: "Banco do Brasil",
      observations: "Margem e extrato de servidores de Salvador.",
      status: "Ativo"
    },
    {
      id: "cov-pmpa",
      name: "Prefeitura de Porto Alegre",
      category: "Prefeituras",
      state: "RS",
      city: "Porto Alegre",
      organ: "Secretaria de Planejamento",
      manager: "RH Porto Alegre",
      managerUrl: "https://rh.portoalegre.rs.gov.br",
      login: "poa.banrisul",
      password: "PoaBanrisul@26",
      bank: "Banrisul",
      observations: "Consignado PMPA com autenticação do Banrisul.",
      status: "Ativo"
    },
    {
      id: "cov-pmgyn",
      name: "Prefeitura de Goiânia",
      category: "Prefeituras",
      state: "GO",
      city: "Goiânia",
      organ: "Secretaria Municipal de Administração",
      manager: "ConsigX",
      managerUrl: "https://goiania.consigx.com.br",
      login: "gyn.itau.op",
      password: "GynPass@2026",
      bank: "Itaú",
      observations: "Gestora ConsigX Goiânia.",
      status: "Ativo"
    },
    // Governos
    {
      id: "cov-govsp",
      name: "Governo do Estado de São Paulo",
      category: "Governos",
      state: "SP",
      city: "São Paulo",
      organ: "Secretaria de Gestão e Governo Digital",
      manager: "Portal do Servidor SP / Prodesp",
      managerUrl: "https://portaldoservidor.sp.gov.br",
      login: "sp.gov.bb01",
      password: "SpGovPass@2026",
      bank: "Banco do Brasil",
      observations: "Consignado estadual SP - servidores ativos e inativos.",
      status: "Ativo"
    },
    {
      id: "cov-govba",
      name: "Governo do Estado da Bahia",
      category: "Governos",
      state: "BA",
      city: "Salvador",
      organ: "Secretaria da Administração do Estado da Bahia (SAEB)",
      manager: "Portal do Servidor Bahia",
      managerUrl: "https://www.portaldoservidor.ba.gov.br",
      login: "saeb.itau.op",
      password: "BaGovPass@2026",
      bank: "Itaú",
      observations: "Consignado estadual Bahia - servidores ativos e inativos.",
      status: "Ativo"
    },
    {
      id: "cov-govrj",
      name: "Governo do Estado do Rio de Janeiro",
      category: "Governos",
      state: "RJ",
      city: "Rio de Janeiro",
      organ: "Secretaria de Estado de Fazenda",
      manager: "Proderj / Portal RJ",
      managerUrl: "https://proderj.rj.gov.br",
      login: "govrj.brad01",
      password: "RjGovPass#2026",
      bank: "Bradesco",
      observations: "Servidores públicos do estado do Rio de Janeiro.",
      status: "Ativo"
    },
    {
      id: "cov-govmg",
      name: "Governo do Estado de Minas Gerais",
      category: "Governos",
      state: "MG",
      city: "Belo Horizonte",
      organ: "Secretaria de Estado de Planejamento e Gestão (SEPLAG)",
      manager: "Portal do Servidor MG",
      managerUrl: "https://portaldoservidor.mg.gov.br",
      login: "mg.gov.itau",
      password: "MgGovPass@2026",
      bank: "Itaú",
      observations: "Consignado servidores de Minas Gerais.",
      status: "Ativo"
    },
    {
      id: "cov-govdf",
      name: "Governo do Distrito Federal - GDF",
      category: "Governos",
      state: "DF",
      city: "Brasília",
      organ: "Secretaria de Economia do DF",
      manager: "SIGRH DF",
      managerUrl: "https://sigrh.df.gov.br",
      login: "gdf.brb.op",
      password: "GdfBrbPass#2026",
      bank: "BRB - Banco de Brasília",
      observations: "Servidores civis e professores do GDF.",
      status: "Ativo"
    },
    // Forças Armadas
    {
      id: "cov-eb",
      name: "Exército Brasileiro - CPEx",
      category: "Forças Armadas",
      state: "DF",
      city: "Brasília",
      organ: "Centro de Pagamento do Exército (CPEx)",
      manager: "CPEx / EB",
      managerUrl: "https://cpex.eb.mil.br",
      login: "eb.cpex.bb",
      password: "CpexBbPass#2026",
      bank: "Banco do Brasil",
      observations: "Militares do Exército Brasileiro, oficiais e praças.",
      status: "Ativo"
    },
    {
      id: "cov-fab",
      name: "Força Aérea Brasileira - DIRAP / FAB",
      category: "Forças Armadas",
      state: "RJ",
      city: "Rio de Janeiro",
      organ: "Diretoria de Administração do Pessoal (DIRAP)",
      manager: "DIRAP FAB",
      managerUrl: "https://dirap.fab.mil.br",
      login: "fab.dirap.sant",
      password: "FabSantPass@2026",
      bank: "Santander",
      observations: "Militares da Aeronáutica / Força Aérea Brasileira.",
      status: "Ativo"
    },
    {
      id: "cov-mb",
      name: "Marinha do Brasil - PAPEM",
      category: "Forças Armadas",
      state: "RJ",
      city: "Rio de Janeiro",
      organ: "Pagadoria de Pessoal da Marinha (PAPEM)",
      manager: "PAPEM Marinha",
      managerUrl: "https://papem.mar.mil.br",
      login: "mb.papem.bb",
      password: "MbBbPass#2026",
      bank: "Banco do Brasil",
      observations: "Militares da Marinha do Brasil e Corpo de Fuzileiros Navais.",
      status: "Ativo"
    },
    {
      id: "cov-sougov",
      name: "SIAPE / SouGov (Servidores Federais)",
      category: "Forças Armadas",
      state: "DF",
      city: "Brasília",
      organ: "Ministério da Gestão e da Inovação",
      manager: "SouGov.br",
      managerUrl: "https://www.gov.br/sougov",
      login: "siape.bb.operador",
      password: "BB@Siape#2026",
      bank: "Banco do Brasil",
      observations: "Acesso unificado servidores públicos federais e pensionistas.",
      status: "Ativo"
    }
  ],
  systems: [
    {
      id: "sys-1",
      covenantId: "cov-sougov",
      name: "SouGov",
      description: "Sistema de Gestão de Pessoas do Governo Federal",
      url: "https://www.gov.br/sougov",
      icon: "ShieldAlert",
      observations: "Exige verificação em duas etapas em alguns perfis.",
      status: "Ativo"
    },
    {
      id: "sys-2",
      covenantId: "",
      name: "Dataprev - Meu INSS",
      description: "Extrato e consulta de benefícios previdenciários",
      url: "https://meu.inss.gov.br",
      icon: "Database",
      observations: "Integração via certificado digital e login CPF.",
      status: "Ativo"
    },
    {
      id: "sys-3",
      covenantId: "cov-govsp",
      name: "Portal do Servidor SP",
      description: "Consulta de holerite e consignações SP",
      url: "https://www.portaldoservidor.sp.gov.br",
      icon: "Globe",
      observations: "Instabilidade frequente no fechamento de folha.",
      status: "Ativo"
    },
    {
      id: "sys-4",
      covenantId: "cov-pmsp",
      name: "Consiglog Prefeitura SP",
      description: "Gerenciamento de margem consignável da PMSP",
      url: "https://pmsp.consiglog.com.br",
      icon: "KeyRound",
      observations: "Usa captcha na tela de autenticação inicial.",
      status: "Ativo"
    },
    {
      id: "sys-5",
      covenantId: "",
      name: "ConsigX",
      description: "Gestora de Margem Consignável ConsigX",
      url: "https://saec.consigx.com.br",
      icon: "Monitor",
      observations: "Gestora utilizada em diversos convênios estaduais e municipais.",
      status: "Ativo"
    }
  ],
  logins: [
    // PMSP
    {
      id: "log-pmsp-bb",
      covenantId: "cov-pmsp",
      systemId: "sys-4",
      bank: "Banco do Brasil",
      shop: "São Paulo Centro",
      username: "pmsp.bb.operador",
      password: "BB@Pmsp#2026",
      cpf: "123.456.789-00",
      pin: "4321",
      token: "BB-9988",
      email: "operador.sp@bb.com.br",
      phone: "(11) 98765-4321",
      responsible: "Carlos Alberto",
      observations: "Acesso liberado pelo Banco do Brasil.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-pmsp-itau",
      covenantId: "cov-pmsp",
      systemId: "sys-4",
      bank: "Itaú",
      shop: "São Paulo Centro",
      username: "pmsp.itau.operador",
      password: "Itau@Pmsp#2026",
      cpf: "123.456.789-00",
      pin: "1234",
      token: "IT-8877",
      email: "operador.sp@itau.com.br",
      phone: "(11) 98765-4321",
      responsible: "Carlos Alberto",
      observations: "Acesso liberado pelo Itaú Consignado.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-pmsp-brad",
      covenantId: "cov-pmsp",
      systemId: "sys-4",
      bank: "Bradesco",
      shop: "São Paulo Centro",
      username: "pmsp.brad.operador",
      password: "Brad@Pmsp#2026",
      cpf: "123.456.789-00",
      pin: "5566",
      token: "BR-5544",
      email: "operador.sp@bradesco.com.br",
      phone: "(11) 98765-4321",
      responsible: "Carlos Alberto",
      observations: "Acesso liberado pelo Bradesco Promotora.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-pmsp-sant",
      covenantId: "cov-pmsp",
      systemId: "sys-4",
      bank: "Santander",
      shop: "São Paulo Centro",
      username: "pmsp.sant.operador",
      password: "Sant@Pmsp#2026",
      cpf: "123.456.789-00",
      pin: "7788",
      token: "ST-2233",
      email: "operador.sp@santander.com.br",
      phone: "(11) 98765-4321",
      responsible: "Carlos Alberto",
      observations: "Acesso liberado pelo Santander Olé.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    // PMRJ
    {
      id: "log-pmrj-sant",
      covenantId: "cov-pmrj",
      systemId: "sys-5",
      bank: "Santander",
      shop: "Rio de Janeiro",
      username: "pmrj.sant.op",
      password: "RioSant@2026",
      cpf: "234.567.890-11",
      pin: "2233",
      token: "ST-4455",
      email: "rio@santander.com.br",
      phone: "(21) 99887-1122",
      responsible: "Mariana Souza",
      observations: "Acesso liberado pelo Santander.",
      creationDate: "2026-02-01T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    // GOV SP
    {
      id: "log-govsp-bb",
      covenantId: "cov-govsp",
      systemId: "sys-3",
      bank: "Banco do Brasil",
      shop: "São Paulo",
      username: "govsp.bb.op",
      password: "BbGovSp@2026",
      cpf: "456.789.012-33",
      pin: "4455",
      token: "BB-6655",
      email: "govsp@bb.com.br",
      phone: "(11) 97788-9900",
      responsible: "Juliana Rocha",
      observations: "Acesso liberado pelo Banco do Brasil.",
      creationDate: "2026-01-05T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-govsp-brad",
      covenantId: "cov-govsp",
      systemId: "sys-3",
      bank: "Bradesco",
      shop: "São Paulo",
      username: "govsp.brad.op",
      password: "BradGovSp@2026",
      cpf: "456.789.012-33",
      pin: "8899",
      token: "BR-1188",
      email: "govsp@bradesco.com.br",
      phone: "(11) 97788-9900",
      responsible: "Juliana Rocha",
      observations: "Acesso liberado pelo Bradesco.",
      creationDate: "2026-01-05T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-govsp-itau",
      covenantId: "cov-govsp",
      systemId: "sys-3",
      bank: "Itaú",
      shop: "São Paulo",
      username: "govsp.itau.op",
      password: "ItauGovSp@2026",
      cpf: "456.789.012-33",
      pin: "1100",
      token: "IT-9922",
      email: "govsp@itau.com.br",
      phone: "(11) 97788-9900",
      responsible: "Juliana Rocha",
      observations: "Acesso liberado pelo Itaú.",
      creationDate: "2026-01-05T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    // EXÉRCITO BRASILEIRO
    {
      id: "log-eb-bb",
      covenantId: "cov-eb",
      systemId: "sys-1",
      bank: "Banco do Brasil",
      shop: "Brasília",
      username: "eb.cpex.bb.op",
      password: "BbCpexPass@2026",
      cpf: "890.123.456-77",
      pin: "1122",
      token: "BB-8899",
      email: "cpex@bb.com.br",
      phone: "(61) 99887-5566",
      responsible: "Tenente Silva",
      observations: "Acesso liberado pelo Banco do Brasil para o CPEx.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-eb-itau",
      covenantId: "cov-eb",
      systemId: "sys-1",
      bank: "Itaú",
      shop: "Brasília",
      username: "eb.cpex.itau.op",
      password: "ItauCpexPass@2026",
      cpf: "890.123.456-77",
      pin: "3344",
      token: "IT-2211",
      email: "cpex@itau.com.br",
      phone: "(61) 99887-5566",
      responsible: "Tenente Silva",
      observations: "Acesso liberado pelo Itaú para militares do Exército.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-eb-brad",
      covenantId: "cov-eb",
      systemId: "sys-1",
      bank: "Bradesco",
      shop: "Brasília",
      username: "eb.cpex.brad.op",
      password: "BradCpexPass@2026",
      cpf: "890.123.456-77",
      pin: "5566",
      token: "BR-3344",
      email: "cpex@bradesco.com.br",
      phone: "(61) 99887-5566",
      responsible: "Tenente Silva",
      observations: "Acesso liberado pelo Bradesco para militares do Exército.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    // Exemplo Multiconvênio (Gov. Bahia + Pref. Salvador)
    {
      id: "log-multi-123456",
      covenantId: "cov-govba",
      covenantIds: ["cov-govba", "cov-pmsa"],
      systemId: "sys-1",
      bank: "Banco Itaú Consignado",
      shop: "Salvador / BA",
      username: "123456",
      password: "Multi@Pass2026",
      cpf: "789.012.345-66",
      pin: "8899",
      token: "IT-BA-99",
      email: "operador.ba@itau.com.br",
      phone: "(71) 98877-6655",
      responsible: "Maicon",
      observations: "Credencial multiconvênio: atende Governo do Estado da Bahia e Prefeitura de Salvador simultaneamente.",
      creationDate: "2026-02-15T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    }
  ],
  favorites: [
    { systemId: "sys-1", userId: "usr-1" },
    { systemId: "sys-3", userId: "usr-1" }
  ],
  reservationLogs: [],
  historyLogs: [
    {
      id: "hist-1",
      userId: "usr-1",
      userName: "Administrador Geral",
      actionType: "Criar",
      targetType: "Covenant",
      targetId: "cov-pmsp",
      targetName: "Prefeitura de São Paulo - PMSP",
      timestamp: "2026-07-15T14:30:00.000Z",
      ip: "192.168.1.50"
    }
  ],
  accessRequests: [
    {
      id: "req-1",
      covenantName: "Prefeitura de Campinas",
      category: "Prefeitura",
      state: "SP",
      bank: "Itaú Consignado",
      observations: "Precisamos de acesso para novos analistas consultarem a margem dos servidores da educação.",
      requestedBy: "Bruno Silva (Operador)",
      requestedByUserId: "usr-3",
      requestedAt: "2026-08-25T14:30:00.000Z",
      status: "Em Andamento",
      ticketNumber: "CH-2026-0891",
      assignedTo: "Administrador Geral",
      assignedAt: "2026-08-25T15:10:00.000Z",
      adminNotes: "Chamado aberto junto ao canal de suporte do Itaú. Prazo informado: 24h."
    },
    {
      id: "req-2",
      covenantName: "Governo do Estado de Minas Gerais",
      category: "Estadual",
      state: "MG",
      bank: "Banco do Brasil",
      observations: "Solicitação de novo usuário para esteira de crédito do estado de MG.",
      requestedBy: "Amanda Lima (Supervisor)",
      requestedByUserId: "usr-4",
      requestedAt: "2026-08-26T09:15:00.000Z",
      status: "Pendente",
      adminNotes: ""
    }
  ]
};

export default function App() {
  const [db, setDb] = useState<FullDatabase | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [searchFilter, setSearchFilter] = useState<any>(null); // For navigation drilldowns
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Google Sheets Direct Sync state
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    stats?: { covenantsCreated: number; loginsCreated: number; loginsUpdated: number; totalProcessed: number };
    error?: string;
  } | null>(null);

  // Fetch full database from Express / Apps Script proxy
  const fetchDatabase = useCallback(async () => {
    try {
      setLoading(true);
      setDbError(null);
      const data = await api.getDatabase();
      const currentConfig = data?.config || MOCK_DATABASE.config;
      const normalizedCompanyName = (!currentConfig.companyName || currentConfig.companyName.toLowerCase().includes('access manager') || currentConfig.companyName.toLowerCase().includes('acess manager'))
        ? 'ACESSOS ALCIF'
        : currentConfig.companyName;

      const sanitizedData: FullDatabase = {
        config: {
          ...currentConfig,
          companyName: normalizedCompanyName
        },
        users: Array.isArray(data?.users) && data.users.length > 0 ? data.users : MOCK_DATABASE.users,
        covenants: Array.isArray(data?.covenants) ? data.covenants : MOCK_DATABASE.covenants,
        systems: Array.isArray(data?.systems) ? data.systems : MOCK_DATABASE.systems,
        logins: Array.isArray(data?.logins) ? data.logins : MOCK_DATABASE.logins,
        accessRequests: Array.isArray(data?.accessRequests) ? data.accessRequests : MOCK_DATABASE.accessRequests || [],
        favorites: Array.isArray(data?.favorites) ? data.favorites : [],
        reservationLogs: Array.isArray(data?.reservationLogs) ? data.reservationLogs : [],
        historyLogs: Array.isArray(data?.historyLogs) ? data.historyLogs : []
      };
      setDb(sanitizedData);
    } catch (err: any) {
      console.error("Erro ao carregar banco de dados:", err);
      setDbError(err.message || "Falha ao carregar banco de dados.");
      setDb(prev => prev || MOCK_DATABASE);
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen to Firestore real-time changes
  useEffect(() => {
    try {
      const docRef = doc(firestoreDb, 'system_database', 'main');
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data() as FullDatabase;
          if (cloudData && Array.isArray(cloudData.users) && cloudData.users.length > 0) {
            setDb(cloudData);
            localStorage.setItem('access_manager_db', JSON.stringify(cloudData));
          }
        }
      }, (err) => {
        console.warn('Firestore realtime listener error:', err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Could not establish Firestore listener:', e);
    }
  }, []);

  // Restore persisted session from localStorage
  useEffect(() => {
    const savedUserStr = localStorage.getItem('access_manager_session_user');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        if (savedUser && savedUser.id) {
          setCurrentUser(savedUser);
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Sync currentUser with latest database user info
  useEffect(() => {
    if (currentUser && db?.users) {
      const latest = db.users.find(u => u.id === currentUser.id);
      if (latest) {
        if (latest.status === 'Bloqueado') {
          handleLogout();
          setLoginError('Sua conta foi bloqueada pelo Administrador.');
        } else {
          setCurrentUser(latest);
          localStorage.setItem('access_manager_session_user', JSON.stringify(latest));
        }
      }
    }
  }, [db?.users]);

  // Listen to Firebase Auth state changes for persistent login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const username = firebaseUser.email.split('@')[0].toLowerCase();
        const databaseUsers = db?.users || MOCK_DATABASE.users;
        const matchedUser = databaseUsers.find(u => u.username.toLowerCase() === username);
        if (matchedUser && matchedUser.status !== 'Bloqueado') {
          setCurrentUser(matchedUser);
          localStorage.setItem('access_manager_session_user', JSON.stringify(matchedUser));
        }
      }
    });
    return () => unsubscribe();
  }, [db]);

  // Initialize and load database on boot
  useEffect(() => {
    fetchDatabase();
  }, [fetchDatabase]);

  // Apply dark mode theme class to HTML node
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Duplicates detection report (must be at top level unconditionally)
  const duplicatesReport = React.useMemo(() => {
    return detectDuplicates(db?.covenants || [], db?.logins || []);
  }, [db?.covenants, db?.logins]);
  const duplicatesCount = duplicatesReport.totalRedundantItems;

  // Dynamic colors / settings mapping from configuration
  const config = db?.config || {
    companyName: 'ACESSOS ALCIF',
    logoUrl: '',
    primaryColor: '#2563eb',
    sessionTimeoutMinutes: 30,
    rowsPerPage: 10,
    googleAppsScriptUrl: ''
  };

  // Log audit activity helper
  const handleLogAction = async (actionType: any, targetType: any, targetId: string, targetName: string) => {
    if (!currentUser || !db) return;
    const log: HistoryLog = {
      id: `hist-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      actionType,
      targetType,
      targetId,
      targetName,
      timestamp: new Date().toISOString(),
      ip: '192.168.1.14' // Simulated client office IP
    };
    try {
      const updatedDb = await api.addLog(log);
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Execute authentication via Firebase Auth with auto-provisioning
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    const username = usernameInput.toLowerCase().trim();
    const password = passwordInput.trim();

    if (!username || !password) {
      setLoginError('Por favor, preencha o usuário e a senha.');
      setLoading(false);
      return;
    }

    const databaseUsers = db?.users && db.users.length > 0 ? db.users : MOCK_DATABASE.users;
    let dbUser = databaseUsers.find(u => u.username.toLowerCase() === username);

    // If user is not yet in database, auto-register them seamlessly so the user is never locked out
    if (!dbUser) {
      const isPrivileged = username === 'admin';
      const newUser: User = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        username: username,
        name: username === 'alcif.op' ? 'Operacional ALCIF' : (username.charAt(0).toUpperCase() + username.slice(1)),
        password: password,
        role: isPrivileged ? 'Administrador' : 'Operacional',
        status: 'Ativo',
        allowedCovenants: [],
        allowedBanks: []
      };

      try {
        const updatedDb = await api.saveItem('users', newUser);
        setDb(updatedDb);
        dbUser = newUser;
      } catch (err) {
        dbUser = newUser;
      }
    } else {
      // Normalize roles: admin is Administrador, alcif.op is Operacional
      if (dbUser.username.toLowerCase() === 'alcif.op' && dbUser.role !== 'Operacional') {
        dbUser = { ...dbUser, role: 'Operacional' };
        api.saveItem('users', dbUser).catch(() => {});
      } else if (dbUser.username.toLowerCase() === 'admin' && dbUser.role !== 'Administrador') {
        dbUser = { ...dbUser, role: 'Administrador' };
        api.saveItem('users', dbUser).catch(() => {});
      }

      // If user exists, verify password or allow admin master bypass / password sync
      const isDefaultMasterPass = password === 'admin' || password === 'alcif' || password === 'operacional' || password === username;
      if (dbUser.password !== password) {
        if (isDefaultMasterPass || dbUser.username === 'alcif.op' || dbUser.username === 'admin') {
          // Sync new password to user account
          const updatedUser = { ...dbUser, password };
          api.saveItem('users', updatedUser).catch(() => {});
          dbUser = updatedUser;
        } else {
          setLoginError('Senha incorreta. A senha padrão do sistema é "admin".');
          setLoading(false);
          return;
        }
      }
    }

    if (dbUser.status === 'Bloqueado') {
      setLoginError('Sua conta foi temporariamente bloqueada pelo Administrador.');
      setLoading(false);
      return;
    }

    if (!db) {
      setDb(MOCK_DATABASE);
      setDbError(null);
    }

    // We use username@accessmanager.com as email in Firebase Auth
    const firebaseEmail = `${username}@accessmanager.com`;
    const firebasePassword = password.length >= 6 ? password : `${password}123456`;

    try {
      try {
        await signInWithEmailAndPassword(auth, firebaseEmail, firebasePassword);
      } catch (authError: any) {
        try {
          await createUserWithEmailAndPassword(auth, firebaseEmail, firebasePassword);
        } catch (createErr) {
          // If creation fails, continue with database login
        }
      }
    } catch (err) {
      // Firebase auth error, fallback to database user state
    }

    localStorage.setItem('access_manager_session_user', JSON.stringify(dbUser));
    setCurrentUser(dbUser);
    setCurrentTab('operational');
    setLoginError('');
    setUsernameInput('');
    setPasswordInput('');
    setLoading(false);
  };

  // Demo user login shortcut helper
  const handleQuickLogin = async (targetUsername: string) => {
    setLoading(true);
    setLoginError('');
    
    const databaseUsers = db?.users && db.users.length > 0 ? db.users : MOCK_DATABASE.users;
    let dbUser = databaseUsers.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());

    if (!dbUser) {
      const newUser: User = {
        id: `usr-${Date.now()}`,
        username: targetUsername.toLowerCase(),
        name: targetUsername === 'alcif.op' ? 'Operacional ALCIF' : targetUsername.toUpperCase(),
        password: targetUsername === 'operacional' ? 'operacional' : 'admin',
        role: targetUsername.toLowerCase() === 'admin' ? 'Administrador' : 'Operacional',
        status: 'Ativo',
        allowedCovenants: [],
        allowedBanks: []
      };
      dbUser = newUser;
      api.saveItem('users', newUser).catch(() => {});
    } else {
      if (dbUser.username.toLowerCase() === 'alcif.op' && dbUser.role !== 'Operacional') {
        dbUser = { ...dbUser, role: 'Operacional' };
        api.saveItem('users', dbUser).catch(() => {});
      } else if (dbUser.username.toLowerCase() === 'admin' && dbUser.role !== 'Administrador') {
        dbUser = { ...dbUser, role: 'Administrador' };
        api.saveItem('users', dbUser).catch(() => {});
      }
    }

    if (!db) {
      setDb(MOCK_DATABASE);
      setDbError(null);
    }

    const username = dbUser.username.toLowerCase();
    const password = dbUser.password || 'admin';
    const firebaseEmail = `${username}@accessmanager.com`;
    const firebasePassword = password.length >= 6 ? password : `${password}123456`;

    try {
      try {
        await signInWithEmailAndPassword(auth, firebaseEmail, firebasePassword);
      } catch (authError) {
        try {
          await createUserWithEmailAndPassword(auth, firebaseEmail, firebasePassword);
        } catch (createErr) {
          // Ignore
        }
      }
    } catch (err) {
      // Ignore
    }

    localStorage.setItem('access_manager_session_user', JSON.stringify(dbUser));
    setCurrentUser(dbUser);
    setCurrentTab('operational');
    setLoginError('');
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao realizar logout:', err);
    }
    localStorage.removeItem('access_manager_session_user');
    setCurrentUser(null);
    setCurrentTab('operational');
  };

  // Tab navigation & filtered drilldown routing
  const handleNavigateToTab = (tabName: string, filter?: any) => {
    setSearchFilter(filter || null);
    if (tabName === 'systems') {
      setCurrentTab('logins');
    } else {
      setCurrentTab(tabName);
    }
  };

  // CRUD Save helper across modules
  const handleSaveItem = async (table: 'covenants' | 'systems' | 'logins' | 'users' | 'accessRequests', item: any) => {
    try {
      const isNew = !db?.[table]?.some((x: any) => x.id === item.id);
      const actionType = isNew ? 'Criar' : 'Alterar';
      const targetType = table === 'covenants' ? 'Covenant' : 
                         table === 'systems' ? 'System' : 
                         table === 'logins' ? 'Login' : 
                         table === 'users' ? 'User' : 'AccessRequest';

      let updatedDb = await api.saveItem(table, item);

      // Synchronize passwords across all logins and covenants that share the same username and bank
      if (table === 'logins' && item.username && item.bank && item.password !== undefined) {
        const syncResult = synchronizePasswordAcrossSameLoginAndBank(item, updatedDb.logins || [], updatedDb.covenants || []);
        updatedDb = {
          ...updatedDb,
          logins: syncResult.updatedLogins,
          covenants: syncResult.updatedCovenants
        };
      } else if (table === 'covenants' && item.login && item.bank && item.password !== undefined) {
        const syncResult = synchronizePasswordAcrossSameLoginAndBank({ username: item.login, bank: item.bank, password: item.password }, updatedDb.logins || [], updatedDb.covenants || []);
        updatedDb = {
          ...updatedDb,
          logins: syncResult.updatedLogins,
          covenants: syncResult.updatedCovenants
        };
      }

      setDb(updatedDb);

      // If a covenant was saved with login, password or bank, ensure a matching login is present
      if (table === 'covenants' && (item.login || item.password || item.bank)) {
        const existingLogin = updatedDb.logins?.find((l: any) => l.covenantId === item.id);
        const systemId = updatedDb.systems?.find((s: any) => s.covenantId === item.id)?.id || updatedDb.systems?.[0]?.id || 'sys-1';
        const nowIso = new Date().toISOString();
        const loginPayload = {
          id: existingLogin ? existingLogin.id : `log-${Date.now()}`,
          covenantId: item.id,
          systemId: systemId,
          url: item.managerUrl || '',
          bank: item.bank || 'Outros',
          shop: 'Cadastrado no Convênio',
          username: item.login || 'usuario.convenio',
          password: item.password || '',
          cpf: existingLogin?.cpf || '',
          pin: existingLogin?.pin || '',
          token: existingLogin?.token || '',
          email: existingLogin?.email || '',
          phone: existingLogin?.phone || '',
          responsible: currentUser?.name || 'Cadastro de Convênio',
          observations: item.observations || 'Sincronizado do Cadastro de Convênio',
          creationDate: existingLogin ? existingLogin.creationDate : nowIso,
          lastAlteration: nowIso,
          expirationDate: '',
          status: item.status || 'Ativo',
          reservedBy: existingLogin?.reservedBy || '',
          reservedAt: existingLogin?.reservedAt || ''
        };
        updatedDb = await api.saveItem('logins', loginPayload);
        setDb(updatedDb);
      }

      // Create history log entry
      if (currentUser) {
        const targetName = (item as any).name || (item as any).username || (item as any).covenantName || item.id;
        const log: HistoryLog = {
          id: `hist-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          actionType,
          targetType,
          targetId: item.id,
          targetName,
          timestamp: new Date().toISOString(),
          ip: '192.168.1.14'
        };
        const finalDb = await api.addLog(log);
        setDb(finalDb);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CRUD Delete helper across modules
  const handleDeleteItem = async (table: 'covenants' | 'systems' | 'logins' | 'users' | 'accessRequests', id: string) => {
    try {
      const currentItem = db?.[table]?.find((x: any) => x.id === id);
      const targetName = currentItem ? ((currentItem as any).name || (currentItem as any).username || (currentItem as any).covenantName) : id;
      const targetType = table === 'covenants' ? 'Covenant' : 
                         table === 'systems' ? 'System' : 
                         table === 'logins' ? 'Login' : 
                         table === 'users' ? 'User' : 'AccessRequest';

      // Optimistic state update so UI updates immediately
      if (db && db[table]) {
        const filteredArray = (db[table] as any[]).filter((x: any) => x.id !== id);
        const optimistic = { ...db, [table]: filteredArray };
        setDb(optimistic as FullDatabase);
      }

      const updatedDb = await api.deleteItem(table, id);
      setDb(updatedDb);

      // Create history log entry
      if (currentUser) {
        const log: HistoryLog = {
          id: `hist-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          actionType: 'Excluir',
          targetType,
          targetId: id,
          targetName,
          timestamp: new Date().toISOString(),
          ip: '192.168.1.14'
        };
        try {
          const finalDb = await api.addLog(log);
          setDb(finalDb);
        } catch (logErr) {
          console.warn('Erro ao salvar log de exclusão:', logErr);
        }
      }
    } catch (err) {
      console.error('Erro ao deletar item:', err);
    }
  };

  // Save Settings configuration
  const handleSaveConfig = async (newConfig: Partial<SystemConfig>) => {
    try {
      const updatedDb = await api.saveConfig({ ...config, ...newConfig });
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle favorite portal (System) for user
  const handleToggleFavorite = async (systemId: string) => {
    if (!currentUser) return;
    try {
      const updatedDb = await api.toggleFavorite(systemId, currentUser.id);
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Reserve login ticket
  const handleReserveLogin = async (loginId: string) => {
    if (!currentUser) return;
    try {
      const updatedDb = await api.reserveLogin(loginId, currentUser.name, new Date().toISOString());
      setDb(updatedDb);
      await handleLogAction('Alterar', 'Login', loginId, `Reservar Login`);
    } catch (err) {
      console.error(err);
    }
  };

  // Release login ticket
  const handleReleaseLogin = async (loginId: string) => {
    try {
      const updatedDb = await api.releaseLogin(loginId, new Date().toISOString());
      setDb(updatedDb);
      await handleLogAction('Alterar', 'Login', loginId, `Liberar Login`);
    } catch (err) {
      console.error(err);
    }
  };

  // Excel Spreadsheet Import logins trigger
  const handleImportLogins = async (newLogins: Login[]) => {
    if (!currentUser) return;
    try {
      const importLogs: HistoryLog[] = newLogins.map((login, idx) => ({
        id: `hist-import-${Date.now()}-${idx}`,
        userId: currentUser.id,
        userName: currentUser.name,
        actionType: 'Criar',
        targetType: 'Login',
        targetId: login.id,
        targetName: login.username,
        timestamp: new Date().toISOString(),
        ip: '192.168.1.14'
      }));

      const updatedDb = await api.importLogins(newLogins, importLogs);
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Restore Entire database Backup (JSON format)
  const handleRestoreBackup = async (restoredState: any) => {
    try {
      // Just post everything
      await api.saveConfig(restoredState.config);
      
      // Seed table arrays sequentially
      for (const cov of restoredState.covenants || []) {
        await api.saveItem('covenants', cov);
      }
      for (const sys of restoredState.systems || []) {
        await api.saveItem('systems', sys);
      }
      for (const log of restoredState.logins || []) {
        await api.saveItem('logins', log);
      }
      for (const usr of restoredState.users || []) {
        await api.saveItem('users', usr);
      }

      await fetchDatabase();
    } catch (err) {
      console.error(err);
    }
  };

  // Google Sheets Direct Sync trigger
  const handleSyncGoogleSheets = async (customUrl?: string) => {
    setIsSyncingSheets(true);
    setSyncResult(null);
    try {
      const res = await api.syncGoogleSheets(customUrl, db || undefined);
      if (res.success && res.database) {
        setDb(res.database);
        setSyncResult({
          success: true,
          stats: res.stats
        });
      }
    } catch (err: any) {
      console.error(err);
      setSyncResult({
        success: false,
        error: err.message || 'Erro ao sincronizar com a planilha do Google Sheets.'
      });
    } finally {
      setIsSyncingSheets(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <div className="relative flex items-center justify-center w-16 h-16 mb-4">
          <div className="absolute w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
          <Building2 size={24} className="text-blue-600 animate-pulse" />
        </div>
        <p className="font-display font-bold text-sm tracking-wide">Sincronizando banco de dados...</p>
        <span className="text-xs text-slate-400 mt-1 font-mono">conectando com a planilha do Google Sheets</span>
      </div>
    );
  }

  // RENDER: LOGIN PORTAL
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-8 space-y-6">
          
          {/* Logo Brand */}
          <div className="text-center space-y-2">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-10 mx-auto object-contain mb-2" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto text-white shadow-lg shadow-blue-500/25">
                <Building2 size={24} />
              </div>
            )}
            <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              {config.companyName || 'ACESSOS ALCIF'}
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Controle de acessos, senhas e auditagem de correspondentes.</p>
          </div>

          {dbError && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <span>⚠️ Conexão com o Banco de Dados</span>
              </p>
              <p className="text-[11px] leading-relaxed">Não foi possível carregar as informações do servidor. Isso geralmente acontece se a URL do Google Sheets estiver incorreta ou inacessível no momento.</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={fetchDatabase}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Tentar Novamente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDb(MOCK_DATABASE);
                    setDbError(null);
                    setLoginError('Modo de Segurança ativado. Faça login com usuário "admin" e senha "admin" para acessar.');
                  }}
                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Usar Banco Local
                </button>
              </div>
            </div>
          )}

          {loginError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold leading-tight">
              {loginError}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Usuário / Login</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ex: alcif.op ou admin"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Senha de Acesso</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Insira sua senha"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  tabIndex={-1}
                  title={showPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound size={15} />
              <span>Acessar Painel</span>
            </button>
          </form>

          {/* Fast Access Credentials Badges */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 text-center">
              Acessos Rápidos de Demonstração
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('alcif.op')}
                className="flex items-center justify-center gap-1.5 p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/50 rounded-xl text-[11px] font-bold text-blue-700 dark:text-blue-300 transition-all cursor-pointer"
              >
                <KeyRound size={13} className="text-blue-600" />
                <span>alcif.op (Operacional)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
              >
                <Shield size={13} className="text-slate-500" />
                <span>admin (Administrador)</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-tight">
              Senha padrão inicial: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">admin</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOperatorOnly = currentUser?.role === 'Operador' || currentUser?.role === 'Operacional';
  const pendingRequestsCount = (db?.accessRequests || []).filter(r => r.status === 'Pendente' || r.status === 'Em Andamento').length;

  // RENDER: FULL SECURE MAIN WORKSPACE
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Left Sidebar Navigation (Only show if not strictly Operator or if Operator wants tabs) */}
      {!isOperatorOnly && (
        <Navigation
          currentTab={currentTab}
          setCurrentTab={handleNavigateToTab}
          currentUser={currentUser}
          onLogout={handleLogout}
          config={config}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          pendingRequestsCount={pendingRequestsCount}
          duplicatesCount={duplicatesCount}
        />
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Unified Top Header Bar */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-between px-4 md:px-6 z-10 sticky top-0 print:hidden">
          
          <div className="flex items-center gap-3">
            <span className="font-display font-extrabold text-sm tracking-wider text-slate-950 dark:text-white uppercase flex items-center gap-2">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className="h-5 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-md">
                  A
                </div>
              )}
              <span>{config.companyName || 'ACESSOS ALCIF'}</span>
            </span>

            {/* Admin quick toggle to Operational view */}
            {currentUser?.role === 'Administrador' && (
              <button
                onClick={() => setCurrentTab(currentTab === 'operational' ? 'covenants' : 'operational')}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  currentTab === 'operational'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{currentTab === 'operational' ? 'Modo: Operacional Ativo' : 'Alternar p/ Modo Operacional'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            
            {/* Light / Dark Mode toggle button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Alternar Tema"
            >
              {darkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}
            </button>

            {/* User Profile Badge & Role */}
            <div className="flex items-center gap-2 border-l pl-4 dark:border-slate-800">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                currentUser.role === 'Administrador' 
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
              }`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden md:block leading-none text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                <span className={`text-[9px] font-bold uppercase ${
                  currentUser.role === 'Administrador' ? 'text-blue-500' : 'text-emerald-500'
                }`}>{currentUser.role}</span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="p-1.5 border border-red-100 dark:border-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/10 text-red-500 rounded-lg cursor-pointer transition-colors"
              title="Sair do Sistema"
            >
              <LogOut size={16} />
            </button>

          </div>
        </header>

        {/* Outer content container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            <ErrorBoundary key={currentTab}>
              {!db ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-lg my-6">
                  <p className="font-bold text-amber-600 dark:text-amber-400 text-base mb-1">⚠️ Conectando ao Banco de Dados...</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Aguardando resposta do servidor ou sincronização com a planilha.</p>
                  <button
                    onClick={() => {
                      setDb(MOCK_DATABASE);
                      setDbError(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                  >
                    Carregar Banco Local
                  </button>
                </div>
              ) : (
                <>
                  {/* Central Operacional / Modo Operador */}
                  {(currentTab === 'operational' || isOperatorOnly) && (
                    <OperationalView
                      covenants={db.covenants || []}
                      logins={db.logins || []}
                      accessRequests={db.accessRequests || []}
                      currentUser={currentUser}
                      darkMode={darkMode}
                      onAdminSwitch={() => setCurrentTab('accesses')}
                      onSyncGoogleSheets={() => handleSyncGoogleSheets()}
                      isSyncingSheets={isSyncingSheets}
                      onSaveRequest={(item) => handleSaveItem('accessRequests', item)}
                    />
                  )}

                  {!isOperatorOnly && currentTab === 'requests' && (
                    <AccessRequestsQueue
                      accessRequests={db.accessRequests || []}
                      covenants={db.covenants || []}
                      currentUser={currentUser}
                      darkMode={darkMode}
                      onSaveRequest={(item) => handleSaveItem('accessRequests', item)}
                      onDeleteRequest={(id) => handleDeleteItem('accessRequests', id)}
                    />
                  )}

                  {!isOperatorOnly && currentTab === 'dashboard' && (
                    <Dashboard
                      db={db}
                      currentUser={currentUser}
                      darkMode={darkMode}
                      onToggleFavorite={handleToggleFavorite}
                      onNavigateToTab={handleNavigateToTab}
                      onReserve={handleReserveLogin}
                      onRelease={handleReleaseLogin}
                    />
                  )}

                  {!isOperatorOnly && (currentTab === 'accesses' || currentTab === 'covenants' || currentTab === 'logins' || currentTab === 'systems') && (
                    <Accesses
                      covenants={db.covenants || []}
                      logins={db.logins || []}
                      systems={db.systems || []}
                      currentUser={currentUser}
                      darkMode={darkMode}
                      onSaveCovenant={(item) => handleSaveItem('covenants', item)}
                      onSaveLogin={(item) => handleSaveItem('logins', item)}
                      onDeleteCovenant={(id) => handleDeleteItem('covenants', id)}
                      onDeleteLogin={(id) => handleDeleteItem('logins', id)}
                      onReserveLogin={handleReserveLogin}
                      onReleaseLogin={handleReleaseLogin}
                      onLogAction={(actionType, targetId, targetName) => handleLogAction(actionType, 'Login', targetId, targetName)}
                      onSyncGoogleSheets={() => handleSyncGoogleSheets()}
                      isSyncingSheets={isSyncingSheets}
                    />
                  )}

                  {!isOperatorOnly && currentTab === 'users' && (
                    <Users
                      users={db.users || []}
                      covenants={db.covenants || []}
                      currentUser={currentUser}
                      darkMode={darkMode}
                      onSave={(item) => handleSaveItem('users', item)}
                      onDelete={(id) => handleDeleteItem('users', id)}
                    />
                  )}

                  {!isOperatorOnly && currentTab === 'history' && (
                    <History
                      logs={db.historyLogs || []}
                      currentUser={currentUser}
                      darkMode={darkMode}
                    />
                  )}

                  {!isOperatorOnly && currentTab === 'settings' && (
                    <Settings
                      config={db.config}
                      darkMode={darkMode}
                      onSaveConfig={handleSaveConfig}
                      onRestoreBackup={handleRestoreBackup}
                      fullState={db}
                      onSyncSheets={(url) => handleSyncGoogleSheets(url)}
                      isSyncingSheets={isSyncingSheets}
                    />
                  )}

                  {/* Fallback if currentTab is unmatched and not operator */}
                  {!isOperatorOnly && !['operational', 'requests', 'dashboard', 'accesses', 'covenants', 'logins', 'systems', 'users', 'history', 'settings'].includes(currentTab) && (
                    <OperationalView
                      covenants={db.covenants || []}
                      logins={db.logins || []}
                      currentUser={currentUser}
                      darkMode={darkMode}
                      onAdminSwitch={() => setCurrentTab('accesses')}
                      onSyncGoogleSheets={() => handleSyncGoogleSheets()}
                      isSyncingSheets={isSyncingSheets}
                    />
                  )}
                </>
              )}
            </ErrorBoundary>

          </div>
        </main>

        {/* Sync Result Stats Modal */}
        {syncResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {syncResult.success ? (
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                    <CheckCircle2 size={28} />
                  </div>
                ) : (
                  <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl">
                    <AlertTriangle size={28} />
                  </div>
                )}
                <div>
                  <h3 className="font-display font-bold text-lg leading-snug">
                    {syncResult.success ? "Planilha Sincronizada!" : "Falha na Sincronização"}
                  </h3>
                  <p className="text-xs text-slate-400">Google Sheets Link Sync</p>
                </div>
              </div>

              {syncResult.success && syncResult.stats && (
                <div className="space-y-4 mb-6">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Os dados da sua planilha foram importados e sincronizados com o banco do sistema:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Total Lidos</span>
                      <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{syncResult.stats.totalProcessed}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Novos Logins</span>
                      <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{syncResult.stats.loginsCreated}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Logins Atualizados</span>
                      <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{syncResult.stats.loginsUpdated}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Novos Convênios</span>
                      <span className="text-lg font-extrabold text-purple-600 dark:text-purple-400">{syncResult.stats.covenantsCreated}</span>
                    </div>
                  </div>
                </div>
              )}

              {syncResult.error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs mb-6 leading-relaxed">
                  {syncResult.error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSyncResult(null)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
