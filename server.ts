import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { FullDatabase } from "./src/lib/api";
import { transformGoogleSheetsUrl, parseCSV, syncCsvRowsToDatabase } from "./src/lib/sheetsSync";
import { normalizeText, isSameLoginAndBank, synchronizePasswordAcrossSameLoginAndBank } from "./src/lib/utils";

// In-Memory Spreadsheet Simulation (Database)
let dataBase: FullDatabase = {
  config: {
    companyName: "ACESSOS ALCIF",
    logoUrl: "",
    primaryColor: "#2563eb", // Blue-600
    sessionTimeoutMinutes: 30,
    rowsPerPage: 10,
    googleAppsScriptUrl: "",
    googleSheetsSyncUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcMpLh93RfKdkQ6mGju40CgMTaz7RhBP7S_5LiNWF1BY0ZigqO8dpZpSh1gtx_oAiDtIyXX8Jc-gbC/pubhtml"
  },
  
  users: [
    {
      id: "usr-1",
      username: "admin",
      name: "Administrador Geral",
      password: "admin",
      role: "Administrador",
      status: "Ativo",
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: "usr-2",
      username: "operacional",
      name: "Operador de Atendimento",
      password: "operacional",
      role: "Operacional",
      status: "Ativo",
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: "usr-3",
      username: "operador",
      name: "Bruno Silva (Operador)",
      password: "operador",
      role: "Operador",
      status: "Ativo",
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: "usr-4",
      username: "supervisor",
      name: "Amanda Lima (Supervisor)",
      password: "supervisor",
      role: "Supervisor",
      status: "Ativo",
      allowedCovenants: [],
      allowedBanks: []
    }
  ],

  covenants: [
    // --- PREFEITURAS ---
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
    {
      id: "cov-pmfor",
      name: "Prefeitura de Fortaleza",
      category: "Prefeituras",
      state: "CE",
      city: "Fortaleza",
      organ: "Secretaria de Finanças",
      manager: "Consiglog",
      managerUrl: "https://fortaleza.consiglog.com.br",
      login: "fortaleza.brad",
      password: "ForBrad@2026",
      bank: "Bradesco",
      observations: "Servidores da prefeitura de Fortaleza.",
      status: "Ativo"
    },
    {
      id: "cov-pmrec",
      name: "Prefeitura de Recife",
      category: "Prefeituras",
      state: "PE",
      city: "Recife",
      organ: "Secretaria de Administração",
      manager: "Zetasoft",
      managerUrl: "https://recife.zetasoft.com.br",
      login: "recife.bb.op",
      password: "RecifePass#2026",
      bank: "Banco do Brasil",
      observations: "Gestora Zetasoft para prefeitura do Recife.",
      status: "Ativo"
    },
    {
      id: "cov-pmcam",
      name: "Prefeitura de Campinas",
      category: "Prefeituras",
      state: "SP",
      city: "Campinas",
      organ: "Secretaria de Recursos Humanos",
      manager: "ConsigX",
      managerUrl: "https://campinas.consigx.com.br",
      login: "campinas.sant",
      password: "CampPass@2026",
      bank: "Santander",
      observations: "Consignado dos servidores municipais de Campinas.",
      status: "Ativo"
    },

    // --- GOVERNOS ESTADUAIS ---
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
      id: "cov-govpr",
      name: "Governo do Estado do Paraná",
      category: "Governos",
      state: "PR",
      city: "Curitiba",
      organ: "Secretaria da Administração e da Previdência",
      manager: "Celepar / Meta4",
      managerUrl: "https://celepar.pr.gov.br",
      login: "pr.gov.caixa",
      password: "PrGovPass#2026",
      bank: "Caixa Econômica",
      observations: "Servidores estaduais do Paraná.",
      status: "Ativo"
    },
    {
      id: "cov-govba",
      name: "Governo do Estado da Bahia",
      category: "Governos",
      state: "BA",
      city: "Salvador",
      organ: "Secretaria da Administração (SAEB)",
      manager: "Portal do Servidor BA",
      managerUrl: "https://portaldoservidor.ba.gov.br",
      login: "ba.gov.bb",
      password: "BaGovPass@2026",
      bank: "Banco do Brasil",
      observations: "Servidores públicos estaduais da Bahia.",
      status: "Ativo"
    },
    {
      id: "cov-govrs",
      name: "Governo do Estado do Rio Grande do Sul",
      category: "Governos",
      state: "RS",
      city: "Porto Alegre",
      organ: "Secretaria de Planejamento, Governança e Gestão",
      manager: "RHE / Procergs",
      managerUrl: "https://rhe.rs.gov.br",
      login: "rs.gov.banrisul",
      password: "RsBanrisul@2026",
      bank: "Banrisul",
      observations: "Portal RHE do Governo Gaúcho.",
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
    {
      id: "cov-govgo",
      name: "Governo do Estado de Goiás",
      category: "Governos",
      state: "GO",
      city: "Goiânia",
      organ: "Secretaria de Estado da Administração (SEAD)",
      manager: "Consiglog Goiás",
      managerUrl: "https://goias.consiglog.com.br",
      login: "go.gov.bb",
      password: "GoGovPass@2026",
      bank: "Banco do Brasil",
      observations: "Consignado dos servidores do estado de Goiás.",
      status: "Ativo"
    },
    {
      id: "cov-govsc",
      name: "Governo do Estado de Santa Catarina",
      category: "Governos",
      state: "SC",
      city: "Florianópolis",
      organ: "Secretaria de Estado da Administração",
      manager: "SIGRH SC",
      managerUrl: "https://portaldoservidor.sc.gov.br",
      login: "sc.gov.bb",
      password: "ScGovPass@2026",
      bank: "Banco do Brasil",
      observations: "Servidores públicos de Santa Catarina.",
      status: "Ativo"
    },
    {
      id: "cov-govce",
      name: "Governo do Estado do Ceará",
      category: "Governos",
      state: "CE",
      city: "Fortaleza",
      organ: "Secretaria do Planejamento e Gestão (SEPLAG)",
      manager: "Guardião Ceará",
      managerUrl: "https://guardiao.seplag.ce.gov.br",
      login: "ce.gov.brad",
      password: "CeGovPass#2026",
      bank: "Bradesco",
      observations: "Servidores estaduais do Ceará.",
      status: "Ativo"
    },
    {
      id: "cov-govpe",
      name: "Governo do Estado de Pernambuco",
      category: "Governos",
      state: "PE",
      city: "Recife",
      organ: "Secretaria de Administração (SAD-PE)",
      manager: "ConsigPE",
      managerUrl: "https://sad.pe.gov.br",
      login: "pe.gov.bb",
      password: "PeGovPass@2026",
      bank: "Banco do Brasil",
      observations: "Servidores ativos e pensionistas de Pernambuco.",
      status: "Ativo"
    },

    // --- FORÇAS ARMADAS & DEFESA ---
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
      id: "cov-defesa",
      name: "Ministério da Defesa / Forças Armadas Unificadas",
      category: "Forças Armadas",
      state: "DF",
      city: "Brasília",
      organ: "Estado-Maior Conjunto das Forças Armadas",
      manager: "Portal Defesa",
      managerUrl: "https://defesa.gov.br",
      login: "defesa.caixa",
      password: "DefesaCxPass@2026",
      bank: "Caixa Econômica",
      observations: "Quadro civil e unificado do Ministério da Defesa.",
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
      covenantId: "cov-1",
      name: "SouGov",
      description: "Sistema de Gestão de Pessoas do Governo Federal",
      url: "https://www.gov.br/sougov",
      icon: "ShieldAlert",
      observations: "Exige verificação em duas etapas em alguns perfis.",
      status: "Ativo"
    },
    {
      id: "sys-2",
      covenantId: "cov-2",
      name: "Dataprev - Meu INSS",
      description: "Extrato e consulta de benefícios previdenciários",
      url: "https://meu.inss.gov.br",
      icon: "Database",
      observations: "Integração via certificado digital e login CPF.",
      status: "Ativo"
    },
    {
      id: "sys-3",
      covenantId: "cov-3",
      name: "Portal do Servidor SP",
      description: "Consulta de holerite e consignações SP",
      url: "https://www.portaldoservidor.sp.gov.br",
      icon: "Globe",
      observations: "Instabilidade frequente no fechamento de folha.",
      status: "Ativo"
    },
    {
      id: "sys-4",
      covenantId: "cov-4",
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
    {
      id: "log-pmrj-itau",
      covenantId: "cov-pmrj",
      systemId: "sys-5",
      bank: "Itaú",
      shop: "Rio de Janeiro",
      username: "pmrj.itau.op",
      password: "RioItau@2026",
      cpf: "234.567.890-11",
      pin: "9911",
      token: "IT-3311",
      email: "rio@itau.com.br",
      phone: "(21) 99887-1122",
      responsible: "Mariana Souza",
      observations: "Acesso liberado pelo Itaú.",
      creationDate: "2026-02-01T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // PMBH
    {
      id: "log-pmbh-bb",
      covenantId: "cov-pmbh",
      systemId: "sys-5",
      bank: "Banco do Brasil",
      shop: "Belo Horizonte",
      username: "pmbh.bb.operador",
      password: "BbPmbhPass#2026",
      cpf: "345.678.901-22",
      pin: "3344",
      token: "BB-7711",
      email: "bh@bb.com.br",
      phone: "(31) 98765-1122",
      responsible: "Eduardo Lima",
      observations: "Acesso liberado pelo Banco do Brasil.",
      creationDate: "2026-02-15T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-pmbh-brad",
      covenantId: "cov-pmbh",
      systemId: "sys-5",
      bank: "Bradesco",
      shop: "Belo Horizonte",
      username: "pmbh.brad.operador",
      password: "BradPmbhPass#2026",
      cpf: "345.678.901-22",
      pin: "5511",
      token: "BR-9900",
      email: "bh@bradesco.com.br",
      phone: "(31) 98765-1122",
      responsible: "Eduardo Lima",
      observations: "Acesso liberado pelo Bradesco.",
      creationDate: "2026-02-15T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // GOVERNO DE SP
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
    {
      id: "log-govsp-sant",
      covenantId: "cov-govsp",
      systemId: "sys-3",
      bank: "Santander",
      shop: "São Paulo",
      username: "govsp.sant.op",
      password: "SantGovSp@2026",
      cpf: "456.789.012-33",
      pin: "3322",
      token: "ST-7766",
      email: "govsp@santander.com.br",
      phone: "(11) 97788-9900",
      responsible: "Juliana Rocha",
      observations: "Acesso liberado pelo Santander.",
      creationDate: "2026-01-05T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // GOVERNO DO RJ
    {
      id: "log-govrj-brad",
      covenantId: "cov-govrj",
      systemId: "sys-5",
      bank: "Bradesco",
      shop: "Rio de Janeiro",
      username: "govrj.brad.op",
      password: "BradGovRj@2026",
      cpf: "567.890.123-44",
      pin: "5566",
      token: "BR-8822",
      email: "govrj@bradesco.com.br",
      phone: "(21) 98877-6655",
      responsible: "Rodrigo Costa",
      observations: "Acesso liberado pelo Bradesco.",
      creationDate: "2026-01-20T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-govrj-itau",
      covenantId: "cov-govrj",
      systemId: "sys-5",
      bank: "Itaú",
      shop: "Rio de Janeiro",
      username: "govrj.itau.op",
      password: "ItauGovRj@2026",
      cpf: "567.890.123-44",
      pin: "1234",
      token: "IT-4499",
      email: "govrj@itau.com.br",
      phone: "(21) 98877-6655",
      responsible: "Rodrigo Costa",
      observations: "Acesso liberado pelo Itaú.",
      creationDate: "2026-01-20T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // GOVERNO DE MG
    {
      id: "log-govmg-bb",
      covenantId: "cov-govmg",
      systemId: "sys-5",
      bank: "Banco do Brasil",
      shop: "Belo Horizonte",
      username: "govmg.bb.op",
      password: "BbGovMg@2026",
      cpf: "678.901.234-55",
      pin: "7788",
      token: "BB-1122",
      email: "govmg@bb.com.br",
      phone: "(31) 99887-2233",
      responsible: "Fernanda Alves",
      observations: "Acesso liberado pelo Banco do Brasil.",
      creationDate: "2026-02-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-govmg-itau",
      covenantId: "cov-govmg",
      systemId: "sys-5",
      bank: "Itaú",
      shop: "Belo Horizonte",
      username: "govmg.itau.op",
      password: "ItauGovMg@2026",
      cpf: "678.901.234-55",
      pin: "9900",
      token: "IT-6677",
      email: "govmg@itau.com.br",
      phone: "(31) 99887-2233",
      responsible: "Fernanda Alves",
      observations: "Acesso liberado pelo Itaú Consignado.",
      creationDate: "2026-02-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // GOVERNO DO DF (GDF)
    {
      id: "log-govdf-brb",
      covenantId: "cov-govdf",
      systemId: "sys-5",
      bank: "BRB - Banco de Brasília",
      shop: "Brasília",
      username: "gdf.brb.operador",
      password: "BrbPass#2026",
      cpf: "789.012.345-66",
      pin: "1234",
      token: "BRB-9988",
      email: "gdf@brb.com.br",
      phone: "(61) 98877-3344",
      responsible: "Marcos Vinicius",
      observations: "Acesso liberado pelo BRB.",
      creationDate: "2026-01-15T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-govdf-bb",
      covenantId: "cov-govdf",
      systemId: "sys-5",
      bank: "Banco do Brasil",
      shop: "Brasília",
      username: "gdf.bb.operador",
      password: "BbGdfPass#2026",
      cpf: "789.012.345-66",
      pin: "4321",
      token: "BB-4433",
      email: "gdf@bb.com.br",
      phone: "(61) 98877-3344",
      responsible: "Marcos Vinicius",
      observations: "Acesso liberado pelo Banco do Brasil.",
      creationDate: "2026-01-15T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // FORÇAS ARMADAS: EXÉRCITO BRASILEIRO (CPEx)
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
    {
      id: "log-eb-sant",
      covenantId: "cov-eb",
      systemId: "sys-1",
      bank: "Santander",
      shop: "Brasília",
      username: "eb.cpex.sant.op",
      password: "SantCpexPass@2026",
      cpf: "890.123.456-77",
      pin: "7788",
      token: "ST-5566",
      email: "cpex@santander.com.br",
      phone: "(61) 99887-5566",
      responsible: "Tenente Silva",
      observations: "Acesso liberado pelo Santander para militares do Exército.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // FORÇAS ARMADAS: FORÇA AÉREA BRASILEIRA (DIRAP)
    {
      id: "log-fab-bb",
      covenantId: "cov-fab",
      systemId: "sys-1",
      bank: "Banco do Brasil",
      shop: "Rio de Janeiro",
      username: "fab.dirap.bb.op",
      password: "BbFabPass#2026",
      cpf: "901.234.567-88",
      pin: "1234",
      token: "BB-3355",
      email: "dirap@bb.com.br",
      phone: "(21) 97766-4433",
      responsible: "Capitão Santos",
      observations: "Acesso liberado pelo Banco do Brasil para a Aeronáutica.",
      creationDate: "2026-01-20T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-fab-sant",
      covenantId: "cov-fab",
      systemId: "sys-1",
      bank: "Santander",
      shop: "Rio de Janeiro",
      username: "fab.dirap.sant.op",
      password: "SantFabPass#2026",
      cpf: "901.234.567-88",
      pin: "5678",
      token: "ST-9911",
      email: "dirap@santander.com.br",
      phone: "(21) 97766-4433",
      responsible: "Capitão Santos",
      observations: "Acesso liberado pelo Santander para a Aeronáutica.",
      creationDate: "2026-01-20T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },

    // FORÇAS ARMADAS: MARINHA DO BRASIL (PAPEM)
    {
      id: "log-mb-bb",
      covenantId: "cov-mb",
      systemId: "sys-1",
      bank: "Banco do Brasil",
      shop: "Rio de Janeiro",
      username: "mb.papem.bb.op",
      password: "BbMbPass#2026",
      cpf: "012.345.678-99",
      pin: "4321",
      token: "BB-6677",
      email: "papem@bb.com.br",
      phone: "(21) 98899-7766",
      responsible: "Sargento Oliveira",
      observations: "Acesso liberado pelo Banco do Brasil para a Marinha.",
      creationDate: "2026-01-25T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    },
    {
      id: "log-mb-brad",
      covenantId: "cov-mb",
      systemId: "sys-1",
      bank: "Bradesco",
      shop: "Rio de Janeiro",
      username: "mb.papem.brad.op",
      password: "BradMbPass#2026",
      cpf: "012.345.678-99",
      pin: "8765",
      token: "BR-5533",
      email: "papem@bradesco.com.br",
      phone: "(21) 98899-7766",
      responsible: "Sargento Oliveira",
      observations: "Acesso liberado pelo Bradesco para a Marinha.",
      creationDate: "2026-01-25T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo"
    }
  ],

  favorites: [
    { systemId: "sys-1", userId: "usr-1" },
    { systemId: "sys-2", userId: "usr-1" },
    { systemId: "sys-1", userId: "usr-2" }
  ],

  reservationLogs: [
    {
      id: "res-1",
      loginId: "log-1",
      loginUser: "bb.consignado01",
      systemName: "SouGov",
      reservedBy: "Bruno Silva",
      reservedAt: "2026-07-17T16:00:00.000Z",
      releasedAt: "2026-07-17T16:45:00.000Z",
      durationSeconds: 2700
    },
    {
      id: "res-2",
      loginId: "log-2",
      loginUser: "itau.prev02",
      systemName: "Dataprev - Meu INSS",
      reservedBy: "Amanda Lima",
      reservedAt: "2026-07-17T14:30:00.000Z",
      releasedAt: "2026-07-17T15:10:00.000Z",
      durationSeconds: 2400
    }
  ],

  historyLogs: [
    {
      id: "hist-1",
      userId: "usr-1",
      userName: "Maicon Operacional (Admin)",
      actionType: "Criar",
      targetType: "Login",
      targetId: "log-1",
      targetName: "bb.consignado01",
      timestamp: "2026-07-15T14:30:00.000Z",
      ip: "192.168.1.50"
    },
    {
      id: "hist-2",
      userId: "usr-2",
      userName: "Amanda Lima (Supervisor)",
      actionType: "Copiar Senha",
      targetType: "Login",
      targetId: "log-1",
      targetName: "bb.consignado01",
      timestamp: "2026-07-17T15:30:00.000Z",
      ip: "192.168.1.51"
    },
    {
      id: "hist-3",
      userId: "usr-3",
      userName: "Bruno Silva (Operador)",
      actionType: "Abrir Sistema",
      targetType: "System",
      targetId: "sys-1",
      targetName: "SouGov",
      timestamp: "2026-07-17T16:00:00.000Z",
      ip: "192.168.1.52"
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

// Proxies database operations to Google Apps Script Web App if URL is provided
async function callAppsScript(url: string, action: string, payload: any) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Apps Script responded with status: ${response.status}`);
    }
    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error("Error communicating with Google Apps Script:", error.message || error);
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper middleware to forward requests to Google Apps Script if URL exists
  const useSheet = async (action: string, localFallback: () => any, appsScriptPayload: any = {}) => {
    const scriptUrl = dataBase.config.googleAppsScriptUrl;
    if (scriptUrl) {
      try {
        console.log(`Routing ${action} to Google Sheets Apps Script...`);
        const result = await callAppsScript(scriptUrl, action, appsScriptPayload);
        if (result && result.success) {
          // Sync local DB cache if return format contains database
          if (result.database) {
            dataBase = { ...dataBase, ...result.database };
          }
          return result;
        } else {
          console.warn(`Apps Script returned success=false or invalid response for ${action}. Falling back to local database.`, result);
          return localFallback();
        }
      } catch (err: any) {
        console.error("Failed to call Apps Script, falling back to local database:", err.message);
        // If external call fails, we execute local fallback
        return localFallback();
      }
    } else {
      return localFallback();
    }
  };

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get all data
  app.get("/api/data", async (req, res) => {
    const result = await useSheet("getAll", () => ({ success: true, database: dataBase }));
    res.json(result);
  });

  // Save Config
  app.post("/api/config", async (req, res) => {
    const config = req.body;
    const result = await useSheet("saveConfig", () => {
      dataBase.config = { ...dataBase.config, ...config };
      return { success: true, database: dataBase };
    }, { config });
    res.json(result);
  });

  // Save / Update Entity
  app.post("/api/save", async (req, res) => {
    const { table, item } = req.body; // table: 'covenants' | 'systems' | 'logins' | 'users'
    const result = await useSheet("saveItem", () => {
      const dbTable = (dataBase as any)[table];
      if (dbTable) {
        const existingIndex = dbTable.findIndex((x: any) => x.id === item.id);
        if (existingIndex > -1) {
          dbTable[existingIndex] = { ...dbTable[existingIndex], ...item };
        } else {
          dbTable.push(item);
        }

        // Synchronize passwords across all logins and covenants that share the same username and bank
        if (table === 'logins' && item.username && item.bank && item.password !== undefined) {
          const syncResult = synchronizePasswordAcrossSameLoginAndBank(item, dataBase.logins, dataBase.covenants);
          dataBase.logins = syncResult.updatedLogins;
          dataBase.covenants = syncResult.updatedCovenants;
        } else if (table === 'covenants' && item.login && item.bank && item.password !== undefined) {
          const syncResult = synchronizePasswordAcrossSameLoginAndBank({ username: item.login, bank: item.bank, password: item.password }, dataBase.logins, dataBase.covenants);
          dataBase.logins = syncResult.updatedLogins;
          dataBase.covenants = syncResult.updatedCovenants;
        }

        return { success: true, database: dataBase };
      }
      return { success: false, error: "Tabela não encontrada" };
    }, { table, item });

    // Guarantee local memory sync
    const dbTable = (dataBase as any)[table];
    if (dbTable) {
      const existingIndex = dbTable.findIndex((x: any) => x.id === item.id);
      if (existingIndex > -1) {
        dbTable[existingIndex] = { ...dbTable[existingIndex], ...item };
      } else {
        dbTable.push(item);
      }

      // Synchronize passwords across all logins and covenants that share the same username and bank
      if (table === 'logins' && item.username && item.bank && item.password !== undefined) {
        const syncResult = synchronizePasswordAcrossSameLoginAndBank(item, dataBase.logins, dataBase.covenants);
        dataBase.logins = syncResult.updatedLogins;
        dataBase.covenants = syncResult.updatedCovenants;
      } else if (table === 'covenants' && item.login && item.bank && item.password !== undefined) {
        const syncResult = synchronizePasswordAcrossSameLoginAndBank({ username: item.login, bank: item.bank, password: item.password }, dataBase.logins, dataBase.covenants);
        dataBase.logins = syncResult.updatedLogins;
        dataBase.covenants = syncResult.updatedCovenants;
      }
    }

    const finalResult = {
      success: result?.success ?? true,
      database: result?.database || dataBase
    };
    res.json(finalResult);
  });

  // Delete Entity
  app.post("/api/delete", async (req, res) => {
    const { table, id } = req.body;
    const result = await useSheet("deleteItem", () => {
      const dbTable = (dataBase as any)[table];
      if (dbTable) {
        (dataBase as any)[table] = dbTable.filter((x: any) => x.id !== id);
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Tabela não encontrada" };
    }, { table, id });

    // Guarantee local memory sync
    const dbTable = (dataBase as any)[table];
    if (dbTable) {
      (dataBase as any)[table] = dbTable.filter((x: any) => x.id !== id);
    }

    const finalResult = {
      success: result?.success ?? true,
      database: result?.database || dataBase
    };
    res.json(finalResult);
  });

  // Toggle Favorite
  app.post("/api/favorite", async (req, res) => {
    const { systemId, userId } = req.body;
    const result = await useSheet("toggleFavorite", () => {
      const existingIndex = dataBase.favorites.findIndex(
        x => x.systemId === systemId && x.userId === userId
      );
      if (existingIndex > -1) {
        dataBase.favorites.splice(existingIndex, 1);
      } else {
        dataBase.favorites.push({ systemId, userId });
      }
      return { success: true, database: dataBase };
    }, { systemId, userId });
    res.json(result);
  });

  // Log Action to History
  app.post("/api/log", async (req, res) => {
    const log = req.body; // HistoryLog details
    const result = await useSheet("addLog", () => {
      dataBase.historyLogs.unshift(log);
      // Cap size at 500 records
      if (dataBase.historyLogs.length > 500) {
        dataBase.historyLogs = dataBase.historyLogs.slice(0, 500);
      }
      return { success: true, database: dataBase };
    }, { log });
    res.json(result);
  });

  // Login Reservation
  app.post("/api/reserve", async (req, res) => {
    const { loginId, username, timestamp } = req.body;
    const result = await useSheet("reserveLogin", () => {
      const login = dataBase.logins.find(x => x.id === loginId);
      if (login) {
        if (login.reservedBy) {
          return { success: false, error: "Este login já está reservado por outro usuário." };
        }
        login.reservedBy = username;
        login.reservedAt = timestamp;
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Login não encontrado" };
    }, { loginId, username, timestamp });
    res.json(result);
  });

  // Release Login
  app.post("/api/release", async (req, res) => {
    const { loginId, timestamp } = req.body;
    const result = await useSheet("releaseLogin", () => {
      const login = dataBase.logins.find(x => x.id === loginId);
      if (login) {
        if (!login.reservedBy) {
          return { success: false, error: "Este login não está reservado." };
        }
        
        // Calculate duration
        const startTime = login.reservedAt ? new Date(login.reservedAt).getTime() : new Date().getTime();
        const endTime = new Date(timestamp).getTime();
        const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
        
        const system = dataBase.systems.find(s => s.id === login.systemId);

        const reservationLog = {
          id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          loginId: login.id,
          loginUser: login.username,
          systemName: system ? system.name : "Sistema Desconhecido",
          reservedBy: login.reservedBy,
          reservedAt: login.reservedAt || timestamp,
          releasedAt: timestamp,
          durationSeconds: durationSeconds
        };

        dataBase.reservationLogs.unshift(reservationLog);
        
        login.reservedBy = undefined;
        login.reservedAt = undefined;
        
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Login não encontrado" };
    }, { loginId, timestamp });
    res.json(result);
  });

  // Batch Import Logins
  app.post("/api/import", async (req, res) => {
    const { logins: importedLogins, logs: histLogs } = req.body;
    const result = await useSheet("importLogins", () => {
      if (Array.isArray(importedLogins)) {
        importedLogins.forEach(item => {
          dataBase.logins.push(item);
        });
        if (Array.isArray(histLogs)) {
          histLogs.forEach(log => dataBase.historyLogs.unshift(log));
        }
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Lista de logins inválida" };
    }, { logins: importedLogins, logs: histLogs });
    res.json(result);
  });

  // Google Sheets Sync Route
  app.post("/api/sync-google-sheets", async (req, res) => {
    try {
      let { url } = req.body;
      if (!url) {
        url = dataBase.config.googleSheetsSyncUrl || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcMpLh93RfKdkQ6mGju40CgMTaz7RhBP7S_5LiNWF1BY0ZigqO8dpZpSh1gtx_oAiDtIyXX8Jc-gbC/pubhtml";
      }

      dataBase.config.googleSheetsSyncUrl = url;

      const csvUrl = transformGoogleSheetsUrl(url);
      console.log(`Fetching Google Sheets CSV from: ${csvUrl}`);
      
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Não foi possível acessar a planilha do Google. Status HTTP: ${response.status}`);
      }

      const csvText = await response.text();
      const lowerText = csvText.trim().toLowerCase();

      if (lowerText.startsWith('<!doctype') || lowerText.startsWith('<html') || csvText.includes('The page created')) {
        throw new Error('A planilha do Google Sheets não está publicada como CSV pública. No Google Sheets acesse: Arquivo > Compartilhar > Publicar na Web > Escolha "Valores separados por vírgula (.csv)" e clique em Publicar.');
      }

      const rows = parseCSV(csvText);
      if (!rows || rows.length === 0) {
        throw new Error('A planilha está vazia ou em formato incompatível.');
      }

      const { updatedDb, stats } = syncCsvRowsToDatabase(dataBase, rows);
      dataBase = updatedDb;

      res.json({
        success: true,
        database: dataBase,
        stats
      });
    } catch (error: any) {
      console.error("Error syncing Google Sheets:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Erro ao processar e sincronizar planilha do Google Sheets"
      });
    }
  });

  // Vite middleware for development (with fallback to production if dist directory exists)
  const hasDist = fs.existsSync(path.join(process.cwd(), "dist"));
  if (process.env.NODE_ENV !== "production" && !hasDist) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
