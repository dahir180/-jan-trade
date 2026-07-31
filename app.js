(() => {
  "use strict";

  const APP_VERSION = 4;
  const STORAGE_KEY = "janTrade.pro.v4";
  const LEGACY_KEYS = [
    "janTrade.pro.v3",
    "janTrade.pro.v1",
    "janTradeJournal.v1",
    "janTradeInlineV2",
    "jan-v8",
  ];
  const DB_NAME = "jan-trade";
  const DB_VERSION = 1;
  const STORE_NAME = "journal";
  const STATE_ID = "primary";

  const DEFAULT_LISTS = Object.freeze({
    symbols: ["XAUUSD", "NAS100", "US30", "GBPUSD", "EURUSD", "BTCUSD"],
    sessions: ["آسيا", "لندن", "نيويورك", "خارج الجلسات"],
    reasons: [
      "Order Block",
      "FVG",
      "Liquidity Sweep",
      "CISD",
      "SMT",
      "Breaker Block",
      "دعم / مقاومة",
      "أخرى",
    ],
    emotions: ["هادئ", "واثق", "متردد", "خائف", "FOMO", "انتقامي"],
    mistakes: [
      "دخول مبكر",
      "دخول متأخر",
      "وقف ضيق",
      "حجم كبير",
      "FOMO",
      "انتقام",
      "تحريك SL",
      "تحريك TP",
      "تجاوز الهدف",
      "عدم التحليل",
      "الملل",
      "الخوف من الفرصة",
    ],
    confluences: [
      "Liquidity Sweep",
      "SMT",
      "CISD",
      "Order Block",
      "FVG / IFVG",
      "PDH / PDL",
      "Session H/L",
      "EMA 9/20",
      "VWAP",
      "Volume",
    ],
    timeframes: ["M1", "M3", "M5", "M15", "M30", "H1", "H4"],
  });

  const ACCOUNT_PHASES = {
    "evaluation-1": "التقييم 1",
    "evaluation-2": "التقييم 2",
    funded: "Funded / Master",
    personal: "شخصي",
  };

  const ACCOUNT_STATUSES = {
    active: "نشط",
    paused: "متوقف",
    passed: "مجتاز",
    failed: "منتهي",
    archived: "مؤرشف",
  };

  const PAGE_META = {
    dashboard: ["لوحة الأداء", "قرارات أوضح. تداول منضبط."],
    trades: ["سجل الصفقات", "راجع كل تنفيذ بالتفصيل."],
    calendar: ["تقويم الأداء", "شاهد أيام القوة والضعف."],
    analytics: ["التحليلات المتقدمة", "اكتشف أين توجد ميزتك الحقيقية."],
    playbooks: ["الاستراتيجيات", "قواعد قابلة للقياس، لا انطباعات."],
    settings: ["الإعدادات", "الحسابات والمخاطر والقوائم والنسخ الاحتياطي."],
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const asNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((asNumber(value) + Number.EPSILON) * factor) / factor;
  };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const uid = () =>
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  const escapeHtml = (value = "") =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  function localDateTime(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function todayKey() {
    return localDateTime().slice(0, 10);
  }

  function dateKey(trade) {
    return String(trade.date || "").slice(0, 10);
  }

  function tradeTimestamp(trade) {
    const value = trade.closeDate || trade.date;
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function uniqueList(values, fallback = []) {
    const source = Array.isArray(values)
      ? values
      : String(values || "")
          .split(/[\n,،]+/)
          .map((item) => item.trim());
    const clean = source
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return [...new Set(clean.length ? clean : fallback)];
  }

  function seedState() {
    return {
      version: APP_VERSION,
      accounts: [
        {
          id: "main",
          name: "الحساب الرئيسي",
          company: "",
          balance: 10_000,
          phase: "evaluation-1",
          status: "active",
          targetPct: 8,
          dailyLossPct: 4,
          totalLossPct: 8,
          personalDailyStopPct: 1,
          defaultRiskPct: 0.5,
          maxTradesPerDay: 2,
          maxLossesPerDay: 2,
          maxRiskPct: 0,
          drawdownMode: "static",
          dailyLossMode: "initial",
          dayResetHour: 0,
          consistencyPct: 0,
          minTradingDays: 0,
          copyGroup: "",
          blockNyAfterAsiaLoss: false,
          color: "#38bdf8",
          emoji: "📊",
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
      playbooks: [
        {
          id: "pb-a",
          name: "A+ Liquidity Setup",
          market: "XAUUSD / NAS100",
          entry: "Liquidity Sweep + SMT + CISD عند OB/FVG أو Session H/L",
          checklist: [
            "السياق واضح على H1 أو H4",
            "تم سحب سيولة واضحة",
            "ظهر تأكيد الدخول على فريم التنفيذ",
            "العائد المتوقع يبرر المخاطرة",
          ],
          exit: "SL خلف آخر Swing، والهدف 2R–3R دون تحريك عشوائي",
          risk: "0.3%–0.5% لكل صفقة، والتوقف بعد حد الخسارة اليومي",
          active: true,
          createdAt: new Date().toISOString(),
        },
      ],
      trades: [],
      settings: {
        currency: "USD",
        defaultAccountId: "main",
        defaultSession: "نيويورك",
        copyMode: "percent",
        density: "comfortable",
        accent: "#38bdf8",
        showMoney: true,
        showPercent: true,
        confirmDeletes: true,
        guardrailBlock: false,
        dashboardRange: "all",
        lists: clone(DEFAULT_LISTS),
      },
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        migratedFrom: null,
      },
    };
  }

  function normalizeAccount(account, index = 0) {
    const source = account || {};
    const phase = Object.hasOwn(ACCOUNT_PHASES, source.phase)
      ? source.phase
      : "evaluation-1";
    const status = Object.hasOwn(ACCOUNT_STATUSES, source.status)
      ? source.status
      : "active";
    const balance = Math.max(
      1,
      asNumber(source.balance ?? source.size, index === 0 ? 10_000 : 10_000),
    );
    return {
      id: String(source.id || uid()),
      name: String(source.name || source.label || `حساب ${index + 1}`).trim(),
      company: String(source.company || "").trim(),
      balance,
      phase,
      status,
      targetPct: Math.max(0, asNumber(source.targetPct ?? source.p1, 8)),
      dailyLossPct: Math.max(
        0,
        asNumber(source.dailyLossPct ?? source.cDaily, 4),
      ),
      totalLossPct: Math.max(
        0,
        asNumber(source.totalLossPct ?? source.cTotal, 8),
      ),
      personalDailyStopPct: Math.max(
        0,
        asNumber(source.personalDailyStopPct ?? source.ourDaily, 1),
      ),
      defaultRiskPct: Math.max(
        0,
        asNumber(source.defaultRiskPct ?? source.riskPct, 0.5),
      ),
      maxTradesPerDay: Math.max(
        0,
        Math.trunc(asNumber(source.maxTradesPerDay, 2)),
      ),
      maxLossesPerDay: Math.max(
        0,
        Math.trunc(asNumber(source.maxLossesPerDay, 2)),
      ),
      maxRiskPct: Math.max(
        0,
        asNumber(source.maxRiskPct ?? source.maxRiskPerTradePct, 0),
      ),
      drawdownMode: source.drawdownMode === "trailing" ? "trailing" : "static",
      dailyLossMode:
        source.dailyLossMode === "day-start" ? "day-start" : "initial",
      dayResetHour: clamp(Math.trunc(asNumber(source.dayResetHour, 0)), 0, 23),
      consistencyPct: clamp(asNumber(source.consistencyPct, 0), 0, 100),
      minTradingDays: Math.max(
        0,
        Math.trunc(asNumber(source.minTradingDays, 0)),
      ),
      copyGroup: String(source.copyGroup || "").trim(),
      blockNyAfterAsiaLoss: Boolean(source.blockNyAfterAsiaLoss),
      color: /^#[0-9a-f]{6}$/i.test(source.color || "")
        ? source.color
        : ["#38bdf8", "#818cf8", "#a855f7", "#f59e0b", "#ec4899"][index % 5],
      emoji: String(source.emoji || "💼").slice(0, 4),
      enabled: source.enabled !== false,
      createdAt: source.createdAt || new Date().toISOString(),
    };
  }

  function normalizePlaybook(playbook) {
    const source = playbook || {};
    return {
      id: String(source.id || uid()),
      name: String(source.name || "استراتيجية").trim(),
      market: String(source.market || "").trim(),
      entry: String(source.entry ?? source.entryConditions ?? "").trim(),
      checklist: uniqueList(source.checklist || [], []),
      exit: String(source.exit ?? source.exitRules ?? "").trim(),
      risk: String(source.risk ?? source.riskRules ?? "").trim(),
      active: source.active !== false,
      createdAt: source.createdAt || new Date().toISOString(),
    };
  }

  function sessionName(value) {
    const map = {
      asia: "آسيا",
      london: "لندن",
      newyork: "نيويورك",
      other: "خارج الجلسات",
    };
    return map[value] || value || "نيويورك";
  }

  function normalizeRules(value) {
    const map = {
      نعم: "yes",
      جزئياً: "partial",
      جزئيًا: "partial",
      لا: "no",
      yes: "yes",
      partial: "partial",
      no: "no",
    };
    return map[value] || "yes";
  }

  function calculateTradeValues(trade, account) {
    const balance = Math.max(1, asNumber(account?.balance, 1));
    const mode = ["r", "money", "percent"].includes(trade.resultMode)
      ? trade.resultMode
      : "r";
    const fees = Math.max(0, asNumber(trade.fees));
    const swap = asNumber(trade.swap);
    const riskAmount = Math.max(0, asNumber(trade.riskAmount));
    let grossPnl = asNumber(trade.grossPnl);
    let netPnl = asNumber(trade.netPnl);
    let pnlPct = asNumber(trade.pnlPct);
    let resultR = asNumber(trade.resultR);

    if (mode === "r") {
      grossPnl = riskAmount * resultR;
      netPnl = grossPnl - fees - swap;
      pnlPct = (netPnl / balance) * 100;
    } else if (mode === "money") {
      netPnl = grossPnl - fees - swap;
      pnlPct = (netPnl / balance) * 100;
      resultR = riskAmount > 0 ? netPnl / riskAmount : resultR;
    } else {
      netPnl = (balance * pnlPct) / 100;
      grossPnl = netPnl + fees + swap;
      resultR = riskAmount > 0 ? netPnl / riskAmount : resultR;
    }

    const riskPct =
      riskAmount > 0 ? (riskAmount / balance) * 100 : asNumber(trade.riskPct);

    return {
      resultMode: mode,
      riskAmount: round(riskAmount, 2),
      riskPct: round(riskPct, 4),
      resultR: round(resultR, 4),
      grossPnl: round(grossPnl, 2),
      fees: round(fees, 2),
      swap: round(swap, 2),
      netPnl: round(netPnl, 2),
      pnlPct: round(pnlPct, 4),
    };
  }

  function normalizeTrade(trade, accounts, sourceType = "current") {
    const source = trade || {};
    const accountId = String(source.accountId || accounts[0]?.id || "main");
    const account = accounts.find((item) => item.id === accountId) ||
      accounts[0] || { balance: 1 };
    const attachedPnl =
      sourceType === "attached" ||
      ("pnl" in source && !("riskAmount" in source));
    let base;

    if (attachedPnl) {
      const pnlPct = asNumber(source.pnl);
      const riskAmount = Math.max(0, asNumber(source.riskUSD));
      base = {
        resultMode: "percent",
        pnlPct,
        riskAmount,
        riskPct: riskAmount ? (riskAmount / account.balance) * 100 : 0,
        resultR: riskAmount
          ? (account.balance * (pnlPct / 100)) / riskAmount
          : 0,
        fees: Math.max(0, asNumber(source.commission)),
        swap: 0,
      };
    } else {
      base = {
        resultMode:
          source.resultMode ||
          (Number.isFinite(Number(source.netPnl)) ? "money" : "r"),
        riskAmount: asNumber(
          source.riskAmount ?? source.riskUSD ?? source.risk,
        ),
        riskPct: asNumber(source.riskPct),
        resultR: asNumber(source.resultR ?? source.r),
        grossPnl:
          source.grossPnl ??
          (Number.isFinite(Number(source.netPnl))
            ? asNumber(source.netPnl) +
              Math.max(0, asNumber(source.fees)) +
              asNumber(source.swap)
            : undefined),
        fees: Math.max(0, asNumber(source.fees ?? source.commission)),
        swap: asNumber(source.swap),
        netPnl: source.netPnl,
        pnlPct: source.pnlPct,
      };
    }

    const values = calculateTradeValues(base, account);
    const rawDate =
      source.date && source.time && !String(source.date).includes("T")
        ? `${source.date}T${source.time}`
        : source.date;

    return {
      id: String(source.id || uid()),
      batchId: source.batchId || source.copiedBatchId || "",
      copiedFrom: source.copiedFrom || "",
      accountId,
      date: String(rawDate || localDateTime()),
      closeDate: String(source.closeDate || ""),
      symbol: String(source.symbol || source.pair || "")
        .trim()
        .toUpperCase(),
      direction: ["sell", "short", "بيع"].includes(
        String(source.direction || "").toLowerCase(),
      )
        ? "short"
        : "long",
      session: sessionName(source.session),
      timeframe: String(source.timeframe || "M5"),
      source: String(source.source || "manual"),
      setupId: String(source.setupId || source.strategyId || ""),
      reason: String(source.reason || source.strategy || "").trim(),
      entry: source.entry ?? source.entryPrice ?? null,
      stop: source.stop ?? source.stopLoss ?? null,
      target: source.target ?? source.takeProfit ?? null,
      exit: source.exit ?? source.exitPrice ?? null,
      size: source.size ?? source.lotSize ?? null,
      ...values,
      grade: String(source.grade || source.quality || "A"),
      emotion: String(source.emotion || source.psy || "هادئ"),
      rulesFollowed: normalizeRules(
        source.rulesFollowed ?? source.compliance ?? "yes",
      ),
      exitReason: String(source.exitReason || "other"),
      mistakes: uniqueList(source.mistakes ?? source.tags ?? [], []),
      confluences: uniqueList(source.confluences || [], []),
      notes: String(source.notes || "").trim(),
      lesson: String(source.lesson || "").trim(),
      screenshot: String(source.screenshot || ""),
      maeR:
        source.maeR == null || source.maeR === ""
          ? null
          : asNumber(source.maeR, null),
      mfeR:
        source.mfeR == null || source.mfeR === ""
          ? null
          : asNumber(source.mfeR, null),
      externalId: String(source.externalId || ""),
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString(),
    };
  }

  function mergeSettings(settings, accounts) {
    const defaults = seedState().settings;
    const source = settings || {};
    const lists = source.lists || {};
    const merged = {
      ...defaults,
      ...source,
      lists: {},
    };
    for (const [key, fallback] of Object.entries(DEFAULT_LISTS)) {
      merged.lists[key] = uniqueList(lists[key], fallback);
    }
    if (
      !accounts.some(
        (account) => account.id === merged.defaultAccountId && account.enabled,
      )
    ) {
      merged.defaultAccountId =
        accounts.find((account) => account.enabled)?.id ||
        accounts[0]?.id ||
        "";
    }
    if (!merged.lists.sessions.includes(merged.defaultSession)) {
      merged.defaultSession = merged.lists.sessions[0] || "نيويورك";
    }
    if (!/^#[0-9a-f]{6}$/i.test(merged.accent || "")) {
      merged.accent = defaults.accent;
    }
    if (!["USD", "GBP", "EUR"].includes(merged.currency)) {
      merged.currency = defaults.currency;
    }
    if (!["percent", "exact"].includes(merged.copyMode)) {
      merged.copyMode = defaults.copyMode;
    }
    if (!["comfortable", "compact"].includes(merged.density)) {
      merged.density = defaults.density;
    }
    if (!["all", "90", "30", "7"].includes(String(merged.dashboardRange))) {
      merged.dashboardRange = defaults.dashboardRange;
    }
    merged.showMoney = merged.showMoney !== false;
    merged.showPercent = merged.showPercent !== false;
    merged.confirmDeletes = merged.confirmDeletes !== false;
    merged.guardrailBlock = Boolean(merged.guardrailBlock);
    return merged;
  }

  function migrateState(raw) {
    if (!raw || typeof raw !== "object") return seedState();
    if (Array.isArray(raw)) {
      raw = {
        trades: raw,
        accounts: seedState().accounts,
        playbooks: seedState().playbooks,
        _legacySource: "janTradeInlineV2",
      };
    }

    const attachedShape =
      Array.isArray(raw.strats) ||
      raw.accounts?.some(
        (account) => "label" in account || "cDaily" in account,
      );
    const legacyShape =
      raw.version !== APP_VERSION &&
      Array.isArray(raw.playbooks) &&
      raw.accounts?.some(
        (account) => "balance" in account && !("targetPct" in account),
      );

    const fallbackAccounts = seedState().accounts;
    if (
      raw.settings &&
      Number.isFinite(Number(raw.settings.initialBalance)) &&
      !Array.isArray(raw.accounts)
    ) {
      fallbackAccounts[0].balance = Math.max(
        1,
        asNumber(raw.settings.initialBalance, 10_000),
      );
    }
    let accounts = Array.isArray(raw.accounts)
      ? raw.accounts.map(normalizeAccount)
      : fallbackAccounts;
    if (!accounts.length) accounts = seedState().accounts;

    const playbookSource = raw.playbooks || raw.strats || [];
    const playbooks = Array.isArray(playbookSource)
      ? playbookSource.map(normalizePlaybook)
      : [];
    const sourceType = attachedShape
      ? "attached"
      : legacyShape
        ? "legacy"
        : "current";
    const trades = Array.isArray(raw.trades)
      ? raw.trades.map((trade) => normalizeTrade(trade, accounts, sourceType))
      : [];

    return {
      version: APP_VERSION,
      accounts,
      playbooks: playbooks.length ? playbooks : seedState().playbooks,
      trades,
      settings: mergeSettings(raw.settings, accounts),
      meta: {
        createdAt: raw.meta?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        migratedFrom:
          raw.version === APP_VERSION
            ? raw.meta?.migratedFrom || null
            : raw._legacySource ||
              (attachedShape
                ? "trading-tracker.tsx"
                : legacyShape
                  ? "janTrade.pro.v1"
                  : raw.version || "legacy"),
      },
    };
  }

  let state = seedState();
  let calendarDate = new Date();
  let chartRange = "all";
  let deferredInstallPrompt = null;
  let currentImage = "";
  let selectedMistakes = new Set();
  let selectedConfluences = new Set();
  let saveQueue = Promise.resolve(true);
  let storageMode = "IndexedDB";
  let lastDeletedTrade = null;
  let serviceWorkerRegistration = null;
  let pendingMt5Import = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Database error"));
    });
  }

  async function databaseGet() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_ID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }

  async function databasePut(value) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, STATE_ID);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  function withoutImages(value) {
    const copy = clone(value);
    copy.trades.forEach((trade) => {
      if (trade.screenshot) trade.screenshot = "";
    });
    return copy;
  }

  async function loadState() {
    let databaseState = null;
    let localState = null;
    try {
      databaseState = await databaseGet();
      storageMode = "IndexedDB";
    } catch {
      storageMode = "localStorage";
    }

    try {
      localState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      localState = null;
    }

    const freshness = (candidate) => {
      const timestamp = new Date(
        candidate?.meta?.updatedAt ||
          candidate?.updatedAt ||
          candidate?.meta?.createdAt ||
          0,
      ).getTime();
      return Number.isFinite(timestamp) ? timestamp : 0;
    };
    let raw =
      localState &&
      (!databaseState ||
        freshness(localState) > freshness(databaseState) ||
        (freshness(localState) === freshness(databaseState) &&
          asNumber(localState.version) > asNumber(databaseState.version)))
        ? localState
        : databaseState;

    if (!raw) {
      for (const key of LEGACY_KEYS) {
        try {
          const candidate = JSON.parse(localStorage.getItem(key) || "null");
          if (candidate) {
            raw = Array.isArray(candidate)
              ? { trades: candidate, _legacySource: key }
              : { ...candidate, _legacySource: key };
          }
        } catch {
          raw = null;
        }
        if (raw) break;
      }
    }

    state = migrateState(raw);
    chartRange = state.settings.dashboardRange || "all";
    await persistState({ quiet: true });
  }

  async function persistState({ quiet = false } = {}) {
    state.version = APP_VERSION;
    state.meta.updatedAt = new Date().toISOString();
    const snapshot = clone(state);
    const write = async () => {
      let saved = false;
      try {
        await databasePut(snapshot);
        storageMode = "IndexedDB";
        saved = true;
      } catch {
        storageMode = "localStorage";
      }

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(withoutImages(snapshot)),
        );
        saved = true;
      } catch {
        if (!saved && !quiet) {
          toast("تعذر الحفظ: مساحة المتصفح ممتلئة.", "error");
        }
      }
      updateStorageStatus();
      return saved;
    };
    saveQueue = saveQueue.then(write, write);
    return saveQueue;
  }

  function accountById(id) {
    return state.accounts.find((account) => account.id === String(id));
  }

  function playbookById(id) {
    return state.playbooks.find((playbook) => playbook.id === String(id));
  }

  function tradeNet(trade) {
    if (Number.isFinite(Number(trade.netPnl))) return asNumber(trade.netPnl);
    return calculateTradeValues(trade, accountById(trade.accountId)).netPnl;
  }

  function tradePct(trade) {
    if (Number.isFinite(Number(trade.pnlPct))) return asNumber(trade.pnlPct);
    const account = accountById(trade.accountId);
    return account?.balance ? (tradeNet(trade) / account.balance) * 100 : 0;
  }

  function tradeResultR(trade) {
    if (Number.isFinite(Number(trade.resultR))) return asNumber(trade.resultR);
    return trade.riskAmount ? tradeNet(trade) / asNumber(trade.riskAmount) : 0;
  }

  function accountCapital(includedAccountIds) {
    return [...new Set(includedAccountIds)].reduce(
      (sum, accountId) => sum + asNumber(accountById(accountId)?.balance),
      0,
    );
  }

  function portfolioPct(trades, includedAccountIds = null) {
    const accountIds = new Set(
      includedAccountIds || trades.map((trade) => trade.accountId),
    );
    const capital = accountCapital(accountIds);
    const net = trades.reduce((sum, trade) => sum + tradeNet(trade), 0);
    return capital ? (net / capital) * 100 : 0;
  }

  function selectedAccountIds() {
    const selected = $("#accountFilter")?.value || "all";
    return selected === "all"
      ? state.accounts.map((account) => account.id)
      : [selected];
  }

  function selectedTrades() {
    const ids = new Set(selectedAccountIds());
    return state.trades.filter((trade) => ids.has(trade.accountId));
  }

  function analyticsTrades() {
    const from = $("#analyticsFrom")?.value || "";
    const to = $("#analyticsTo")?.value || "";
    return selectedTrades().filter((trade) => {
      const key = dateKey(trade);
      return (!from || key >= from) && (!to || key <= to);
    });
  }

  function metrics(list = selectedTrades()) {
    const trades = [...list].sort(
      (a, b) => tradeTimestamp(a) - tradeTimestamp(b),
    );
    const moneyResults = trades.map(tradeNet);
    const rResults = trades
      .filter((trade) => asNumber(trade.riskAmount) > 0)
      .map(tradeResultR);
    const wins = trades.filter((trade) => tradeNet(trade) > 0);
    const losses = trades.filter((trade) => tradeNet(trade) < 0);
    const breakeven = trades.filter((trade) => tradeNet(trade) === 0);
    const grossWin = wins.reduce((sum, trade) => sum + tradeNet(trade), 0);
    const grossLoss = Math.abs(
      losses.reduce((sum, trade) => sum + tradeNet(trade), 0),
    );
    const net = moneyResults.reduce((sum, value) => sum + value, 0);

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let winStreak = 0;
    let lossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    const curve = [0];

    for (const result of moneyResults) {
      equity += result;
      curve.push(equity);
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      if (result > 0) {
        winStreak += 1;
        lossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, winStreak);
      } else if (result < 0) {
        lossStreak += 1;
        winStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, lossStreak);
      }
    }

    const ruleScore = trades.reduce(
      (sum, trade) =>
        sum +
        (trade.rulesFollowed === "yes"
          ? 1
          : trade.rulesFollowed === "partial"
            ? 0.5
            : 0),
      0,
    );
    const averageR = rResults.length
      ? rResults.reduce((sum, value) => sum + value, 0) / rResults.length
      : 0;
    const rVariance = rResults.length
      ? rResults.reduce((sum, value) => sum + (value - averageR) ** 2, 0) /
        rResults.length
      : 0;
    const rDeviation = Math.sqrt(rVariance);
    const durations = trades
      .map((trade) => {
        if (!trade.closeDate || !trade.date) return null;
        const minutes =
          (new Date(trade.closeDate).getTime() -
            new Date(trade.date).getTime()) /
          60_000;
        return minutes >= 0 && Number.isFinite(minutes) ? minutes : null;
      })
      .filter((value) => value !== null);

    return {
      trades,
      wins,
      losses,
      breakeven,
      grossWin,
      grossLoss,
      net,
      curve,
      maxDrawdown,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0,
      averageR,
      rCount: rResults.length,
      expectancy: trades.length ? net / trades.length : 0,
      expectancyR: trades.length ? averageR : 0,
      averageWin: wins.length ? grossWin / wins.length : 0,
      averageLoss: losses.length ? -grossLoss / losses.length : 0,
      payoff:
        wins.length && losses.length
          ? grossWin / wins.length / (grossLoss / losses.length)
          : 0,
      best: moneyResults.length ? Math.max(...moneyResults) : 0,
      worst: moneyResults.length ? Math.min(...moneyResults) : 0,
      maxWinStreak,
      maxLossStreak,
      discipline: trades.length ? (ruleScore / trades.length) * 100 : 0,
      sqn:
        rResults.length > 1 && rDeviation
          ? (Math.sqrt(rResults.length) * averageR) / rDeviation
          : 0,
      recoveryFactor: maxDrawdown ? net / maxDrawdown : net > 0 ? Infinity : 0,
      averageDuration: durations.length
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : 0,
    };
  }

  function groupByDay(trades) {
    const grouped = {};
    for (const trade of trades) {
      const key = dateKey(trade);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(trade);
    }
    return grouped;
  }

  function shiftedDateKey(value, resetHour = 0) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      return String(value || "").slice(0, 10);
    date.setHours(date.getHours() - clamp(asNumber(resetHour), 0, 23));
    return localDateTime(date).slice(0, 10);
  }

  function accountDateKey(trade, account) {
    return shiftedDateKey(
      trade.closeDate || trade.date,
      account?.dayResetHour || 0,
    );
  }

  function accountHealth(account) {
    const trades = state.trades
      .filter((trade) => trade.accountId === account.id)
      .sort((a, b) => tradeTimestamp(a) - tradeTimestamp(b));
    const net = trades.reduce((sum, trade) => sum + tradeNet(trade), 0);
    const currentBalance = account.balance + net;
    const totalPct = (net / account.balance) * 100;
    const byDay = {};
    for (const trade of trades) {
      const key = accountDateKey(trade, account);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(trade);
    }
    const accountToday = shiftedDateKey(new Date(), account.dayResetHour);
    const todayTrades = byDay[accountToday] || [];
    const todayNet = todayTrades.reduce(
      (sum, trade) => sum + tradeNet(trade),
      0,
    );
    const todayPct = (todayNet / account.balance) * 100;

    let runningBalance = account.balance;
    let highBalance = account.balance;
    for (const trade of trades) {
      runningBalance += tradeNet(trade);
      highBalance = Math.max(highBalance, runningBalance);
    }

    const lossAllowance = (account.balance * account.totalLossPct) / 100;
    const floor =
      account.drawdownMode === "trailing"
        ? highBalance - lossAllowance
        : account.balance - lossAllowance;
    const remainingTotal = currentBalance - floor;
    const priorNet = trades
      .filter((trade) => accountDateKey(trade, account) < accountToday)
      .reduce((sum, trade) => sum + tradeNet(trade), 0);
    const dayStartBalance = account.balance + priorNet;
    const dailyLossBase =
      account.dailyLossMode === "day-start"
        ? Math.max(0, dayStartBalance)
        : account.balance;
    const dailyAllowance = (dailyLossBase * account.dailyLossPct) / 100;
    const personalAllowance =
      (account.balance * account.personalDailyStopPct) / 100;
    const dailyRemaining = dailyAllowance + Math.min(0, todayNet);
    const personalRemaining = personalAllowance + Math.min(0, todayNet);
    const todayLosses = todayTrades.filter(
      (trade) => tradeNet(trade) < 0,
    ).length;
    const tradingDays = Object.keys(byDay).filter(
      (day) => byDay[day].length,
    ).length;
    const dayResults = Object.values(byDay).map((dayTrades) =>
      dayTrades.reduce((sum, trade) => sum + tradeNet(trade), 0),
    );
    const bestDay = dayResults.length ? Math.max(0, ...dayResults) : 0;
    const consistency = net > 0 ? (bestDay / net) * 100 : 0;
    const violations = [];

    let netBeforeDay = 0;
    for (const [day, dayTrades] of Object.entries(byDay).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const dayLosses = dayTrades.filter((trade) => tradeNet(trade) < 0).length;
      const dayNet = dayTrades.reduce((sum, trade) => sum + tradeNet(trade), 0);
      const companyDailyBase =
        account.dailyLossMode === "day-start"
          ? Math.max(0, account.balance + netBeforeDay)
          : account.balance;
      if (
        account.maxTradesPerDay > 0 &&
        dayTrades.length > account.maxTradesPerDay
      ) {
        violations.push(`${day}: تجاوز عدد الصفقات`);
      }
      if (account.maxLossesPerDay > 0 && dayLosses > account.maxLossesPerDay) {
        violations.push(`${day}: تجاوز عدد الخسائر`);
      }
      if (
        account.personalDailyStopPct > 0 &&
        dayNet <= -(account.balance * account.personalDailyStopPct) / 100
      ) {
        violations.push(`${day}: تجاوز الحد الشخصي`);
      }
      if (
        account.dailyLossPct > 0 &&
        dayNet <= -(companyDailyBase * account.dailyLossPct) / 100
      ) {
        violations.push(`${day}: تجاوز الحد اليومي للشركة`);
      }
      if (
        account.maxRiskPct > 0 &&
        dayTrades.some((trade) => trade.riskPct > account.maxRiskPct)
      ) {
        violations.push(`${day}: تجاوز مخاطرة الصفقة`);
      }
      if (account.blockNyAfterAsiaLoss) {
        const asiaLoss = dayTrades.some(
          (trade) => trade.session.includes("آسيا") && tradeNet(trade) < 0,
        );
        const newYorkTrade = dayTrades.some((trade) =>
          trade.session.includes("نيويورك"),
        );
        if (asiaLoss && newYorkTrade) {
          violations.push(`${day}: نيويورك بعد خسارة آسيا`);
        }
      }
      netBeforeDay += dayNet;
    }
    if (remainingTotal <= 0) {
      violations.push("تجاوز حد الخسارة الكلي");
    }
    if (
      account.consistencyPct > 0 &&
      net > 0 &&
      consistency > account.consistencyPct
    ) {
      violations.push(
        `الاتساق ${consistency.toFixed(1)}% أعلى من ${account.consistencyPct}%`,
      );
    }

    let status = { tone: "good", label: "جاهز" };
    if (account.status !== "active") {
      status = {
        tone: account.status === "passed" ? "good" : "warn",
        label: ACCOUNT_STATUSES[account.status] || account.status,
      };
    } else if (remainingTotal <= 0 || dailyRemaining <= 0) {
      status = { tone: "bad", label: "حد الشركة" };
    } else if (
      personalRemaining <= 0 ||
      (account.maxTradesPerDay > 0 &&
        todayTrades.length >= account.maxTradesPerDay) ||
      (account.maxLossesPerDay > 0 && todayLosses >= account.maxLossesPerDay)
    ) {
      status = { tone: "bad", label: "توقف اليوم" };
    } else if (todayTrades.length) {
      status = { tone: "warn", label: "نشط اليوم" };
    }

    return {
      trades,
      net,
      currentBalance,
      totalPct,
      todayTrades,
      todayNet,
      todayPct,
      todayLosses,
      highBalance,
      floor,
      remainingTotal,
      dailyRemaining,
      personalRemaining,
      dayStartBalance,
      tradingDays,
      bestDay,
      consistency,
      targetProgress: account.targetPct
        ? clamp((totalPct / account.targetPct) * 100, 0, 100)
        : 0,
      violations,
      status,
    };
  }

  function currencySymbol() {
    return { USD: "$", GBP: "£", EUR: "€" }[state.settings.currency] || "$";
  }

  function formatMoney(value, compact = false) {
    const options = {
      style: "currency",
      currency: state.settings.currency || "USD",
      maximumFractionDigits: compact ? 0 : 2,
      minimumFractionDigits: compact ? 0 : 2,
      notation: compact && Math.abs(value) >= 100_000 ? "compact" : "standard",
    };
    try {
      return new Intl.NumberFormat("en-GB", options).format(asNumber(value));
    } catch {
      return `${currencySymbol()}${round(value, compact ? 0 : 2)}`;
    }
  }

  function formatPercent(value, digits = 2) {
    const number = asNumber(value);
    return `${number > 0 ? "+" : ""}${number.toFixed(digits)}%`;
  }

  function formatDuration(minutes) {
    const value = Math.max(0, Math.round(asNumber(minutes)));
    if (!value) return "—";
    if (value < 60) return `${value} د`;
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${hours}س ${rest}د` : `${hours}س`;
  }

  function resultTone(value) {
    return value > 0 ? "good" : value < 0 ? "bad" : "";
  }

  function resultText(trade) {
    const parts = [];
    if (state.settings.showMoney) parts.push(formatMoney(tradeNet(trade)));
    if (state.settings.showPercent) parts.push(formatPercent(tradePct(trade)));
    return parts.join(" · ") || formatMoney(tradeNet(trade));
  }

  function stat(label, value, tone = "", sub = "") {
    return `<article class="stat">
      <div class="stat-label"><span>${escapeHtml(label)}</span></div>
      <div class="stat-value ${tone}">${escapeHtml(value)}</div>
      ${sub ? `<div class="stat-sub">${escapeHtml(sub)}</div>` : ""}
    </article>`;
  }

  function toast(message, type = "success", options = {}) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.toggle("error", type === "error");
    element.classList.add("show");
    element.onclick = options.onClick || null;
    element.style.pointerEvents = options.onClick ? "auto" : "none";
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      element.classList.remove("show");
      element.onclick = null;
      element.style.pointerEvents = "none";
    }, options.duration || 2800);
  }

  function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return match
      ? `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(
          match[3],
          16,
        )}`
      : "56, 189, 248";
  }

  function applyPreferences() {
    document.documentElement.style.setProperty(
      "--accent",
      state.settings.accent,
    );
    document.documentElement.style.setProperty(
      "--accent-rgb",
      hexToRgb(state.settings.accent),
    );
    document.body.classList.toggle(
      "density-compact",
      state.settings.density === "compact",
    );
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = "#07111f";
  }

  function updateStorageStatus() {
    const status = $("#storageStatus");
    if (status) status.textContent = `محفوظ · ${storageMode}`;
  }

  function fillSelect(
    element,
    values,
    { value = null, placeholder = null, map = null } = {},
  ) {
    if (!element) return;
    const current = value ?? element.value;
    const options = [];
    if (placeholder) {
      options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
    }
    for (const item of values) {
      const optionValue = map ? map(item).value : item;
      const optionLabel = map ? map(item).label : item;
      options.push(
        `<option value="${escapeHtml(optionValue)}">${escapeHtml(optionLabel)}</option>`,
      );
    }
    element.innerHTML = options.join("");
    if (
      [...element.options].some((option) => option.value === String(current))
    ) {
      element.value = current;
    }
  }

  function ensureSelectValue(element, value, label = value) {
    const wanted = String(value || "");
    if (!wanted) return;
    if (![...element.options].some((option) => option.value === wanted)) {
      const option = document.createElement("option");
      option.value = wanted;
      option.textContent = label;
      element.append(option);
    }
    element.value = wanted;
  }

  function fillSelects() {
    const activeAccounts = state.accounts.filter((account) => account.enabled);
    const allAccounts = state.accounts;
    const accountFilter = $("#accountFilter");
    const currentFilter = accountFilter.value || "all";
    accountFilter.innerHTML =
      '<option value="all">كل الحسابات</option>' +
      allAccounts
        .map(
          (account) =>
            `<option value="${escapeHtml(account.id)}">${escapeHtml(
              `${account.emoji} ${account.name}${
                account.enabled ? "" : " · غير نشط"
              }`,
            )}</option>`,
        )
        .join("");
    accountFilter.value = [...accountFilter.options].some(
      (option) => option.value === currentFilter,
    )
      ? currentFilter
      : "all";

    const tradeAccountOptions = allAccounts.map((account) => ({
      value: account.id,
      label: `${account.emoji} ${account.name}${
        account.enabled ? "" : " · غير نشط"
      }`,
    }));
    const defaultAccountOptions = activeAccounts.map((account) => ({
      value: account.id,
      label: `${account.emoji} ${account.name}`,
    }));
    fillSelect($("#tradeAccount"), tradeAccountOptions, {
      map: (item) => item,
    });
    fillSelect($("#prefDefaultAccount"), defaultAccountOptions, {
      value: state.settings.defaultAccountId,
      map: (item) => item,
    });

    const playbookCurrent = $("#setup").value;
    $("#setup").innerHTML =
      '<option value="">بدون استراتيجية</option>' +
      state.playbooks
        .filter((playbook) => playbook.active)
        .map(
          (playbook) =>
            `<option value="${escapeHtml(playbook.id)}">${escapeHtml(
              playbook.name,
            )}</option>`,
        )
        .join("");
    if (
      [...$("#setup").options].some(
        (option) => option.value === playbookCurrent,
      )
    ) {
      $("#setup").value = playbookCurrent;
    }

    fillSelect($("#session"), state.settings.lists.sessions);
    fillSelect($("#sessionFilter"), state.settings.lists.sessions, {
      placeholder: "كل الجلسات",
    });
    $("#sessionFilter").firstElementChild.value = "all";
    fillSelect($("#prefDefaultSession"), state.settings.lists.sessions, {
      value: state.settings.defaultSession,
    });
    fillSelect($("#reason"), state.settings.lists.reasons);
    fillSelect($("#emotion"), state.settings.lists.emotions);
    fillSelect($("#timeframe"), state.settings.lists.timeframes);
    $("#symbols").innerHTML = state.settings.lists.symbols
      .map((symbol) => `<option value="${escapeHtml(symbol)}"></option>`)
      .join("");
  }

  function render() {
    fillSelects();
    renderDashboard();
    renderTrades();
    renderCalendar();
    renderAnalytics();
    renderPlaybooks();
    renderSettings();
  }

  function renderDashboard() {
    const list = selectedTrades();
    const summary = metrics(list);
    const selectedIds = selectedAccountIds();
    const selectedPct = portfolioPct(list, selectedIds);
    const selectedCapitalValue = accountCapital(selectedIds);
    const drawdownPct = selectedCapitalValue
      ? (summary.maxDrawdown / selectedCapitalValue) * 100
      : 0;
    $("#mainStats").innerHTML =
      stat(
        "صافي الربح",
        state.settings.showMoney
          ? formatMoney(summary.net, true)
          : formatPercent(selectedPct),
        resultTone(summary.net),
        state.settings.showMoney && state.settings.showPercent
          ? formatPercent(selectedPct, 2)
          : "",
      ) +
      stat(
        "معدل الفوز",
        `${summary.winRate.toFixed(1)}%`,
        "cyan",
        `${summary.wins.length} رابحة / ${summary.losses.length} خاسرة`,
      ) +
      stat(
        "Profit Factor",
        summary.profitFactor === Infinity
          ? "∞"
          : summary.profitFactor.toFixed(2),
        summary.profitFactor >= 1 ? "good" : "bad",
      ) +
      stat(
        "متوسط R",
        summary.rCount ? `${summary.averageR.toFixed(2)}R` : "—",
        resultTone(summary.averageR),
        summary.rCount
          ? `${summary.rCount} صفقة بمخاطرة معروفة`
          : "أدخل المخاطرة لحساب R",
      ) +
      stat(
        "أقصى تراجع",
        state.settings.showMoney
          ? formatMoney(-summary.maxDrawdown, true)
          : formatPercent(-drawdownPct),
        "bad",
        summary.recoveryFactor === Infinity
          ? "Recovery ∞"
          : `Recovery ${summary.recoveryFactor.toFixed(2)}`,
      ) +
      stat(
        "عدد الصفقات",
        String(summary.trades.length),
        "",
        `SQN ${summary.sqn.toFixed(2)}`,
      );

    renderGuardrails();
    renderAccountHealth();
    drawEquity(summary);

    const discipline = summary.discipline;
    $("#qualityRing").style.background =
      `conic-gradient(var(--green) ${discipline * 3.6}deg,var(--line) 0)`;
    $("#qualityRing b").textContent = `${discipline.toFixed(0)}%`;
    const gradeA = list.filter((trade) =>
      ["A+", "A"].includes(trade.grade),
    ).length;
    $("#qualityList").innerHTML = `
      <div class="mini-row"><span>ملتزم بالقواعد</span><b>${
        list.filter((trade) => trade.rulesFollowed === "yes").length
      }</b></div>
      <div class="mini-row"><span>التزام جزئي</span><b>${
        list.filter((trade) => trade.rulesFollowed === "partial").length
      }</b></div>
      <div class="mini-row"><span>مخالفة القواعد</span><b class="bad">${
        list.filter((trade) => trade.rulesFollowed === "no").length
      }</b></div>
      <div class="mini-row"><span>صفقات A / A+</span><b>${gradeA}</b></div>`;

    renderGroupBars(
      "#topSetups",
      list,
      (trade) =>
        playbookById(trade.setupId)?.name || trade.reason || "بدون استراتيجية",
      5,
    );

    const recent = [...list]
      .sort((a, b) => tradeTimestamp(b) - tradeTimestamp(a))
      .slice(0, 5);
    $("#recentTrades").innerHTML = recent.length
      ? recent
          .map((trade) => {
            const account = accountById(trade.accountId);
            return `<button class="recent-row recent-edit" data-id="${escapeHtml(
              trade.id,
            )}">
              <div class="recent-main">
                <div class="symbol-icon">${escapeHtml(trade.symbol.slice(0, 3))}</div>
                <span><b>${escapeHtml(trade.symbol)}</b><br>
                  <small class="muted">${escapeHtml(
                    `${account?.emoji || ""} ${account?.name || "حساب محذوف"} · ${new Date(
                      trade.date,
                    ).toLocaleDateString("ar-GB")}`,
                  )}</small>
                </span>
              </div>
              <b class="${resultTone(tradeNet(trade))}">${escapeHtml(
                resultText(trade),
              )}</b>
            </button>`;
          })
          .join("")
      : '<div class="empty">أضف أول صفقة لبدء التحليل.</div>';
    $$(".recent-edit").forEach(
      (button) => (button.onclick = () => openTrade(button.dataset.id)),
    );
  }

  function renderGuardrails() {
    const alerts = [];
    let danger = false;
    for (const account of state.accounts.filter(
      (item) => item.enabled && item.status === "active",
    )) {
      const health = accountHealth(account);
      if (
        health.status.label === "توقف اليوم" ||
        health.status.tone === "bad"
      ) {
        danger = true;
        alerts.push(`${account.emoji} ${account.name}: ${health.status.label}`);
      } else if (health.todayTrades.length) {
        alerts.push(
          `${account.emoji} ${account.name}: ${health.todayTrades.length} صفقة · ${formatPercent(
            health.todayPct,
          )}`,
        );
      }
    }
    const banner = $("#guardrailBanner");
    banner.hidden = !alerts.length;
    banner.classList.toggle("danger", danger);
    banner.innerHTML = alerts.length
      ? `<b>${danger ? "تنبيه إدارة المخاطر" : "ملخص اليوم"}</b><br>${alerts
          .map(escapeHtml)
          .join(" · ")}`
      : "";
  }

  function renderAccountHealth() {
    const accounts = state.accounts.filter((account) => account.enabled);
    $("#accountHealthGrid").innerHTML = accounts.length
      ? accounts
          .map((account) => {
            const health = accountHealth(account);
            const targetLabel = account.targetPct
              ? `${health.targetProgress.toFixed(0)}% من الهدف`
              : "دون هدف محدد";
            return `<article class="account-card" style="--account-color:${escapeHtml(
              account.color,
            )}">
              <div class="account-top">
                <div>
                  <strong>${escapeHtml(`${account.emoji} ${account.name}`)}</strong>
                  <small>${escapeHtml(
                    `${account.company || "بدون شركة"} · ${
                      ACCOUNT_PHASES[account.phase] || account.phase
                    }`,
                  )}</small>
                </div>
                <span class="account-badge ${health.status.tone}">${escapeHtml(
                  health.status.label,
                )}</span>
              </div>
              <div class="account-money">
                <b class="${resultTone(health.net)}">${escapeHtml(
                  state.settings.showMoney
                    ? formatMoney(health.net)
                    : formatPercent(health.totalPct),
                )}</b>
                ${
                  state.settings.showMoney && state.settings.showPercent
                    ? `<span>${escapeHtml(
                        formatPercent(health.totalPct),
                      )}</span>`
                    : ""
                }
              </div>
              <div class="progress"><i style="width:${health.targetProgress}%"></i></div>
              <div class="account-meta">
                <span>${escapeHtml(targetLabel)}</span>
                <span>متبقي DD ${escapeHtml(
                  state.settings.showMoney
                    ? formatMoney(health.remainingTotal, true)
                    : formatPercent(
                        (health.remainingTotal / account.balance) * 100,
                      ),
                )}</span>
              </div>
              <div class="account-meta">
                <span>اليوم ${escapeHtml(formatPercent(health.todayPct))}</span>
                <span>${health.todayTrades.length}/${account.maxTradesPerDay || "∞"} صفقات</span>
              </div>
              ${
                account.consistencyPct || account.minTradingDays
                  ? `<div class="account-meta">
                      <span>${
                        account.consistencyPct
                          ? `اتساق ${escapeHtml(
                              health.net > 0
                                ? `${health.consistency.toFixed(1)}% / ${account.consistencyPct}%`
                                : "—",
                            )}`
                          : ""
                      }</span>
                      <span>${
                        account.minTradingDays
                          ? `أيام ${health.tradingDays}/${account.minTradingDays}`
                          : ""
                      }</span>
                    </div>`
                  : ""
              }
            </article>`;
          })
          .join("")
      : '<div class="empty">لا توجد حسابات نشطة.</div>';
  }

  function drawEquity(summary = metrics()) {
    let trades = [...summary.trades];
    if (chartRange !== "all") {
      const from = Date.now() - Number(chartRange) * 86_400_000;
      trades = trades.filter((trade) => tradeTimestamp(trade) >= from);
    }
    const accountIds = new Set(selectedAccountIds());
    const capital = [...accountIds].reduce(
      (sum, accountId) => sum + asNumber(accountById(accountId)?.balance),
      0,
    );
    const useMoney = state.settings.showMoney || !state.settings.showPercent;
    const values = [0];
    for (const trade of trades) {
      const change = useMoney
        ? tradeNet(trade)
        : capital
          ? (tradeNet(trade) / capital) * 100
          : tradePct(trade);
      values.push(values[values.length - 1] + change);
    }

    const total = values[values.length - 1] || 0;
    $("#equityHint").textContent = useMoney
      ? `الحصيلة ${formatMoney(total)}`
      : `الحصيلة ${formatPercent(total)}`;

    const svg = $("#equityChart");
    const width = 900;
    const height = 300;
    const pad = { x: 30, y: 25 };
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum || 1;
    let grid = "";
    for (let index = 1; index < 5; index += 1) {
      const y = (height * index) / 5;
      grid += `<line class="gridline" x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
    }
    if (values.length < 2) {
      svg.innerHTML = `${grid}<text x="450" y="150" text-anchor="middle">أضف أول صفقة لعرض المنحنى</text>`;
      return;
    }

    const points = values.map((value, index) => [
      pad.x + (index / (values.length - 1)) * (width - pad.x * 2),
      height - pad.y - ((value - minimum) / span) * (height - pad.y * 2),
    ]);
    const path = points
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`,
      )
      .join(" ");
    const lastPoint = points[points.length - 1];
    const area = `${path} L ${lastPoint[0]} ${height - pad.y} L ${pad.x} ${
      height - pad.y
    } Z`;
    const label = (value) =>
      useMoney ? formatMoney(value, true) : formatPercent(value);
    svg.innerHTML = `
      <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/>
        <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path class="area" d="${area}"/>
      <path class="equity" d="${path}"/>
      <circle class="dot" cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="5"/>
      <text x="${width - 8}" y="18" text-anchor="end">${escapeHtml(
        label(maximum),
      )}</text>
      <text x="${width - 8}" y="${height - 4}" text-anchor="end">${escapeHtml(
        label(minimum),
      )}</text>`;
  }

  function resultKind(trade) {
    const net = tradeNet(trade);
    return net > 0 ? "win" : net < 0 ? "loss" : "be";
  }

  function filteredTrades() {
    const query = $("#tradeSearch").value.trim().toLowerCase();
    const result = $("#resultFilter").value;
    const session = $("#sessionFilter").value;
    const grade = $("#gradeFilter").value;
    const from = $("#dateFromFilter").value;
    const to = $("#dateToFilter").value;
    return selectedTrades()
      .filter((trade) => {
        const haystack = [
          trade.symbol,
          trade.notes,
          trade.lesson,
          trade.reason,
          trade.mistakes.join(" "),
          trade.confluences.join(" "),
          playbookById(trade.setupId)?.name,
          accountById(trade.accountId)?.name,
        ]
          .join(" ")
          .toLowerCase();
        const key = dateKey(trade);
        return (
          (!query || haystack.includes(query)) &&
          (result === "all" || resultKind(trade) === result) &&
          (session === "all" || trade.session === session) &&
          (grade === "all" || trade.grade === grade) &&
          (!from || key >= from) &&
          (!to || key <= to)
        );
      })
      .sort((a, b) => tradeTimestamp(b) - tradeTimestamp(a));
  }

  function rulesBadge(trade) {
    const label =
      trade.rulesFollowed === "yes"
        ? "ملتزم"
        : trade.rulesFollowed === "partial"
          ? "جزئي"
          : "مخالفة";
    const className =
      trade.rulesFollowed === "yes"
        ? "yes"
        : trade.rulesFollowed === "no"
          ? "no"
          : "";
    return `<span class="badge ${className}">${label}</span>`;
  }

  function renderTrades() {
    const list = filteredTrades();
    const summary = metrics(list);
    $("#tradeEmpty").style.display = list.length ? "none" : "block";
    $("#tradeSummary").innerHTML = list.length
      ? [
          `<span class="summary-pill"><b>${list.length}</b> صفقة</span>`,
          `<span class="summary-pill"><b>${summary.winRate.toFixed(
            1,
          )}%</b> فوز</span>`,
          `<span class="summary-pill"><b class="${resultTone(
            summary.net,
          )}">${escapeHtml(
            state.settings.showMoney
              ? formatMoney(summary.net)
              : formatPercent(portfolioPct(list, selectedAccountIds())),
          )}</b> صافي</span>`,
          `<span class="summary-pill"><b>${summary.averageR.toFixed(
            2,
          )}R</b> متوسط</span>`,
          `<span class="summary-pill"><b>${summary.profitFactor === Infinity ? "∞" : summary.profitFactor.toFixed(2)}</b> PF</span>`,
        ].join("")
      : "";

    $("#tradeTable").innerHTML = list
      .map((trade) => {
        const account = accountById(trade.accountId);
        const setup = playbookById(trade.setupId);
        return `<tr>
          <td>${escapeHtml(
            new Date(trade.date).toLocaleString("ar-GB", {
              dateStyle: "short",
              timeStyle: "short",
            }),
          )}</td>
          <td><b>${escapeHtml(trade.symbol)}</b>${
            trade.screenshot ? " 📷" : ""
          }</td>
          <td>${escapeHtml(`${account?.emoji || ""} ${account?.name || "محذوف"}`)}</td>
          <td>${trade.direction === "long" ? "شراء ↑" : "بيع ↓"}</td>
          <td>${escapeHtml(trade.session)}</td>
          <td>${escapeHtml(setup?.name || trade.reason || "—")}</td>
          <td class="${resultTone(tradeResultR(trade))}">${tradeResultR(
            trade,
          ).toFixed(2)}R</td>
          <td class="${resultTone(tradeNet(trade))}">${escapeHtml(
            resultText(trade),
          )}</td>
          <td>${rulesBadge(trade)}</td>
          <td><div class="row-actions">
            <button class="row-btn edit-trade" data-id="${escapeHtml(
              trade.id,
            )}">تعديل</button>
            <button class="row-btn danger delete-trade" data-id="${escapeHtml(
              trade.id,
            )}">حذف</button>
          </div></td>
        </tr>`;
      })
      .join("");

    $("#mobileTradeList").innerHTML = list
      .map((trade) => {
        const account = accountById(trade.accountId);
        const setup = playbookById(trade.setupId);
        return `<article class="mobile-trade-card ${resultKind(trade)}">
          <div class="mobile-trade-top">
            <strong>${escapeHtml(
              `${trade.direction === "long" ? "▲" : "▼"} ${trade.symbol}`,
            )}</strong>
            <b class="${resultTone(tradeNet(trade))}">${escapeHtml(
              resultText(trade),
            )}</b>
          </div>
          <div class="mobile-trade-meta">
            <span>${escapeHtml(
              new Date(trade.date).toLocaleString("ar-GB", {
                dateStyle: "short",
                timeStyle: "short",
              }),
            )}</span>
            <span>${escapeHtml(`${account?.emoji || ""} ${account?.name || "محذوف"}`)}</span>
          </div>
          <div class="mobile-trade-meta">
            <span>${escapeHtml(`${trade.session} · ${trade.timeframe}`)}</span>
            <span class="${resultTone(tradeResultR(trade))}">${tradeResultR(
              trade,
            ).toFixed(2)}R · ${escapeHtml(trade.grade)}</span>
          </div>
          <div class="mobile-trade-bottom">
            <span class="mobile-trade-tags">${escapeHtml(
              setup?.name ||
                trade.reason ||
                trade.mistakes.join("، ") ||
                "دون ملاحظات",
            )}</span>
            <div class="row-actions">
              <button class="row-btn edit-trade" data-id="${escapeHtml(
                trade.id,
              )}">تعديل</button>
              <button class="row-btn danger delete-trade" data-id="${escapeHtml(
                trade.id,
              )}">حذف</button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    $$(".edit-trade").forEach(
      (button) => (button.onclick = () => openTrade(button.dataset.id)),
    );
    $$(".delete-trade").forEach(
      (button) => (button.onclick = () => deleteTrade(button.dataset.id)),
    );
  }

  async function deleteTrade(id) {
    const trade = state.trades.find((item) => item.id === id);
    if (!trade) return;
    if (
      state.settings.confirmDeletes &&
      !window.confirm(`حذف صفقة ${trade.symbol}؟`)
    ) {
      return;
    }
    const index = state.trades.findIndex((item) => item.id === id);
    lastDeletedTrade = { trade: clone(trade), index };
    state.trades.splice(index, 1);
    await persistState();
    render();
    toast("تم حذف الصفقة — اضغط للتراجع", "success", {
      duration: 5000,
      onClick: async () => {
        if (!lastDeletedTrade) return;
        state.trades.splice(lastDeletedTrade.index, 0, lastDeletedTrade.trade);
        lastDeletedTrade = null;
        await persistState();
        render();
        toast("تمت استعادة الصفقة");
      },
    });
  }

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    $("#calendarTitle").textContent = new Intl.DateTimeFormat("ar-GB", {
      month: "long",
      year: "numeric",
    }).format(first);
    const grouped = groupByDay(selectedTrades());
    const monthly = selectedTrades().filter((trade) => {
      const date = new Date(trade.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    const monthMetrics = metrics(monthly);
    $("#calendarSummary").textContent = monthly.length
      ? `${monthly.length} صفقة · ${
          state.settings.showMoney
            ? formatMoney(monthMetrics.net)
            : formatPercent(portfolioPct(monthly, selectedAccountIds()))
        } · ${monthMetrics.winRate.toFixed(0)}% فوز`
      : "لا توجد صفقات هذا الشهر";

    let html = "";
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
      const list = grouped[key] || [];
      const sum = list.reduce((total, trade) => total + tradeNet(trade), 0);
      const classNames = [
        "cal-day",
        date.getMonth() !== month ? "outside" : "",
        key === todayKey() ? "today" : "",
        sum > 0 ? "win" : sum < 0 ? "loss" : "",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<button class="${classNames}" data-date="${key}" ${
        list.length ? "" : 'aria-label="لا صفقات"'
      }>
        <span class="cal-num">${date.getDate()}</span>
        ${
          list.length
            ? `<b class="cal-pnl ${resultTone(sum)}">${escapeHtml(
                state.settings.showMoney
                  ? formatMoney(sum, true)
                  : formatPercent(portfolioPct(list, selectedAccountIds())),
              )}</b><span class="cal-count">${list.length} صفقة</span>`
            : ""
        }
      </button>`;
    }
    $("#calendarGrid").innerHTML = html;
    $$(".cal-day").forEach((button) => {
      button.onclick = () =>
        openDay(button.dataset.date, grouped[button.dataset.date] || []);
    });
  }

  function openDay(key, trades) {
    $("#dayDialogTitle").textContent = new Date(
      `${key}T12:00`,
    ).toLocaleDateString("ar-GB", { dateStyle: "full" });
    const dayMetrics = metrics(trades);
    $("#dayDialogSub").textContent = trades.length
      ? `${trades.length} صفقة · ${
          state.settings.showMoney
            ? formatMoney(dayMetrics.net)
            : formatPercent(portfolioPct(trades, selectedAccountIds()))
        } · ${dayMetrics.winRate.toFixed(0)}% فوز`
      : "لا توجد صفقات";
    $("#dayDialogContent").innerHTML = trades.length
      ? [...trades]
          .sort((a, b) => tradeTimestamp(a) - tradeTimestamp(b))
          .map(
            (
              trade,
            ) => `<button class="day-trade day-edit" data-id="${escapeHtml(
              trade.id,
            )}">
              <span>${escapeHtml(
                `${trade.symbol} · ${trade.session} · ${accountById(trade.accountId)?.name || "حساب محذوف"}`,
              )}</span>
              <b class="${resultTone(tradeNet(trade))}">${escapeHtml(
                resultText(trade),
              )}</b>
            </button>`,
          )
          .join("")
      : '<div class="empty">لا توجد صفقات في هذا اليوم.</div>';
    $$(".day-edit").forEach((button) => {
      button.onclick = () => {
        $("#dayDialog").close();
        openTrade(button.dataset.id);
      };
    });
    $("#dayDialog").showModal();
  }

  function groupStats(list, keyFn) {
    const groups = {};
    for (const trade of list) {
      const key = String(keyFn(trade) || "غير محدد");
      if (!groups[key]) groups[key] = [];
      groups[key].push(trade);
    }
    return Object.entries(groups).map(([key, trades]) => ({
      key,
      trades,
      metrics: metrics(trades),
      net: trades.reduce((sum, trade) => sum + tradeNet(trade), 0),
      pct: portfolioPct(trades),
    }));
  }

  function renderGroupBars(selector, list, keyFn, limit = 9, sortMode = "net") {
    let entries = groupStats(list, keyFn);
    entries.sort((a, b) => {
      if (sortMode === "winRate") {
        return b.metrics.winRate - a.metrics.winRate || b.net - a.net;
      }
      if (sortMode === "cost") return a.net - b.net;
      return b.net - a.net;
    });
    entries = entries.slice(0, limit);
    const maximum = Math.max(1, ...entries.map((entry) => Math.abs(entry.net)));
    $(selector).innerHTML = entries.length
      ? entries
          .map(
            (entry) => `<div class="bar-card">
              <div class="bar-top">
                <b>${escapeHtml(entry.key)}</b>
                <span class="bar-numbers">
                  <span>${entry.metrics.winRate.toFixed(0)}% · ${
                    entry.trades.length
                  }</span>
                  <span class="${resultTone(entry.net)}">${escapeHtml(
                    state.settings.showMoney
                      ? formatMoney(entry.net, true)
                      : formatPercent(entry.pct),
                  )}</span>
                </span>
              </div>
              <div class="bar-track"><div class="bar-fill ${
                entry.net < 0 ? "loss" : ""
              }" style="width:${(Math.abs(entry.net) / maximum) * 100}%"></div></div>
            </div>`,
          )
          .join("")
      : '<div class="empty">لا توجد بيانات كافية.</div>';
  }

  function renderAnalytics() {
    const list = analyticsTrades();
    const summary = metrics(list);
    const capital = accountCapital(selectedAccountIds());
    const amountValue = (amount) =>
      state.settings.showMoney
        ? formatMoney(amount, true)
        : formatPercent(capital ? (amount / capital) * 100 : 0);
    $("#advancedStats").innerHTML =
      stat(
        "التوقع لكل صفقة",
        amountValue(summary.expectancy),
        resultTone(summary.expectancy),
        summary.rCount
          ? `${summary.expectancyR.toFixed(2)}R`
          : "R غير متوفر دون مخاطرة",
      ) +
      stat("متوسط الربح", amountValue(summary.averageWin), "good") +
      stat("متوسط الخسارة", amountValue(summary.averageLoss), "bad") +
      stat(
        "Payoff Ratio",
        summary.payoff.toFixed(2),
        summary.payoff >= 1 ? "good" : "warn",
      ) +
      stat(
        "أفضل / أسوأ",
        `${amountValue(summary.best)} / ${amountValue(summary.worst)}`,
      ) +
      stat(
        "سلاسل الأداء",
        `${summary.maxWinStreak}W / ${summary.maxLossStreak}L`,
        "cyan",
        `متوسط مدة ${formatDuration(summary.averageDuration)}`,
      );

    renderGroupBars("#sessionBars", list, (trade) => trade.session);
    const days = [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ];
    renderGroupBars(
      "#dayBars",
      list,
      (trade) => days[new Date(trade.date).getDay()],
    );
    renderGroupBars("#symbolBars", list, (trade) => trade.symbol);
    renderGroupBars(
      "#setupBars",
      list,
      (trade) =>
        playbookById(trade.setupId)?.name || trade.reason || "دون استراتيجية",
    );
    renderGroupBars("#gradeBars", list, (trade) => trade.grade, 7, "winRate");
    renderGroupBars("#emotionBars", list, (trade) => trade.emotion);
    renderGroupBars("#directionBars", list, (trade) =>
      trade.direction === "long" ? "شراء" : "بيع",
    );
    renderGroupBars(
      "#hourBars",
      list,
      (trade) => {
        const hour = String(trade.date).slice(11, 13);
        return hour ? `${hour}:00` : "وقت غير محدد";
      },
      8,
    );

    const mistakeTrades = [];
    for (const trade of list) {
      for (const mistake of trade.mistakes) {
        mistakeTrades.push({ ...trade, _mistake: mistake });
      }
    }
    renderGroupBars(
      "#mistakeBars",
      mistakeTrades,
      (trade) => trade._mistake,
      10,
      "cost",
    );
    renderGroupBars("#reasonBars", list, (trade) => trade.reason || "غير محدد");

    const violations = state.accounts
      .filter((account) => selectedAccountIds().includes(account.id))
      .flatMap((account) =>
        accountHealth(account).violations.map((violation) => ({
          account,
          violation,
        })),
      );
    $("#disciplineDetails").innerHTML = `
      <div class="mini-row"><span>الالتزام الموزون</span><b>${summary.discipline.toFixed(
        0,
      )}%</b></div>
      <div class="mini-row"><span>صفقات مخالفة</span><b class="bad">${
        list.filter((trade) => trade.rulesFollowed === "no").length
      }</b></div>
      <div class="mini-row"><span>مخالفات حدود الحسابات</span><b class="${
        violations.length ? "bad" : "good"
      }">${violations.length}</b></div>
      ${
        violations.length
          ? violations
              .slice(0, 8)
              .map(
                ({ account, violation }) =>
                  `<div class="mini-row"><span>${escapeHtml(
                    `${account.emoji} ${account.name}`,
                  )}</span><b class="bad">${escapeHtml(violation)}</b></div>`,
              )
              .join("")
          : '<div class="mini-row"><span>الحالة</span><b class="good">لا مخالفات مسجلة</b></div>'
      }`;
  }

  function renderPlaybooks() {
    const list = selectedTrades();
    $("#playbookGrid").innerHTML = state.playbooks.length
      ? state.playbooks
          .map((playbook) => {
            const trades = list.filter(
              (trade) => trade.setupId === playbook.id,
            );
            const summary = metrics(trades);
            return `<article class="pb-card">
              <div class="panel-head">
                <div>
                  <h3>${escapeHtml(playbook.name)}</h3>
                  <small class="muted">${escapeHtml(
                    `${playbook.market || "كل الأسواق"}${
                      playbook.active ? "" : " · غير نشطة"
                    }`,
                  )}</small>
                </div>
                <div class="row-actions">
                  <button class="row-btn edit-pb" data-id="${escapeHtml(
                    playbook.id,
                  )}">تعديل</button>
                  <button class="row-btn danger delete-pb" data-id="${escapeHtml(
                    playbook.id,
                  )}">حذف</button>
                </div>
              </div>
              <p>${escapeHtml(playbook.entry || "لا توجد شروط دخول مكتوبة.")}</p>
              <div class="pb-metrics">
                <div><span>الصفقات</span><b>${trades.length}</b></div>
                <div><span>الفوز</span><b>${summary.winRate.toFixed(0)}%</b></div>
                <div><span>صافي P&L</span><b class="${resultTone(
                  summary.net,
                )}">${escapeHtml(
                  state.settings.showMoney
                    ? formatMoney(summary.net, true)
                    : formatPercent(portfolioPct(trades)),
                )}</b></div>
              </div>
              <details><summary>القواعد وقائمة التحقق</summary>
                <p><b>Checklist:</b> ${escapeHtml(
                  playbook.checklist.join(" • ") || "—",
                )}<br><b>الخروج:</b> ${escapeHtml(
                  playbook.exit || "—",
                )}<br><b>المخاطرة:</b> ${escapeHtml(playbook.risk || "—")}</p>
              </details>
            </article>`;
          })
          .join("")
      : '<div class="empty">أنشئ أول استراتيجية لقياس أدائها.</div>';

    $$(".edit-pb").forEach(
      (button) => (button.onclick = () => openPlaybook(button.dataset.id)),
    );
    $$(".delete-pb").forEach(
      (button) => (button.onclick = () => deletePlaybook(button.dataset.id)),
    );
  }

  async function deletePlaybook(id) {
    if (state.trades.some((trade) => trade.setupId === id)) {
      toast("لا يمكن حذف استراتيجية مرتبطة بصفقات. يمكنك تعديلها.", "error");
      return;
    }
    if (
      state.settings.confirmDeletes &&
      !window.confirm("حذف هذه الاستراتيجية؟")
    ) {
      return;
    }
    state.playbooks = state.playbooks.filter((playbook) => playbook.id !== id);
    await persistState();
    render();
    toast("تم حذف الاستراتيجية");
  }

  function renderSettings() {
    $("#accountList").innerHTML = state.accounts
      .map((account) => {
        const health = accountHealth(account);
        return `<article class="account-setting-card" style="--account-color:${escapeHtml(
          account.color,
        )}">
          <div class="account-setting-title">
            <strong>${escapeHtml(`${account.emoji} ${account.name}`)}</strong>
            <span>${escapeHtml(ACCOUNT_STATUSES[account.status] || account.status)}</span>
          </div>
          <p class="account-setting-meta">${escapeHtml(
            `${account.company || "بدون شركة"} · ${formatMoney(
              account.balance,
              true,
            )} · هدف ${account.targetPct}%`,
          )}<br>${escapeHtml(
            `حدود ${account.dailyLossPct}% / ${account.totalLossPct}% · مخاطرة افتراضية ${account.defaultRiskPct}%${
              account.maxRiskPct ? ` · قصوى ${account.maxRiskPct}%` : ""
            } · نسخ ${account.copyGroup || "لا"}`,
          )}</p>
          <div class="account-setting-meta">${escapeHtml(
            `اليومي: ${
              account.dailyLossMode === "day-start"
                ? "رصيد بداية اليوم"
                : "الرصيد الابتدائي"
            } · إعادة اليوم ${String(account.dayResetHour).padStart(
              2,
              "0",
            )}:00${
              account.consistencyPct
                ? ` · اتساق ${account.consistencyPct}%`
                : ""
            }${
              account.minTradingDays
                ? ` · ${account.minTradingDays} أيام مطلوبة`
                : ""
            }`,
          )}</div>
          <div class="account-setting-meta">الحالي ${escapeHtml(
            formatMoney(health.currentBalance),
          )} · ${escapeHtml(formatPercent(health.totalPct))}</div>
          <div class="account-setting-actions">
            <button class="row-btn edit-account" data-id="${escapeHtml(
              account.id,
            )}">تعديل</button>
            <button class="row-btn danger delete-account" data-id="${escapeHtml(
              account.id,
            )}">حذف</button>
          </div>
        </article>`;
      })
      .join("");

    $$(".edit-account").forEach(
      (button) => (button.onclick = () => openAccount(button.dataset.id)),
    );
    $$(".delete-account").forEach(
      (button) => (button.onclick = () => deleteAccount(button.dataset.id)),
    );

    $("#prefCurrency").value = state.settings.currency;
    $("#prefDefaultAccount").value = state.settings.defaultAccountId;
    $("#prefDefaultSession").value = state.settings.defaultSession;
    $("#prefCopyMode").value = state.settings.copyMode;
    $("#prefDensity").value = state.settings.density;
    $("#prefAccent").value = state.settings.accent;
    $("#prefShowMoney").checked = state.settings.showMoney;
    $("#prefShowPercent").checked = state.settings.showPercent;
    $("#prefConfirmDeletes").checked = state.settings.confirmDeletes;
    $("#prefGuardrailBlock").checked = state.settings.guardrailBlock;

    const listFields = {
      listSymbols: "symbols",
      listSessions: "sessions",
      listReasons: "reasons",
      listEmotions: "emotions",
      listMistakes: "mistakes",
      listConfluences: "confluences",
      listTimeframes: "timeframes",
    };
    for (const [elementId, key] of Object.entries(listFields)) {
      $(`#${elementId}`).value = state.settings.lists[key].join("\n");
    }

    const bytes = new Blob([JSON.stringify(state)]).size;
    const screenshots = state.trades.filter((trade) => trade.screenshot).length;
    $("#storageInfo").innerHTML = `المخزن: ${escapeHtml(
      storageMode,
    )}<br>حجم البيانات التقريبي: ${escapeHtml(
      bytes < 1_000_000
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1_048_576).toFixed(2)} MB`,
    )}<br>الصفقات: ${state.trades.length} · الصور: ${screenshots} · إصدار البيانات: ${APP_VERSION}`;
  }

  async function deleteAccount(id) {
    if (state.accounts.length === 1) {
      toast("يجب أن يبقى حساب واحد على الأقل.", "error");
      return;
    }
    if (state.trades.some((trade) => trade.accountId === id)) {
      toast("الحساب يحتوي صفقات. غيّر حالته إلى مؤرشف بدل حذفه.", "error");
      return;
    }
    if (state.settings.confirmDeletes && !window.confirm("حذف هذا الحساب؟")) {
      return;
    }
    state.accounts = state.accounts.filter((account) => account.id !== id);
    if (state.settings.defaultAccountId === id) {
      state.settings.defaultAccountId = state.accounts[0].id;
    }
    await persistState();
    render();
    toast("تم حذف الحساب");
  }

  function renderChips() {
    const make = (selector, values, selected) => {
      $(selector).innerHTML = values
        .map(
          (value) =>
            `<button type="button" class="chip ${
              selected.has(value) ? "active" : ""
            }" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`,
        )
        .join("");
      $(`${selector}`)
        .querySelectorAll(".chip")
        .forEach((button) => {
          button.onclick = () => {
            const value = button.dataset.value;
            if (selected.has(value)) selected.delete(value);
            else selected.add(value);
            button.classList.toggle("active", selected.has(value));
          };
        });
    };
    make(
      "#confluenceChips",
      state.settings.lists.confluences,
      selectedConfluences,
    );
    make("#mistakeChips", state.settings.lists.mistakes, selectedMistakes);
  }

  function resetTradeForm() {
    $("#tradeForm").reset();
    $("#tradeId").value = "";
    $("#tradeModalTitle").textContent = "إضافة صفقة";
    const configuredDefault = accountById(state.settings.defaultAccountId);
    $("#tradeAccount").value =
      (configuredDefault?.enabled && configuredDefault.id) ||
      state.accounts.find((account) => account.enabled)?.id ||
      state.accounts[0]?.id ||
      "";
    $("#tradeDate").value = localDateTime();
    $("#tradeCloseDate").value = "";
    $("#session").value = state.settings.defaultSession;
    $("#timeframe").value = state.settings.lists.timeframes.includes("M5")
      ? "M5"
      : state.settings.lists.timeframes[0];
    $("#direction").value = "long";
    $("#tradeSource").value = "manual";
    $("#resultMode").value = "r";
    $("#grade").value = "A";
    $("#rulesFollowed").value = "yes";
    $("#exitReason").value = "other";
    $("#fees").value = "0";
    $("#swap").value = "0";
    selectedMistakes = new Set();
    selectedConfluences = new Set();
    currentImage = "";
    $("#imageStatus").textContent = "اختياري — سيتم ضغط الصورة تلقائيًا.";
    updateImagePreview();

    const account = accountById($("#tradeAccount").value);
    const riskPct = account ? account.defaultRiskPct : 0.5;
    $("#riskPct").value = riskPct;
    $("#riskAmount").value = account
      ? round((account.balance * riskPct) / 100, 2)
      : "";
    $("#resultR").value = "";
    $("#grossPnl").value = "";
    $("#pnlPct").value = "";
    $("#symbol").value = "";
    renderChips();
    updateCopyGroupHint();
    updateResultFields();
    calculateFormResult();
  }

  function openTrade(id = "") {
    if (!state.accounts.some((account) => account.enabled)) {
      toast("أضف حسابًا نشطًا أولًا.", "error");
      go("settings");
      return;
    }
    fillSelects();
    resetTradeForm();
    const trade = state.trades.find((item) => item.id === id);
    if (trade) {
      $("#tradeId").value = trade.id;
      $("#tradeModalTitle").textContent = "تعديل الصفقة";
      ensureSelectValue(
        $("#tradeAccount"),
        trade.accountId,
        accountById(trade.accountId)?.name || "حساب محذوف",
      );
      $("#tradeDate").value = String(trade.date).slice(0, 16);
      $("#tradeCloseDate").value = String(trade.closeDate || "").slice(0, 16);
      $("#symbol").value = trade.symbol;
      $("#direction").value = trade.direction;
      ensureSelectValue($("#session"), trade.session);
      ensureSelectValue($("#timeframe"), trade.timeframe);
      $("#tradeSource").value = trade.source;
      ensureSelectValue(
        $("#setup"),
        trade.setupId,
        playbookById(trade.setupId)?.name || "استراتيجية محفوظة",
      );
      ensureSelectValue($("#reason"), trade.reason);
      $("#grade").value = trade.grade;
      ensureSelectValue($("#emotion"), trade.emotion);
      $("#rulesFollowed").value = trade.rulesFollowed;
      $("#exitReason").value = trade.exitReason;
      $("#entry").value = trade.entry ?? "";
      $("#stop").value = trade.stop ?? "";
      $("#target").value = trade.target ?? "";
      $("#exit").value = trade.exit ?? "";
      $("#size").value = trade.size ?? "";
      $("#resultMode").value = trade.resultMode;
      $("#riskAmount").value = trade.riskAmount ?? "";
      $("#riskPct").value = trade.riskPct ?? "";
      $("#resultR").value = trade.resultR ?? "";
      $("#grossPnl").value = trade.grossPnl ?? "";
      $("#pnlPct").value = trade.pnlPct ?? "";
      $("#fees").value = trade.fees ?? 0;
      $("#swap").value = trade.swap ?? 0;
      $("#maeR").value = trade.maeR ?? "";
      $("#mfeR").value = trade.mfeR ?? "";
      $("#notes").value = trade.notes;
      $("#lesson").value = trade.lesson;
      selectedMistakes = new Set(trade.mistakes);
      selectedConfluences = new Set(trade.confluences);
      currentImage = trade.screenshot || "";
      $("#imageStatus").textContent = currentImage
        ? "صورة محفوظة"
        : "اختياري — سيتم ضغط الصورة تلقائيًا.";
      renderChips();
      updateImagePreview();
    }
    updateCopyGroupHint();
    updateResultFields();
    calculateFormResult();
    $("#tradeDialog").showModal();
  }

  function updateCopyGroupHint() {
    const account = accountById($("#tradeAccount").value);
    const row = $("#copyGroupRow");
    const editing = Boolean($("#tradeId").value);
    const members = account?.copyGroup
      ? state.accounts.filter(
          (item) =>
            item.enabled &&
            item.copyGroup &&
            item.copyGroup === account.copyGroup,
        )
      : [];
    row.hidden = editing || members.length < 2;
    $("#copyToGroup").checked = !row.hidden;
    $("#copyGroupHint").textContent = row.hidden
      ? ""
      : `سيتم إنشاء صفقة مستقلة في: ${members
          .map((member) => member.name)
          .join("، ")}`;
  }

  function updateResultFields() {
    const mode = $("#resultMode").value;
    $$(".result-field").forEach((field) => {
      field.hidden = field.dataset.resultField !== mode;
    });
  }

  function formTradeDraft() {
    return {
      resultMode: $("#resultMode").value,
      riskAmount: asNumber($("#riskAmount").value),
      riskPct: asNumber($("#riskPct").value),
      resultR: asNumber($("#resultR").value),
      grossPnl: asNumber($("#grossPnl").value),
      pnlPct: asNumber($("#pnlPct").value),
      fees: Math.max(0, asNumber($("#fees").value)),
      swap: asNumber($("#swap").value),
    };
  }

  function prospectiveWarnings(account, values) {
    if (!account) return [];
    const id = $("#tradeId").value;
    const candidateDate = $("#tradeCloseDate").value || $("#tradeDate").value;
    const key = shiftedDateKey(candidateDate, account.dayResetHour);
    const session = $("#session").value;
    const existing = state.trades.filter(
      (trade) =>
        trade.accountId === account.id &&
        accountDateKey(trade, account) === key &&
        trade.id !== id,
    );
    const warnings = [];
    const projected = [...existing, { netPnl: values.netPnl, session }];
    const projectedNet = projected.reduce(
      (sum, trade) => sum + tradeNet(trade),
      0,
    );
    const projectedLosses = projected.filter(
      (trade) => tradeNet(trade) < 0,
    ).length;
    const priorNet = state.trades
      .filter(
        (trade) =>
          trade.accountId === account.id &&
          trade.id !== id &&
          accountDateKey(trade, account) < key,
      )
      .reduce((sum, trade) => sum + tradeNet(trade), 0);
    const dailyLossBase =
      account.dailyLossMode === "day-start"
        ? Math.max(0, account.balance + priorNet)
        : account.balance;

    if (
      account.maxTradesPerDay > 0 &&
      projected.length > account.maxTradesPerDay
    ) {
      warnings.push({
        block: true,
        text: `ستتجاوز حد ${account.maxTradesPerDay} صفقات يوميًا.`,
      });
    }
    if (
      account.maxLossesPerDay > 0 &&
      projectedLosses > account.maxLossesPerDay
    ) {
      warnings.push({
        block: true,
        text: `ستتجاوز حد ${account.maxLossesPerDay} خسائر يوميًا.`,
      });
    }
    if (
      account.personalDailyStopPct > 0 &&
      projectedNet <= -(account.balance * account.personalDailyStopPct) / 100
    ) {
      warnings.push({
        block: true,
        text: `النتيجة المتوقعة تتجاوز حدك الشخصي اليومي ${account.personalDailyStopPct}%.`,
      });
    }
    if (
      account.dailyLossPct > 0 &&
      projectedNet <= -(dailyLossBase * account.dailyLossPct) / 100
    ) {
      warnings.push({
        block: true,
        text: `النتيجة المتوقعة تصل إلى حد الشركة اليومي ${account.dailyLossPct}%.`,
      });
    }
    if (
      account.maxRiskPct > 0 &&
      asNumber(values.riskPct) > account.maxRiskPct
    ) {
      warnings.push({
        block: true,
        text: `المخاطرة ${values.riskPct.toFixed(
          2,
        )}% تتجاوز حد الصفقة ${account.maxRiskPct}%.`,
      });
    }
    if (
      account.blockNyAfterAsiaLoss &&
      session.includes("نيويورك") &&
      existing.some(
        (trade) => trade.session.includes("آسيا") && tradeNet(trade) < 0,
      )
    ) {
      warnings.push({
        block: true,
        text: "هناك خسارة في جلسة آسيا؛ دخول نيويورك مخالف لقاعدتك.",
      });
    }
    if (account.status !== "active") {
      warnings.push({
        block: true,
        text: `الحساب حالته «${ACCOUNT_STATUSES[account.status] || account.status}».`,
      });
    }

    if (account.consistencyPct > 0) {
      const allProjected = state.trades
        .filter((trade) => trade.accountId === account.id && trade.id !== id)
        .concat({
          ...values,
          accountId: account.id,
          date: $("#tradeDate").value,
          closeDate: $("#tradeCloseDate").value,
        });
      const projectedByDay = {};
      for (const trade of allProjected) {
        const day = accountDateKey(trade, account);
        projectedByDay[day] = (projectedByDay[day] || 0) + tradeNet(trade);
      }
      const projectedTotal = allProjected.reduce(
        (sum, trade) => sum + tradeNet(trade),
        0,
      );
      const projectedBestDay = Math.max(0, ...Object.values(projectedByDay));
      const projectedConsistency =
        projectedTotal > 0 ? (projectedBestDay / projectedTotal) * 100 : 0;
      if (projectedTotal > 0 && projectedConsistency > account.consistencyPct) {
        warnings.push({
          block: false,
          text: `الاتساق التقديري ${projectedConsistency.toFixed(
            1,
          )}% أعلى من حد ${account.consistencyPct}%.`,
        });
      }
    }
    return warnings;
  }

  function calculateFormResult() {
    const account = accountById($("#tradeAccount").value);
    const values = calculateTradeValues(formTradeDraft(), account);
    $("#calculatedPnl").textContent = formatMoney(values.netPnl);
    $("#calculatedPnl").className = resultTone(values.netPnl);
    $("#calculatedMeta").textContent =
      `${formatPercent(values.pnlPct)} · ${values.resultR.toFixed(2)}R · رسوم ${formatMoney(
        values.fees + values.swap,
      )}`;
    const warnings = prospectiveWarnings(account, values);
    const box = $("#ruleWarnings");
    box.hidden = !warnings.length;
    box.classList.toggle(
      "block",
      warnings.some((warning) => warning.block),
    );
    box.innerHTML = warnings
      .map((warning) => `• ${escapeHtml(warning.text)}`)
      .join("<br>");
    return { values, warnings };
  }

  function syncRiskFields(source) {
    const account = accountById($("#tradeAccount").value);
    if (!account) return;
    if (source === "amount") {
      $("#riskPct").value = round(
        (asNumber($("#riskAmount").value) / account.balance) * 100,
        4,
      );
    } else {
      $("#riskAmount").value = round(
        (account.balance * asNumber($("#riskPct").value)) / 100,
        2,
      );
    }
    calculateFormResult();
  }

  function collectTrade(account, overrides = {}) {
    const existing = state.trades.find(
      (trade) => trade.id === $("#tradeId").value,
    );
    const draft = {
      id: $("#tradeId").value || uid(),
      batchId: overrides.batchId ?? existing?.batchId ?? "",
      copiedFrom: overrides.copiedFrom ?? existing?.copiedFrom ?? "",
      accountId: overrides.accountId || account.id,
      date: $("#tradeDate").value,
      closeDate: $("#tradeCloseDate").value,
      symbol: $("#symbol").value.trim().toUpperCase(),
      direction: $("#direction").value,
      session: $("#session").value,
      timeframe: $("#timeframe").value,
      source: $("#tradeSource").value,
      setupId: $("#setup").value,
      reason: $("#reason").value,
      entry: $("#entry").value === "" ? null : asNumber($("#entry").value),
      stop: $("#stop").value === "" ? null : asNumber($("#stop").value),
      target: $("#target").value === "" ? null : asNumber($("#target").value),
      exit: $("#exit").value === "" ? null : asNumber($("#exit").value),
      size: $("#size").value === "" ? null : asNumber($("#size").value),
      ...formTradeDraft(),
      grade: $("#grade").value,
      emotion: $("#emotion").value,
      rulesFollowed: $("#rulesFollowed").value,
      exitReason: $("#exitReason").value,
      mistakes: [...selectedMistakes],
      confluences: [...selectedConfluences],
      notes: $("#notes").value.trim(),
      lesson: $("#lesson").value.trim(),
      screenshot: currentImage,
      maeR: $("#maeR").value === "" ? null : asNumber($("#maeR").value),
      mfeR: $("#mfeR").value === "" ? null : asNumber($("#mfeR").value),
      externalId: overrides.externalId ?? existing?.externalId ?? "",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    return normalizeTrade(draft, state.accounts);
  }

  function copiedTrade(primary, targetAccount, batchId) {
    const sourceAccount = accountById(primary.accountId);
    const ratio =
      sourceAccount?.balance > 0
        ? targetAccount.balance / sourceAccount.balance
        : 1;
    const exact = state.settings.copyMode === "exact";
    const draft = {
      ...clone(primary),
      id: uid(),
      batchId,
      copiedFrom: primary.id,
      accountId: targetAccount.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!exact) {
      draft.riskAmount = round(
        targetAccount.balance * (primary.riskPct / 100),
        2,
      );
      draft.fees = round(primary.fees * ratio, 2);
      draft.swap = round(primary.swap * ratio, 2);
      if (primary.resultMode === "money") {
        draft.resultMode = "percent";
        draft.pnlPct = primary.pnlPct;
      }
    }
    return normalizeTrade(draft, state.accounts);
  }

  async function saveTradeFromForm(event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value !== "save") return;
    const account = accountById($("#tradeAccount").value);
    const symbol = $("#symbol").value.trim();
    const date = $("#tradeDate").value;
    if (!account || !symbol || !date) {
      toast("أكمل الحساب والتاريخ والأصل.", "error");
      return;
    }
    calculateFormResult();
    const editingId = $("#tradeId").value;
    const mode = $("#resultMode").value;
    if (
      (mode === "r" &&
        ($("#resultR").value === "" ||
          !Number.isFinite(Number($("#resultR").value)) ||
          !(asNumber($("#riskAmount").value) > 0))) ||
      (mode === "money" &&
        ($("#grossPnl").value === "" ||
          !Number.isFinite(Number($("#grossPnl").value)))) ||
      (mode === "percent" &&
        ($("#pnlPct").value === "" ||
          !Number.isFinite(Number($("#pnlPct").value))))
    ) {
      toast(
        mode === "r"
          ? "أدخل المخاطرة المالية ونتيجة R."
          : mode === "money"
            ? "أدخل قيمة الربح أو الخسارة."
            : "أدخل النتيجة المئوية.",
        "error",
      );
      return;
    }

    const primary = collectTrade(account);
    let candidates = [primary];

    if (!editingId) {
      const members =
        $("#copyToGroup").checked && account.copyGroup
          ? state.accounts.filter(
              (member) =>
                member.id === account.id ||
                (member.enabled &&
                  member.copyGroup &&
                  member.copyGroup === account.copyGroup),
            )
          : [account];
      if (members.length > 1) {
        const batchId = uid();
        primary.batchId = batchId;
        const copies = members
          .filter((member) => member.id !== account.id)
          .map((member) => copiedTrade(primary, member, batchId));
        candidates = [primary, ...copies];
      }
    }

    const allWarnings = candidates.flatMap((candidate) =>
      prospectiveWarnings(accountById(candidate.accountId), candidate).map(
        (warning) => ({
          ...warning,
          accountName: accountById(candidate.accountId)?.name || "",
        }),
      ),
    );
    if (
      state.settings.guardrailBlock &&
      allWarnings.some((warning) => warning.block)
    ) {
      const first = allWarnings.find((warning) => warning.block);
      toast(
        `تعذر الحفظ${first?.accountName ? ` في ${first.accountName}` : ""}: ${
          first?.text || "تجاوز قاعدة حماية"
        }`,
        "error",
        { duration: 4500 },
      );
      return;
    }

    if (editingId) {
      const index = state.trades.findIndex((trade) => trade.id === editingId);
      if (index >= 0) state.trades[index] = primary;
    } else {
      state.trades.push(...candidates);
    }

    const saved = await persistState();
    if (!saved) return;
    $("#tradeDialog").close();
    render();
    toast(editingId ? "تم تحديث الصفقة" : "تم حفظ الصفقة");
  }

  function openPlaybook(id = "") {
    $("#playbookForm").reset();
    $("#pbId").value = "";
    $("#playbookModalTitle").textContent = "استراتيجية جديدة";
    const playbook = state.playbooks.find((item) => item.id === id);
    if (playbook) {
      $("#pbId").value = playbook.id;
      $("#playbookModalTitle").textContent = "تعديل الاستراتيجية";
      $("#pbName").value = playbook.name;
      $("#pbMarket").value = playbook.market;
      $("#pbEntry").value = playbook.entry;
      $("#pbChecklist").value = playbook.checklist.join("\n");
      $("#pbExit").value = playbook.exit;
      $("#pbRisk").value = playbook.risk;
      $("#pbActive").checked = playbook.active;
    } else {
      $("#pbActive").checked = true;
    }
    $("#playbookDialog").showModal();
  }

  async function savePlaybook(event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value !== "save") return;
    const id = $("#pbId").value || uid();
    const playbook = normalizePlaybook({
      id,
      name: $("#pbName").value.trim(),
      market: $("#pbMarket").value.trim(),
      entry: $("#pbEntry").value.trim(),
      checklist: uniqueList($("#pbChecklist").value, []),
      exit: $("#pbExit").value.trim(),
      risk: $("#pbRisk").value.trim(),
      active: $("#pbActive").checked,
      createdAt:
        state.playbooks.find((item) => item.id === id)?.createdAt ||
        new Date().toISOString(),
    });
    if (!playbook.name || !playbook.entry) {
      toast("أدخل اسم الاستراتيجية وشروط الدخول.", "error");
      return;
    }
    const index = state.playbooks.findIndex((item) => item.id === id);
    if (index >= 0) state.playbooks[index] = playbook;
    else state.playbooks.push(playbook);
    await persistState();
    $("#playbookDialog").close();
    render();
    toast(index >= 0 ? "تم تحديث الاستراتيجية" : "تم إنشاء الاستراتيجية");
  }

  function openAccount(id = "") {
    $("#accountForm").reset();
    $("#accountId").value = "";
    $("#accountModalTitle").textContent = "إضافة حساب";
    const source =
      state.accounts.find((account) => account.id === id) ||
      normalizeAccount({
        id: uid(),
        name: "",
        balance: 10_000,
        targetPct: 8,
        dailyLossPct: 4,
        totalLossPct: 8,
        personalDailyStopPct: 1,
        defaultRiskPct: 0.5,
        maxTradesPerDay: 2,
        maxLossesPerDay: 2,
        maxRiskPct: 0,
        dailyLossMode: "initial",
        dayResetHour: 0,
        consistencyPct: 0,
        minTradingDays: 0,
        enabled: true,
      });
    if (id) $("#accountModalTitle").textContent = "تعديل الحساب";
    $("#accountId").value = id || "";
    $("#accountName").value = id ? source.name : "";
    $("#accountCompany").value = source.company;
    $("#accountBalance").value = source.balance;
    $("#accountPhase").value = source.phase;
    $("#accountStatus").value = source.status;
    $("#accountTarget").value = source.targetPct;
    $("#accountDailyLoss").value = source.dailyLossPct;
    $("#accountTotalLoss").value = source.totalLossPct;
    $("#accountPersonalDaily").value = source.personalDailyStopPct;
    $("#accountRiskPct").value = source.defaultRiskPct;
    $("#accountMaxTrades").value = source.maxTradesPerDay;
    $("#accountMaxLosses").value = source.maxLossesPerDay;
    $("#accountMaxRiskPct").value = source.maxRiskPct;
    $("#accountDrawdown").value = source.drawdownMode;
    $("#accountDailyLossMode").value = source.dailyLossMode;
    $("#accountDayResetHour").value = source.dayResetHour;
    $("#accountConsistency").value = source.consistencyPct;
    $("#accountMinDays").value = source.minTradingDays;
    $("#accountCopyGroup").value = source.copyGroup;
    $("#accountEmoji").value = source.emoji;
    $("#accountColor").value = source.color;
    $("#accountBlockNy").checked = source.blockNyAfterAsiaLoss;
    $("#accountEnabled").checked = source.enabled;
    $("#accountDialog").showModal();
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value !== "save") return;
    const existingId = $("#accountId").value;
    const id = existingId || uid();
    const account = normalizeAccount({
      id,
      name: $("#accountName").value.trim(),
      company: $("#accountCompany").value.trim(),
      balance: asNumber($("#accountBalance").value),
      phase: $("#accountPhase").value,
      status: $("#accountStatus").value,
      targetPct: asNumber($("#accountTarget").value),
      dailyLossPct: asNumber($("#accountDailyLoss").value),
      totalLossPct: asNumber($("#accountTotalLoss").value),
      personalDailyStopPct: asNumber($("#accountPersonalDaily").value),
      defaultRiskPct: asNumber($("#accountRiskPct").value),
      maxTradesPerDay: asNumber($("#accountMaxTrades").value),
      maxLossesPerDay: asNumber($("#accountMaxLosses").value),
      maxRiskPct: asNumber($("#accountMaxRiskPct").value),
      drawdownMode: $("#accountDrawdown").value,
      dailyLossMode: $("#accountDailyLossMode").value,
      dayResetHour: asNumber($("#accountDayResetHour").value),
      consistencyPct: asNumber($("#accountConsistency").value),
      minTradingDays: asNumber($("#accountMinDays").value),
      copyGroup: $("#accountCopyGroup").value.trim(),
      emoji: $("#accountEmoji").value.trim() || "💼",
      color: $("#accountColor").value,
      blockNyAfterAsiaLoss: $("#accountBlockNy").checked,
      enabled: $("#accountEnabled").checked,
      createdAt:
        state.accounts.find((item) => item.id === id)?.createdAt ||
        new Date().toISOString(),
    });
    if (!account.name || account.balance <= 0) {
      toast("أدخل اسم الحساب وحجمه بصورة صحيحة.", "error");
      return;
    }
    const index = state.accounts.findIndex((item) => item.id === id);
    if (index >= 0) state.accounts[index] = account;
    else state.accounts.push(account);
    if (!state.settings.defaultAccountId) {
      state.settings.defaultAccountId = account.id;
    }
    if (!accountById(state.settings.defaultAccountId)?.enabled) {
      state.settings.defaultAccountId =
        state.accounts.find((item) => item.enabled)?.id || account.id;
    }
    await persistState();
    $("#accountDialog").close();
    render();
    toast(index >= 0 ? "تم تحديث الحساب" : "تمت إضافة الحساب");
  }

  async function compressImage(file) {
    if (!file) return "";
    if (file.size > 10_000_000) {
      throw new Error("الصورة أكبر من 10MB.");
    }
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("صيغة الصورة غير مدعومة."));
      element.src = source;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.78);
  }

  function updateImagePreview() {
    const wrap = $("#imagePreviewWrap");
    wrap.hidden = !currentImage;
    if (currentImage) $("#imagePreview").src = currentImage;
    else $("#imagePreview").removeAttribute("src");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];
      if (character === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1;
        row.push(cell);
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
    }
    return rows;
  }

  function normalizedHeader(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_.-]+/g, "");
  }

  function csvField(row, headers, aliases) {
    for (const alias of aliases) {
      const index = headers.indexOf(normalizedHeader(alias));
      if (index >= 0) return row[index] ?? "";
    }
    return "";
  }

  function csvSafe(value) {
    const string = String(value ?? "");
    const safe = /^[=+\-@]/.test(string) ? `'${string}` : string;
    return `"${safe.replaceAll('"', '""')}"`;
  }

  function normalizeImportedDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let normalized = raw
      .replace(
        /^(\d{4})[./](\d{1,2})[./](\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/,
        (_, year, month, day, time) =>
          `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
            2,
            "0",
          )}T${time}`,
      )
      .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/, "$1T$2");
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      normalized += "T00:00";
    }
    return Number.isFinite(new Date(normalized).getTime()) ? normalized : "";
  }

  const MT5_HEADER_ALIASES = Object.freeze({
    time: ["time", "date", "وقت", "التاريخ"],
    openTime: [
      "open time",
      "opening time",
      "entry time",
      "وقت الفتح",
      "وقت الدخول",
      "تاريخ الفتح",
    ],
    closeTime: [
      "close time",
      "closing time",
      "exit time",
      "وقت الإغلاق",
      "وقت الخروج",
      "تاريخ الإغلاق",
    ],
    deal: ["deal", "deal id", "ticket", "صفقة", "رقم الصفقة", "تذكرة"],
    position: [
      "position",
      "position id",
      "positionid",
      "المركز",
      "رقم المركز",
    ],
    order: ["order", "order id", "أمر", "رقم الأمر"],
    symbol: ["symbol", "instrument", "pair", "الرمز", "الأصل", "الأداة"],
    type: ["type", "side", "النوع"],
    direction: ["direction", "entry", "الاتجاه", "الدخول"],
    volume: ["volume", "lots", "lot", "size", "الحجم", "اللوت"],
    price: ["price", "السعر"],
    openPrice: [
      "open price",
      "entry price",
      "سعر الفتح",
      "سعر الدخول",
    ],
    closePrice: [
      "close price",
      "exit price",
      "سعر الإغلاق",
      "سعر الخروج",
    ],
    sl: ["s/l", "sl", "stop loss", "stoploss", "وقف الخسارة"],
    tp: ["t/p", "tp", "take profit", "takeprofit", "جني الربح"],
    commission: ["commission", "comm", "العمولة", "العمولات"],
    fee: ["fee", "fees", "الرسوم", "رسم"],
    swap: ["swap", "swaps", "التبييت", "السواب"],
    profit: [
      "profit",
      "p/l",
      "p&l",
      "net profit",
      "الربح",
      "الربح والخسارة",
      "النتيجة",
    ],
    balance: ["balance", "الرصيد"],
    comment: ["comment", "comments", "تعليق", "الملاحظات"],
    state: ["state", "status", "الحالة"],
  });

  const MT5_SECTION_ALIASES = Object.freeze({
    deals: ["deals", "deal history", "الصفقات", "سجل الصفقات", "العمليات"],
    positions: [
      "positions",
      "closed positions",
      "position history",
      "المراكز",
      "المراكز المغلقة",
      "سجل المراكز",
    ],
    orders: ["orders", "order history", "الأوامر", "سجل الأوامر"],
    working: ["working orders", "active orders", "الأوامر النشطة"],
  });

  function normalizeMt5Text(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/[\u064b-\u065f\u0670]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[&+]/g, "and")
      .replace(/[\s_.:/\\()[\]{}#%-]+/g, "");
  }

  const mt5HeaderLookup = new Map(
    Object.entries(MT5_HEADER_ALIASES).flatMap(([field, aliases]) =>
      aliases.map((alias) => [normalizeMt5Text(alias), field]),
    ),
  );

  const mt5SectionLookup = new Map(
    Object.entries(MT5_SECTION_ALIASES).flatMap(([section, aliases]) =>
      aliases.map((alias) => [normalizeMt5Text(alias), section]),
    ),
  );

  function mt5HeaderName(value) {
    return mt5HeaderLookup.get(normalizeMt5Text(value)) || "";
  }

  function mt5SectionName(value) {
    const normalized = normalizeMt5Text(value);
    if (mt5SectionLookup.has(normalized)) return mt5SectionLookup.get(normalized);
    for (const [alias, section] of mt5SectionLookup) {
      if (normalized.startsWith(alias) && normalized.length <= alias.length + 12) {
        return section;
      }
    }
    return "";
  }

  function asciiDigits(value) {
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    const eastern = "۰۱۲۳۴۵۶۷۸۹";
    return String(value || "")
      .replace(/[٠-٩]/g, (digit) => arabic.indexOf(digit))
      .replace(/[۰-۹]/g, (digit) => eastern.indexOf(digit));
  }

  function mt5Number(value, fallback = 0) {
    let raw = asciiDigits(value)
      .replace(/\u00a0/g, "")
      .replace(/[−–—]/g, "-")
      .replace(/٬/g, ",")
      .replace(/٫/g, ".")
      .trim();
    if (!raw) return fallback;
    const parenthesized = /^\(.*\)$/.test(raw);
    raw = raw
      .replace(/[()]/g, "")
      .replace(/[^\d.,+\-]/g, "");
    if (!raw || !/\d/.test(raw)) return fallback;

    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      const decimal = lastComma > lastDot ? "," : ".";
      const thousands = decimal === "," ? /\./g : /,/g;
      raw = raw.replace(thousands, "");
      if (decimal === ",") raw = raw.replace(",", ".");
    } else if (lastComma >= 0) {
      raw = raw.replace(/,/g, (match, offset) =>
        offset === lastComma ? "." : "",
      );
    } else if ((raw.match(/\./g) || []).length > 1) {
      raw = raw.replace(/\./g, (match, offset) =>
        offset === lastDot ? "." : "",
      );
    }

    const number = Number(raw);
    if (!Number.isFinite(number)) return fallback;
    return parenthesized ? -Math.abs(number) : number;
  }

  function mt5Volume(value) {
    const first = String(value || "").split(/[\/|]/)[0];
    return Math.abs(mt5Number(first));
  }

  function mt5TradeType(value) {
    const normalized = normalizeMt5Text(value);
    if (
      normalized.includes("cancel") ||
      normalized.includes("canceled") ||
      normalized.includes("cancelled") ||
      normalized.includes("ملغي") ||
      normalized.includes("إلغاء")
    ) {
      return "";
    }
    if (
      normalized.includes("buy") ||
      normalized.includes("purchase") ||
      normalized.includes("شراء")
    ) {
      return "buy";
    }
    if (normalized.includes("sell") || normalized.includes("بيع")) {
      return "sell";
    }
    return "";
  }

  function mt5DealDirection(value) {
    const normalized = normalizeMt5Text(value);
    if (
      normalized.includes("inout") ||
      normalized.includes("outin") ||
      normalized.includes("دخولخروج") ||
      normalized.includes("خروجدخول")
    ) {
      return "inout";
    }
    if (normalized.includes("out") || normalized.includes("خروج")) return "out";
    if (normalized === "in" || normalized.includes("دخول")) return "in";
    return "";
  }

  function mt5ExitReason(comment) {
    const normalized = normalizeMt5Text(comment);
    if (
      normalized.includes("stoploss") ||
      normalized.startsWith("sl") ||
      normalized.includes("وقفالخسارة")
    ) {
      return "sl";
    }
    if (
      normalized.includes("takeprofit") ||
      normalized.startsWith("tp") ||
      normalized.includes("جنيالربح")
    ) {
      return "tp";
    }
    if (
      normalized.includes("stopout") ||
      normalized.includes("so") ||
      normalized.includes("إيقافإجباري")
    ) {
      return "sl";
    }
    return "other";
  }

  function mt5ExpandedCells(row) {
    const values = [];
    for (const cell of row.cells || []) {
      const value = String(cell.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const span = Math.max(1, Math.trunc(asNumber(cell.colSpan, 1)));
      values.push(value);
      for (let index = 1; index < span; index += 1) values.push("");
    }
    return values;
  }

  function mt5HeaderInfo(cells, section = "") {
    const fields = cells.map(mt5HeaderName);
    const recognized = fields.filter(Boolean);
    const has = (field) => fields.includes(field);
    const timeCount = fields.filter((field) =>
      ["time", "openTime", "closeTime"].includes(field),
    ).length;
    const priceCount = fields.filter((field) =>
      ["price", "openPrice", "closePrice"].includes(field),
    ).length;
    const isHeader =
      cells.length >= 5 &&
      recognized.length >= 4 &&
      has("symbol") &&
      has("type") &&
      (timeCount > 0 || has("position") || has("deal")) &&
      (has("profit") || has("direction") || has("deal") || has("position"));
    if (!isHeader) return null;

    let kind = "";
    if (has("deal") || has("direction") || section === "deals") {
      kind = "deals";
    } else if (
      has("position") &&
      (has("profit") ||
        has("closeTime") ||
        timeCount >= 2 ||
        priceCount >= 2 ||
        section === "positions")
    ) {
      kind = "positions";
    }
    return kind ? { fields, kind } : null;
  }

  function mt5FieldIndexes(header, names) {
    const wanted = new Set(Array.isArray(names) ? names : [names]);
    const indexes = [];
    header.forEach((field, index) => {
      if (wanted.has(field)) indexes.push(index);
    });
    return indexes;
  }

  function mt5Field(row, header, names, occurrence = 0) {
    const index = mt5FieldIndexes(header, names)[occurrence];
    return index == null ? "" : row[index] ?? "";
  }

  function mt5TimePair(row, header) {
    const generic = mt5FieldIndexes(header, "time");
    const openIndex =
      mt5FieldIndexes(header, "openTime")[0] ?? generic[0] ?? null;
    const closeIndex =
      mt5FieldIndexes(header, "closeTime")[0] ?? generic[1] ?? null;
    return {
      open: normalizeImportedDate(
        openIndex == null ? "" : asciiDigits(row[openIndex]),
      ),
      close: normalizeImportedDate(
        closeIndex == null ? "" : asciiDigits(row[closeIndex]),
      ),
    };
  }

  function mt5PricePair(row, header) {
    const generic = mt5FieldIndexes(header, "price");
    const openIndex =
      mt5FieldIndexes(header, "openPrice")[0] ?? generic[0] ?? null;
    const closeIndex =
      mt5FieldIndexes(header, "closePrice")[0] ?? generic[1] ?? null;
    return {
      open: openIndex == null ? null : mt5Number(row[openIndex], null),
      close: closeIndex == null ? null : mt5Number(row[closeIndex], null),
    };
  }

  function mt5RawFinancial(row, header) {
    return {
      profit: mt5Number(mt5Field(row, header, "profit")),
      commission: mt5Number(mt5Field(row, header, "commission")),
      fee: mt5Number(mt5Field(row, header, "fee")),
      swap: mt5Number(mt5Field(row, header, "swap")),
    };
  }

  function mt5FinancialParts(raw) {
    const feeContribution = asNumber(raw.commission) + asNumber(raw.fee);
    const feeCost = Math.max(0, -feeContribution);
    const feeCredit = Math.max(0, feeContribution);
    const swapCost = -(asNumber(raw.swap) + feeCredit);
    return {
      grossPnl: round(raw.profit, 2),
      fees: round(feeCost, 2),
      swap: round(swapCost, 2),
      netPnl: round(
        asNumber(raw.profit) + feeContribution + asNumber(raw.swap),
        2,
      ),
    };
  }

  function applyMt5FeeConvention(records) {
    const charges = records.flatMap((record) => [
      asNumber(record.rawFinancial?.commission),
      asNumber(record.rawFinancial?.fee),
    ]);
    const positiveCostConvention =
      charges.some((value) => value > 0) &&
      !charges.some((value) => value < 0);
    for (const record of records) {
      if (positiveCostConvention) {
        record.rawFinancial.commission =
          -Math.abs(record.rawFinancial.commission);
        record.rawFinancial.fee = -Math.abs(record.rawFinancial.fee);
      }
      record.financial = mt5FinancialParts(record.rawFinancial);
    }
    return positiveCostConvention;
  }

  function parseMt5PositionRow(row, header) {
    const times = mt5TimePair(row, header);
    const prices = mt5PricePair(row, header);
    const symbol = mt5Field(row, header, "symbol")
      .trim()
      .toUpperCase();
    const type = mt5TradeType(mt5Field(row, header, "type"));
    if (!times.open || !times.close || !symbol || !type) return null;
    const positionId =
      asciiDigits(mt5Field(row, header, ["position", "deal"])).trim() ||
      `${symbol}-${times.open}-${prices.open ?? ""}`;
    const comment = mt5Field(row, header, "comment").trim();
    return {
      positionKey: `position:${positionId}`,
      positionId,
      openTime: times.open,
      closeTime: times.close,
      symbol,
      direction: type === "sell" ? "short" : "long",
      size: mt5Volume(mt5Field(row, header, "volume")),
      entry: prices.open,
      exit: prices.close,
      stop: mt5Number(mt5Field(row, header, "sl"), null),
      target: mt5Number(mt5Field(row, header, "tp"), null),
      comment,
      exitReason: mt5ExitReason(comment),
      rawFinancial: mt5RawFinancial(row, header),
      inferred: false,
    };
  }

  function parseMt5DealRow(row, header) {
    const time = normalizeImportedDate(
      asciiDigits(mt5Field(row, header, ["time", "openTime", "closeTime"])),
    );
    const symbol = mt5Field(row, header, "symbol")
      .trim()
      .toUpperCase();
    const type = mt5TradeType(mt5Field(row, header, "type"));
    const dealId = asciiDigits(mt5Field(row, header, "deal")).trim();
    if (!time || !symbol || !type || !dealId) return null;
    const rawFinancial = mt5RawFinancial(row, header);
    let direction = mt5DealDirection(mt5Field(row, header, "direction"));
    if (!direction) direction = rawFinancial.profit !== 0 ? "out" : "in";
    return {
      dealId,
      orderId: asciiDigits(mt5Field(row, header, "order")).trim(),
      positionId: asciiDigits(mt5Field(row, header, "position")).trim(),
      time,
      symbol,
      type,
      direction,
      volume: mt5Volume(mt5Field(row, header, "volume")),
      price: mt5Number(mt5Field(row, header, "price"), null),
      stop: mt5Number(mt5Field(row, header, "sl"), null),
      target: mt5Number(mt5Field(row, header, "tp"), null),
      comment: mt5Field(row, header, "comment").trim(),
      rawFinancial,
    };
  }

  function weightedMt5Average(records, field, volumeField = "volume") {
    const valid = records.filter(
      (record) =>
        Number.isFinite(Number(record[field])) &&
        asNumber(record[volumeField]) > 0,
    );
    const total = valid.reduce(
      (sum, record) => sum + asNumber(record[volumeField]),
      0,
    );
    if (!total) return null;
    return round(
      valid.reduce(
        (sum, record) =>
          sum + asNumber(record[field]) * asNumber(record[volumeField]),
        0,
      ) / total,
      8,
    );
  }

  function summarizeMt5DealGroup(group, inferred = false) {
    const deals = [...group.deals].sort(
      (left, right) => new Date(left.time) - new Date(right.time),
    );
    const entries = deals.filter((deal) => deal.direction === "in");
    const exits = deals.filter(
      (deal) => deal.direction === "out" || deal.direction === "inout",
    );
    if (!exits.length) return null;
    const firstEntry = entries[0] || deals[0];
    const lastExit = exits.at(-1);
    const directionType =
      firstEntry?.direction === "in"
        ? firstEntry.type
        : lastExit.type === "buy"
          ? "sell"
          : "buy";
    const rawFinancial = deals.reduce(
      (total, deal) => ({
        profit: total.profit + asNumber(deal.rawFinancial.profit),
        commission:
          total.commission + asNumber(deal.rawFinancial.commission),
        fee: total.fee + asNumber(deal.rawFinancial.fee),
        swap: total.swap + asNumber(deal.rawFinancial.swap),
      }),
      { profit: 0, commission: 0, fee: 0, swap: 0 },
    );
    const comments = uniqueList(
      deals.map((deal) => deal.comment).filter(Boolean),
      [],
    );
    const closedVolume = exits.reduce(
      (sum, deal) => sum + asNumber(deal.volume),
      0,
    );
    return {
      positionKey: group.positionKey,
      positionId: group.positionId || "",
      openTime: firstEntry.time,
      closeTime: lastExit.time,
      symbol: firstEntry.symbol || lastExit.symbol,
      direction: directionType === "sell" ? "short" : "long",
      size: round(closedVolume, 4),
      entry: weightedMt5Average(entries.length ? entries : [firstEntry], "price"),
      exit: weightedMt5Average(exits, "price"),
      stop:
        [...exits, ...entries].reverse().find((deal) => deal.stop)?.stop ?? null,
      target:
        [...exits, ...entries].reverse().find((deal) => deal.target)?.target ??
        null,
      comment: comments.join(" · "),
      exitReason: mt5ExitReason(lastExit.comment),
      rawFinancial,
      financial: mt5FinancialParts(rawFinancial),
      inferred,
    };
  }

  function groupExplicitMt5Deals(deals) {
    const groups = new Map();
    const unlinked = [];
    for (const deal of deals) {
      if (!deal.positionId || deal.positionId === "0") {
        unlinked.push(deal);
        continue;
      }
      const key = `position:${deal.positionId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          positionKey: key,
          positionId: deal.positionId,
          deals: [],
        });
      }
      groups.get(key).deals.push(deal);
    }
    return {
      positions: [...groups.values()]
        .map((group) => summarizeMt5DealGroup(group, false))
        .filter(Boolean),
      unlinked,
    };
  }

  function groupInferredMt5Deals(deals) {
    const openGroups = [];
    const allGroups = [];
    const sorted = [...deals].sort(
      (left, right) => new Date(left.time) - new Date(right.time),
    );

    const addOpenGroup = (deal, volume = deal.volume) => {
      const keyBase = deal.orderId || deal.dealId;
      const sameOrder = openGroups.find(
        (group) =>
          group.positionKey === `inferred:${keyBase}` &&
          group.symbol === deal.symbol &&
          group.directionType === deal.type,
      );
      if (sameOrder) {
        sameOrder.remaining += volume;
        sameOrder.deals.push({ ...deal, volume });
        return sameOrder;
      }
      const group = {
        positionKey: `inferred:${keyBase}`,
        positionId: "",
        symbol: deal.symbol,
        directionType: deal.type,
        remaining: volume,
        deals: [{ ...deal, volume }],
      };
      openGroups.push(group);
      allGroups.push(group);
      return group;
    };

    for (const deal of sorted) {
      if (!deal.volume) continue;
      if (deal.direction === "in") {
        addOpenGroup(deal);
        continue;
      }

      const positionType = deal.type === "buy" ? "sell" : "buy";
      let remainingExit = deal.volume;
      const candidates = openGroups.filter(
        (group) =>
          group.symbol === deal.symbol &&
          group.directionType === positionType &&
          group.remaining > 0,
      );

      for (const group of candidates) {
        if (remainingExit <= 0) break;
        const allocated = Math.min(group.remaining, remainingExit);
        const ratio = deal.volume ? allocated / deal.volume : 0;
        group.deals.push({
          ...deal,
          volume: allocated,
          rawFinancial: {
            profit: deal.rawFinancial.profit * ratio,
            commission: deal.rawFinancial.commission * ratio,
            fee: deal.rawFinancial.fee * ratio,
            swap: deal.rawFinancial.swap * ratio,
          },
        });
        group.remaining = round(group.remaining - allocated, 6);
        remainingExit = round(remainingExit - allocated, 6);
      }

      if (remainingExit > 0) {
        const ratio = remainingExit / deal.volume;
        allGroups.push({
          positionKey: `inferred-close:${deal.dealId}`,
          positionId: "",
          symbol: deal.symbol,
          directionType: positionType,
          remaining: 0,
          deals: [
            {
              ...deal,
              volume: remainingExit,
              rawFinancial: {
                profit: deal.rawFinancial.profit * ratio,
                commission: deal.rawFinancial.commission * ratio,
                fee: deal.rawFinancial.fee * ratio,
                swap: deal.rawFinancial.swap * ratio,
              },
            },
          ],
        });
      }

      if (deal.direction === "inout" && remainingExit > 0) {
        addOpenGroup({ ...deal, direction: "in" }, remainingExit);
      }
    }

    return allGroups
      .map((group) => summarizeMt5DealGroup(group, true))
      .filter(Boolean);
  }

  function extractMt5Metadata(documentNode) {
    const text = asciiDigits(
      String(documentNode.documentElement?.textContent || ""),
    )
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ");
    const oneLine = text.replace(/\s+/g, " ");
    const match = (patterns) => {
      for (const pattern of patterns) {
        const result = oneLine.match(pattern);
        if (result?.[1]) return result[1].trim();
      }
      return "";
    };
    const account = match([
      /\baccount(?:\s*(?:number|no\.?))?\s*[:#]?\s*(\d{4,})/i,
      /(?:الحساب|رقم الحساب)\s*[:#]?\s*(\d{4,})/i,
    ]);
    const currency = match([
      /\bcurrency\s*[:#]?\s*([A-Z]{3})\b/i,
      /(?:العملة)\s*[:#]?\s*([A-Z]{3})\b/i,
    ]).toUpperCase();
    const server = match([
      /\bserver\s*[:#]?\s*([^|]{2,80}?)(?=\s{2,}|account|name|currency|$)/i,
      /(?:الخادم|السيرفر)\s*[:#]?\s*([^|]{2,80}?)(?=\s{2,}|الحساب|الاسم|العملة|$)/i,
    ]);
    const broker = match([
      /\b(?:company|broker)\s*[:#]?\s*([^|]{2,80}?)(?=\s{2,}|account|name|currency|server|$)/i,
      /(?:الشركة|الوسيط)\s*[:#]?\s*([^|]{2,80}?)(?=\s{2,}|الحساب|الاسم|العملة|الخادم|$)/i,
    ]);
    const generatedAt = normalizeImportedDate(
      match([
        /\b(?:report date|created|date)\s*[:#]?\s*(\d{4}[./]\d{1,2}[./]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
        /(?:تاريخ التقرير|تاريخ الإنشاء)\s*[:#]?\s*(\d{4}[./]\d{1,2}[./]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
      ]),
    );
    return { account, currency, server, broker, generatedAt };
  }

  function scanMt5Report(documentNode) {
    let section = "";
    let activeHeader = null;
    const positionRows = [];
    const dealRows = [];

    for (const rowNode of documentNode.querySelectorAll("tr")) {
      const cells = mt5ExpandedCells(rowNode);
      const nonEmpty = cells.filter(Boolean);
      if (!nonEmpty.length) continue;
      if (nonEmpty.length <= 2) {
        const detectedSection = mt5SectionName(nonEmpty.join(" "));
        if (detectedSection) {
          section = detectedSection;
          activeHeader = null;
          continue;
        }
      }

      const header = mt5HeaderInfo(cells, section);
      if (header) {
        activeHeader = header;
        continue;
      }
      if (!activeHeader) continue;

      if (activeHeader.kind === "positions") {
        const position = parseMt5PositionRow(cells, activeHeader.fields);
        if (position) positionRows.push(position);
      } else if (activeHeader.kind === "deals") {
        const deal = parseMt5DealRow(cells, activeHeader.fields);
        if (deal) dealRows.push(deal);
      }
    }

    return { positionRows, dealRows };
  }

  function decodeMt5ReportBuffer(buffer) {
    if (typeof TextDecoder === "undefined") return "";
    const bytes = new Uint8Array(buffer);
    let encoding = "utf-8";
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
    else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      encoding = "utf-8";
    } else {
      const probe = new TextDecoder("windows-1252").decode(
        bytes.slice(0, 4096),
      );
      const declared = probe.match(
        /charset\s*=\s*["']?\s*([a-z0-9._-]+)/i,
      )?.[1];
      if (declared) {
        const aliases = {
          utf8: "utf-8",
          "utf-8": "utf-8",
          windows1252: "windows-1252",
          "windows-1252": "windows-1252",
          windows1256: "windows-1256",
          "windows-1256": "windows-1256",
          windows1251: "windows-1251",
          "windows-1251": "windows-1251",
          "iso-8859-1": "windows-1252",
        };
        encoding = aliases[declared.toLowerCase()] || declared;
      }
    }
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }

  async function readMt5Report(file) {
    if (asNumber(file.size) > 20_000_000) {
      throw new Error("حجم تقرير MT5 أكبر من 20MB.");
    }
    if (typeof file.arrayBuffer === "function") {
      const decoded = decodeMt5ReportBuffer(await file.arrayBuffer());
      if (decoded) return decoded;
    }
    return file.text();
  }

  function mt5ExternalId(accountReference, positionKey) {
    const account = String(accountReference || "unknown").replace(/\s+/g, "");
    return `mt5:${account}:${positionKey}`;
  }

  function dedupeMt5ParsedTrades(trades) {
    const unique = new Map();
    for (const trade of trades) {
      const current = unique.get(trade.positionKey);
      if (
        !current ||
        new Date(trade.closeTime).getTime() >=
          new Date(current.closeTime).getTime()
      ) {
        unique.set(trade.positionKey, trade);
      }
    }
    return [...unique.values()].sort(
      (left, right) =>
        new Date(left.closeTime).getTime() - new Date(right.closeTime).getTime(),
    );
  }

  async function parseMt5HtmlReport(file) {
    const html = await readMt5Report(file);
    if (!/<(?:html|table|tr)\b/i.test(html)) {
      throw new Error("الملف ليس تقرير HTML صادرًا من MT5.");
    }
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const metadata = extractMt5Metadata(documentNode);
    const scanned = scanMt5Report(documentNode);
    const warnings = [];
    let trades = [];
    let format = "";

    if (scanned.positionRows.length) {
      applyMt5FeeConvention(scanned.positionRows);
      trades = scanned.positionRows;
      format = "Positions";
    } else if (scanned.dealRows.length) {
      applyMt5FeeConvention(scanned.dealRows);
      const explicit = groupExplicitMt5Deals(scanned.dealRows);
      const inferred = groupInferredMt5Deals(explicit.unlinked);
      trades = [...explicit.positions, ...inferred];
      format = "Deals";
      if (inferred.length) {
        warnings.push(
          "بعض الصفقات لا تحتوي رقم Position في التقرير؛ جُمعت من تسلسل الدخول والخروج ويجب مراجعة المعاينة.",
        );
      }
    }

    trades = dedupeMt5ParsedTrades(trades);
    if (!trades.length) {
      throw new Error(
        "لم أجد صفقات مغلقة في التقرير. من MT5 اختر History ثم All History واحفظ التقرير بصيغة HTML.",
      );
    }
    const accountReference = metadata.account || "unknown";
    trades = trades.map((trade) => ({
      ...trade,
      externalId: mt5ExternalId(accountReference, trade.positionKey),
    }));
    return {
      fileName: file.name || "MT5 report",
      metadata,
      format,
      warnings,
      trades,
      raw: {
        positions: scanned.positionRows.length,
        deals: scanned.dealRows.length,
      },
    };
  }

  function mt5ImportedTrade(raw, accountId, existing = null) {
    const importedNotes = raw.comment ? `تعليق MT5: ${raw.comment}` : "";
    const preserved = existing
      ? {
          id: existing.id,
          setupId: existing.setupId,
          reason: existing.reason,
          riskAmount: existing.riskAmount,
          grade: existing.grade,
          emotion: existing.emotion,
          rulesFollowed: existing.rulesFollowed,
          mistakes: existing.mistakes,
          confluences: existing.confluences,
          notes: existing.notes || importedNotes,
          lesson: existing.lesson,
          screenshot: existing.screenshot,
          maeR: existing.maeR,
          mfeR: existing.mfeR,
          createdAt: existing.createdAt,
        }
      : {
          id: uid(),
          grade: "B",
          emotion: "هادئ",
          rulesFollowed: "yes",
          notes: importedNotes,
        };
    return normalizeTrade(
      {
        ...preserved,
        accountId,
        date: raw.openTime,
        closeDate: raw.closeTime,
        symbol: raw.symbol,
        direction: raw.direction,
        session: state.settings.defaultSession,
        timeframe: existing?.timeframe || "M5",
        source: "mt5",
        entry: raw.entry,
        stop: raw.stop,
        target: raw.target,
        exit: raw.exit,
        size: raw.size,
        resultMode: "money",
        grossPnl: raw.financial.grossPnl,
        fees: raw.financial.fees,
        swap: raw.financial.swap,
        exitReason: raw.exitReason,
        externalId: raw.externalId,
        updatedAt: new Date().toISOString(),
      },
      state.accounts,
    );
  }

  function mt5ExecutionSignature(trade) {
    return [
      trade.accountId,
      trade.externalId,
      trade.date,
      trade.closeDate,
      trade.symbol,
      trade.direction,
      round(trade.size, 4),
      round(trade.entry, 8),
      round(trade.exit, 8),
      round(trade.grossPnl, 2),
      round(trade.fees, 2),
      round(trade.swap, 2),
      round(trade.netPnl, 2),
    ].join("|");
  }

  function mt5FallbackFingerprint(trade) {
    return [
      trade.accountId,
      trade.date,
      trade.closeDate,
      trade.symbol,
      trade.direction,
      round(trade.size, 4),
      round(trade.entry, 8),
      round(trade.exit, 8),
      round(trade.netPnl, 2),
    ].join("|");
  }

  function mt5ImportCandidates(accountId, updateExisting) {
    if (!pendingMt5Import) return [];
    const existingExternal = new Map(
      state.trades
        .filter((trade) => trade.accountId === accountId && trade.externalId)
        .map((trade) => [trade.externalId, trade]),
    );
    const fingerprints = new Set(
      state.trades
        .filter((trade) => trade.accountId === accountId)
        .map(mt5FallbackFingerprint),
    );

    return pendingMt5Import.trades.map((raw) => {
      const existing = existingExternal.get(raw.externalId) || null;
      const draft = mt5ImportedTrade(raw, accountId, existing);
      let status = "new";
      if (existing) {
        status =
          mt5ExecutionSignature(existing) === mt5ExecutionSignature(draft)
            ? "skip"
            : updateExisting
              ? "update"
              : "skip";
      } else if (fingerprints.has(mt5FallbackFingerprint(draft))) {
        status = "skip";
      }
      return { raw, existing, draft, status };
    });
  }

  function mt5DisplayTime(value) {
    return String(value || "").replace("T", " ").slice(0, 16);
  }

  function renderMt5ImportPreview() {
    if (!pendingMt5Import) return;
    const accountId =
      $("#mt5TargetAccount").value ||
      state.settings.defaultAccountId ||
      state.accounts[0]?.id;
    const updateExisting = $("#mt5UpdateExisting").checked;
    const candidates = mt5ImportCandidates(accountId, updateExisting);
    const counts = candidates.reduce(
      (summary, candidate) => {
        summary[candidate.status] += 1;
        return summary;
      },
      { new: 0, update: 0, skip: 0 },
    );
    const actionable = candidates.filter(
      (candidate) => candidate.status !== "skip",
    );
    const net = actionable.reduce(
      (sum, candidate) => sum + tradeNet(candidate.draft),
      0,
    );
    const { metadata } = pendingMt5Import;
    const metaItems = [
      ["الحساب في MT5", metadata.account || "غير ظاهر"],
      ["العملة", metadata.currency || "غير ظاهرة"],
      ["نوع السجل", pendingMt5Import.format],
      ["الصفقات المقروءة", String(pendingMt5Import.trades.length)],
    ];
    $("#mt5ReportMeta").innerHTML = metaItems
      .map(
        ([label, value]) => `
          <div class="mt5-meta-item">
            <span>${escapeHtml(label)}</span>
            <b>${escapeHtml(value)}</b>
          </div>`,
      )
      .join("");

    const warnings = [...pendingMt5Import.warnings];
    if (
      metadata.currency &&
      state.settings.currency &&
      metadata.currency !== state.settings.currency
    ) {
      warnings.push(
        `عملة التقرير ${metadata.currency} تختلف عن عملة التطبيق ${state.settings.currency}.`,
      );
    }
    $("#mt5ImportWarnings").hidden = !warnings.length;
    $("#mt5ImportWarnings").innerHTML = warnings.length
      ? `<ul>${warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join("")}</ul>`
      : "";
    $("#mt5ImportSummary").innerHTML = [
      `<span class="summary-pill">جديدة <b>${counts.new}</b></span>`,
      `<span class="summary-pill">تحديث <b>${counts.update}</b></span>`,
      `<span class="summary-pill">مكررة <b>${counts.skip}</b></span>`,
      `<span class="summary-pill">الصافي <b>${escapeHtml(
        formatMoney(net),
      )}</b></span>`,
    ].join("");

    const statusLabel = {
      new: ["جديدة", "new"],
      update: ["تحديث", "update"],
      skip: ["مكررة", "skip"],
    };
    $("#mt5ImportPreview").innerHTML = candidates
      .slice(0, 150)
      .map((candidate) => {
        const [label, tone] = statusLabel[candidate.status];
        const trade = candidate.draft;
        return `
          <tr>
            <td><span class="mt5-import-status ${tone}">${label}</span></td>
            <td>${escapeHtml(mt5DisplayTime(trade.date))}</td>
            <td>${escapeHtml(mt5DisplayTime(trade.closeDate))}</td>
            <td>${escapeHtml(trade.symbol)}</td>
            <td>${trade.direction === "short" ? "بيع" : "شراء"}</td>
            <td>${escapeHtml(round(trade.size, 4))}</td>
            <td class="${resultTone(tradeNet(trade))}">${escapeHtml(
              formatMoney(tradeNet(trade)),
            )}</td>
          </tr>`;
      })
      .join("");
    $("#mt5ImportEmpty").hidden = candidates.length > 0;
    $("#confirmMt5Import").disabled = actionable.length === 0;
    $("#confirmMt5Import").textContent = actionable.length
      ? `استيراد ${actionable.length} صفقة`
      : "لا توجد صفقات جديدة";
  }

  function openMt5ImportPreview(report) {
    pendingMt5Import = report;
    $("#mt5ImportFileName").textContent = report.fileName;
    fillSelect($("#mt5TargetAccount"), state.accounts, {
      value: state.settings.defaultAccountId,
      map: (account) => ({
        value: account.id,
        label: `${account.emoji} ${account.name}`,
      }),
    });
    $("#mt5UpdateExisting").checked = true;
    renderMt5ImportPreview();
    $("#mt5ImportDialog").showModal();
  }

  async function commitMt5Import(event) {
    event.preventDefault();
    if (!pendingMt5Import) return;
    const accountId = $("#mt5TargetAccount").value;
    const candidates = mt5ImportCandidates(
      accountId,
      $("#mt5UpdateExisting").checked,
    );
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    for (const candidate of candidates) {
      if (candidate.status === "new") {
        state.trades.push(candidate.draft);
        imported += 1;
      } else if (candidate.status === "update" && candidate.existing) {
        const index = state.trades.findIndex(
          (trade) => trade.id === candidate.existing.id,
        );
        if (index >= 0) {
          state.trades[index] = candidate.draft;
          updated += 1;
        }
      } else {
        skipped += 1;
      }
    }
    await persistState();
    render();
    $("#mt5ImportDialog").close();
    pendingMt5Import = null;
    go("trades");
    toast(
      `تم استيراد ${imported} صفقة${
        updated ? ` · تحديث ${updated}` : ""
      }${skipped ? ` · تخطي ${skipped}` : ""}`,
    );
  }

  function download(name, data, type) {
    const anchor = document.createElement("a");
    const url = URL.createObjectURL(new Blob([data], { type }));
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv() {
    const headers = [
      "id",
      "account",
      "date",
      "closeDate",
      "symbol",
      "direction",
      "session",
      "timeframe",
      "source",
      "setup",
      "reason",
      "entry",
      "stop",
      "target",
      "exit",
      "size",
      "riskAmount",
      "riskPct",
      "resultR",
      "grossPnl",
      "fees",
      "swap",
      "netPnl",
      "pnlPct",
      "grade",
      "emotion",
      "rulesFollowed",
      "exitReason",
      "mistakes",
      "confluences",
      "notes",
      "lesson",
    ];
    const rows = state.trades.map((trade) => [
      trade.id,
      accountById(trade.accountId)?.name || "",
      trade.date,
      trade.closeDate,
      trade.symbol,
      trade.direction,
      trade.session,
      trade.timeframe,
      trade.source,
      playbookById(trade.setupId)?.name || "",
      trade.reason,
      trade.entry ?? "",
      trade.stop ?? "",
      trade.target ?? "",
      trade.exit ?? "",
      trade.size ?? "",
      trade.riskAmount,
      trade.riskPct,
      trade.resultR,
      trade.grossPnl,
      trade.fees,
      trade.swap,
      trade.netPnl,
      trade.pnlPct,
      trade.grade,
      trade.emotion,
      trade.rulesFollowed,
      trade.exitReason,
      trade.mistakes.join(" | "),
      trade.confluences.join(" | "),
      trade.notes,
      trade.lesson,
    ]);
    const csv =
      "\uFEFF" +
      [headers, ...rows].map((row) => row.map(csvSafe).join(",")).join("\n");
    download(`jan-trade-${todayKey()}.csv`, csv, "text/csv;charset=utf-8");
    toast("تم تصدير CSV");
  }

  async function importCsv(file) {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("ملف CSV فارغ.");
    const headers = rows[0].map(normalizedHeader);
    let imported = 0;
    let skipped = 0;
    const existingIds = new Set(state.trades.map((trade) => trade.id));
    const externalIds = new Set(
      state.trades.map((trade) => trade.externalId).filter(Boolean),
    );
    const fingerprints = new Set(
      state.trades.map(
        (trade) =>
          `${trade.accountId}|${trade.date}|${trade.symbol}|${
            trade.direction
          }|${trade.size ?? ""}|${trade.entry ?? ""}|${trade.exit ?? ""}|${round(
            tradeNet(trade),
            2,
          )}`,
      ),
    );

    for (const row of rows.slice(1)) {
      const date = normalizeImportedDate(
        csvField(row, headers, ["date", "datetime", "opentime", "entrytime"]),
      );
      const symbol = csvField(row, headers, ["symbol", "pair", "instrument"]);
      if (!date || !symbol) {
        skipped += 1;
        continue;
      }
      const accountName = csvField(row, headers, ["account", "accountname"]);
      const account =
        state.accounts.find(
          (item) => item.name.toLowerCase() === accountName.toLowerCase(),
        ) ||
        accountById(state.settings.defaultAccountId) ||
        state.accounts[0];
      const netField = csvField(row, headers, [
        "netpnl",
        "netprofit",
        "pnl",
        "profit",
      ]);
      const percentField = csvField(row, headers, [
        "pnlpct",
        "percent",
        "return",
      ]);
      const resultRField = csvField(row, headers, ["resultr", "r", "rr"]);
      const riskField = csvField(row, headers, [
        "riskamount",
        "risk",
        "riskusd",
      ]);
      const feesField = Math.max(
        0,
        asNumber(csvField(row, headers, ["fees", "commission"])),
      );
      const swapField = asNumber(csvField(row, headers, ["swap"]));
      let resultMode = "r";
      if (netField !== "") resultMode = "money";
      else if (percentField !== "") resultMode = "percent";
      if (
        netField === "" &&
        percentField === "" &&
        (riskField === "" || resultRField === "")
      ) {
        skipped += 1;
        continue;
      }
      const explicitNet = headers.some((header) =>
        ["netpnl", "netprofit"].includes(header),
      );
      const importedGross =
        asNumber(netField) + (explicitNet ? feesField + swapField : 0);
      const importedId =
        csvField(row, headers, ["id", "ticket", "deal"]) || uid();
      const externalId = csvField(row, headers, [
        "ticket",
        "deal",
        "positionid",
      ]);
      if (
        existingIds.has(importedId) ||
        (externalId && externalIds.has(externalId))
      ) {
        skipped += 1;
        continue;
      }

      const draft = normalizeTrade(
        {
          id: importedId,
          externalId,
          accountId: account.id,
          date,
          closeDate: normalizeImportedDate(
            csvField(row, headers, ["closedate", "closetime", "exittime"]),
          ),
          symbol,
          direction: csvField(row, headers, ["direction", "side", "type"]),
          session:
            csvField(row, headers, ["session"]) ||
            state.settings.defaultSession,
          timeframe: csvField(row, headers, ["timeframe", "tf"]) || "M5",
          source: "csv",
          reason: csvField(row, headers, ["reason", "setup"]),
          entry: csvField(row, headers, ["entry", "entryprice"]),
          stop: csvField(row, headers, ["stop", "sl", "stoploss"]),
          target: csvField(row, headers, ["target", "tp", "takeprofit"]),
          exit: csvField(row, headers, ["exit", "exitprice"]),
          size: csvField(row, headers, ["size", "lots", "volume"]),
          resultMode,
          riskAmount: asNumber(riskField),
          resultR: asNumber(resultRField),
          grossPnl: importedGross,
          pnlPct: asNumber(percentField),
          fees: feesField,
          swap: swapField,
          grade: csvField(row, headers, ["grade", "quality"]) || "B",
          emotion: csvField(row, headers, ["emotion", "psychology"]) || "هادئ",
          rulesFollowed:
            csvField(row, headers, ["rulesfollowed", "compliance"]) || "yes",
          mistakes: uniqueList(
            csvField(row, headers, ["mistakes", "tags"]).split(/[|;]/),
            [],
          ),
          notes: csvField(row, headers, ["notes", "comment"]),
        },
        state.accounts,
      );
      const fingerprint = `${draft.accountId}|${draft.date}|${draft.symbol}|${
        draft.direction
      }|${draft.size ?? ""}|${draft.entry ?? ""}|${draft.exit ?? ""}|${round(
        tradeNet(draft),
        2,
      )}`;
      if (fingerprints.has(fingerprint)) {
        skipped += 1;
        continue;
      }
      fingerprints.add(fingerprint);
      existingIds.add(draft.id);
      if (draft.externalId) externalIds.add(draft.externalId);
      state.trades.push(draft);
      imported += 1;
    }
    await persistState();
    render();
    toast(`تم استيراد ${imported} صفقة${skipped ? ` · تخطي ${skipped}` : ""}`);
  }

  function exportBackup(settingsOnly = false) {
    const payload = settingsOnly
      ? {
          app: "Jan Trade",
          version: APP_VERSION,
          type: "settings",
          exportedAt: new Date().toISOString(),
          data: {
            settings: state.settings,
            accounts: state.accounts,
            playbooks: state.playbooks,
          },
        }
      : {
          app: "Jan Trade",
          version: APP_VERSION,
          type: "full",
          exportedAt: new Date().toISOString(),
          data: state,
        };
    download(
      `jan-trade-${settingsOnly ? "settings" : "backup"}-${todayKey()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    toast(settingsOnly ? "تم تصدير الإعدادات" : "تم تنزيل النسخة الكاملة");
  }

  async function restoreBackup(file) {
    const parsed = JSON.parse(await file.text());
    if (parsed.type === "settings" && parsed.data?.settings) {
      if (!window.confirm("استبدال إعدادات الحسابات والقوائم الحالية؟")) return;
      const accounts = (parsed.data.accounts || state.accounts).map(
        normalizeAccount,
      );
      const referencedAccountIds = new Set(
        state.trades.map((trade) => trade.accountId),
      );
      const preservedAccounts = state.accounts.filter(
        (account) =>
          referencedAccountIds.has(account.id) &&
          !accounts.some((imported) => imported.id === account.id),
      );
      state.accounts = accounts.length
        ? [...accounts, ...preservedAccounts]
        : state.accounts;
      const playbooks = (parsed.data.playbooks || state.playbooks).map(
        normalizePlaybook,
      );
      const referencedPlaybookIds = new Set(
        state.trades.map((trade) => trade.setupId).filter(Boolean),
      );
      const preservedPlaybooks = state.playbooks.filter(
        (playbook) =>
          referencedPlaybookIds.has(playbook.id) &&
          !playbooks.some((imported) => imported.id === playbook.id),
      );
      state.playbooks = [...playbooks, ...preservedPlaybooks];
      state.settings = mergeSettings(parsed.data.settings, state.accounts);
    } else {
      const data = parsed.data || parsed;
      const recognized =
        data &&
        typeof data === "object" &&
        Array.isArray(data.trades) &&
        (Array.isArray(data.accounts) ||
          data.app === "Jan Trade" ||
          (data.settings &&
            Number.isFinite(Number(data.settings.initialBalance))));
      if (!recognized) {
        throw new Error("النسخة لا تحتوي بنية بيانات Jan Trade معروفة.");
      }
      const migrated = migrateState(data);
      if (
        !Array.isArray(migrated.trades) ||
        !Array.isArray(migrated.accounts)
      ) {
        throw new Error("النسخة غير صالحة.");
      }
      if (!window.confirm("استبدال جميع البيانات الحالية بهذه النسخة؟")) return;
      state = migrated;
    }
    applyPreferences();
    await persistState();
    render();
    toast("تمت استعادة النسخة بنجاح");
  }

  function go(page) {
    $$(".nav").forEach((nav) =>
      nav.classList.toggle("active", nav.dataset.page === page),
    );
    $$(".page").forEach((section) =>
      section.classList.toggle("active", section.id === `${page}Page`),
    );
    const meta = PAGE_META[page] || PAGE_META.dashboard;
    $("#pageTitle").textContent = meta[0];
    $("#pageSub").textContent = meta[1];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindEvents() {
    $("#nav").onclick = (event) => {
      const button = event.target.closest(".nav");
      if (button) go(button.dataset.page);
    };
    $$("[data-go]").forEach(
      (button) => (button.onclick = () => go(button.dataset.go)),
    );
    $("#addTradeBtn").onclick = $("#mobileAdd").onclick = () => openTrade();
    $("#addPlaybookBtn").onclick = () => openPlaybook();
    $("#addAccountBtn").onclick = () => openAccount();
    $$("[data-close]").forEach((button) => {
      button.onclick = () => {
        const dialog = $(`#${button.dataset.close}`);
        if (dialog?.open) dialog.close();
      };
    });

    $("#tradeForm").addEventListener("submit", saveTradeFromForm);
    $("#playbookForm").addEventListener("submit", savePlaybook);
    $("#accountForm").addEventListener("submit", saveAccount);
    $("#mt5ImportForm").addEventListener("submit", commitMt5Import);

    $("#tradeAccount").onchange = () => {
      const account = accountById($("#tradeAccount").value);
      if (!$("#tradeId").value && account) {
        $("#riskPct").value = account.defaultRiskPct;
        $("#riskAmount").value = round(
          (account.balance * account.defaultRiskPct) / 100,
          2,
        );
      }
      updateCopyGroupHint();
      calculateFormResult();
    };
    $("#resultMode").onchange = () => {
      updateResultFields();
      calculateFormResult();
    };
    $("#riskAmount").oninput = () => syncRiskFields("amount");
    $("#riskPct").oninput = () => syncRiskFields("percent");
    [
      "resultR",
      "grossPnl",
      "pnlPct",
      "fees",
      "swap",
      "tradeDate",
      "session",
    ].forEach((id) => {
      $(`#${id}`).addEventListener("input", calculateFormResult);
      $(`#${id}`).addEventListener("change", calculateFormResult);
    });

    $("#screenshot").onchange = async (event) => {
      try {
        $("#imageStatus").textContent = "جارٍ ضغط الصورة…";
        currentImage = await compressImage(event.target.files[0]);
        $("#imageStatus").textContent = "تمت إضافة الصورة وضغطها.";
        updateImagePreview();
      } catch (error) {
        currentImage = "";
        event.target.value = "";
        $("#imageStatus").textContent = "تعذر إضافة الصورة.";
        updateImagePreview();
        toast(error.message, "error");
      }
    };
    $("#removeImageBtn").onclick = () => {
      currentImage = "";
      $("#screenshot").value = "";
      $("#imageStatus").textContent = "تمت إزالة الصورة.";
      updateImagePreview();
    };

    $("#accountFilter").onchange = render;
    ["tradeSearch", "resultFilter", "sessionFilter", "gradeFilter"].forEach(
      (id) => {
        $(`#${id}`).addEventListener(
          id === "tradeSearch" ? "input" : "change",
          renderTrades,
        );
      },
    );
    ["dateFromFilter", "dateToFilter"].forEach((id) => {
      $(`#${id}`).onchange = renderTrades;
    });
    $("#clearTradeFilters").onclick = () => {
      $("#tradeSearch").value = "";
      $("#resultFilter").value = "all";
      $("#sessionFilter").value = "all";
      $("#gradeFilter").value = "all";
      $("#dateFromFilter").value = "";
      $("#dateToFilter").value = "";
      renderTrades();
    };

    $$("[data-range]").forEach((button) => {
      button.classList.toggle("active", button.dataset.range === chartRange);
      button.onclick = async () => {
        $$("[data-range]").forEach((item) =>
          item.classList.toggle("active", item === button),
        );
        chartRange = button.dataset.range;
        state.settings.dashboardRange = chartRange;
        await persistState({ quiet: true });
        drawEquity(metrics());
      };
    });
    $("#prevMonth").onclick = () => {
      calendarDate.setMonth(calendarDate.getMonth() - 1);
      renderCalendar();
    };
    $("#nextMonth").onclick = () => {
      calendarDate.setMonth(calendarDate.getMonth() + 1);
      renderCalendar();
    };
    ["analyticsFrom", "analyticsTo"].forEach((id) => {
      $(`#${id}`).onchange = renderAnalytics;
    });
    $("#resetAnalyticsDates").onclick = () => {
      $("#analyticsFrom").value = "";
      $("#analyticsTo").value = "";
      renderAnalytics();
    };

    $("#mt5ReportImportBtn").onclick = () => $("#mt5ReportFile").click();
    $("#mt5ReportFile").onchange = async (event) => {
      try {
        if (event.target.files[0]) {
          toast("جارٍ قراءة تقرير MT5…");
          const report = await parseMt5HtmlReport(event.target.files[0]);
          openMt5ImportPreview(report);
        }
      } catch (error) {
        toast(error.message || "تقرير MT5 غير صالح.", "error");
      }
      event.target.value = "";
    };
    $("#mt5TargetAccount").onchange = renderMt5ImportPreview;
    $("#mt5UpdateExisting").onchange = renderMt5ImportPreview;

    $("#csvExportBtn").onclick = exportCsv;
    $("#csvImportBtn").onclick = () => $("#csvFile").click();
    $("#csvFile").onchange = async (event) => {
      try {
        if (event.target.files[0]) await importCsv(event.target.files[0]);
      } catch (error) {
        toast(error.message || "ملف CSV غير صالح.", "error");
      }
      event.target.value = "";
    };

    $("#backupBtn").onclick = () => exportBackup(false);
    $("#exportSettingsBtn").onclick = () => exportBackup(true);
    $("#restoreBtn").onclick = () => $("#restoreFile").click();
    $("#restoreFile").onchange = async (event) => {
      try {
        if (event.target.files[0]) await restoreBackup(event.target.files[0]);
      } catch (error) {
        toast(error.message || "النسخة غير صالحة.", "error");
      }
      event.target.value = "";
    };
    $("#wipeBtn").onclick = async () => {
      if (
        !window.confirm(
          "سيتم حذف جميع الصفقات والحسابات والصور من هذا الجهاز. هل أنت متأكد؟",
        )
      ) {
        return;
      }
      if (!window.confirm("تأكيد أخير: لا يمكن التراجع دون نسخة احتياطية.")) {
        return;
      }
      state = seedState();
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
      await persistState();
      applyPreferences();
      render();
      toast("تم حذف البيانات");
    };

    $("#preferencesForm").onsubmit = async (event) => {
      event.preventDefault();
      state.settings.currency = $("#prefCurrency").value;
      state.settings.defaultAccountId = $("#prefDefaultAccount").value;
      state.settings.defaultSession = $("#prefDefaultSession").value;
      state.settings.copyMode = $("#prefCopyMode").value;
      state.settings.density = $("#prefDensity").value;
      state.settings.accent = $("#prefAccent").value;
      state.settings.showMoney = $("#prefShowMoney").checked;
      state.settings.showPercent = $("#prefShowPercent").checked;
      if (!state.settings.showMoney && !state.settings.showPercent) {
        state.settings.showPercent = true;
      }
      state.settings.confirmDeletes = $("#prefConfirmDeletes").checked;
      state.settings.guardrailBlock = $("#prefGuardrailBlock").checked;
      applyPreferences();
      await persistState();
      render();
      toast("تم حفظ التفضيلات");
    };

    $("#listsForm").onsubmit = async (event) => {
      event.preventDefault();
      const fields = {
        symbols: "listSymbols",
        sessions: "listSessions",
        reasons: "listReasons",
        emotions: "listEmotions",
        mistakes: "listMistakes",
        confluences: "listConfluences",
        timeframes: "listTimeframes",
      };
      for (const [key, elementId] of Object.entries(fields)) {
        state.settings.lists[key] = uniqueList(
          $(`#${elementId}`).value,
          DEFAULT_LISTS[key],
        );
      }
      if (
        !state.settings.lists.sessions.includes(state.settings.defaultSession)
      ) {
        state.settings.defaultSession = state.settings.lists.sessions[0];
      }
      await persistState();
      render();
      toast("تم حفظ القوائم المخصصة");
    };

    $("#resetListsBtn").onclick = async () => {
      if (!window.confirm("استعادة القوائم الأصلية؟")) return;
      state.settings.lists = clone(DEFAULT_LISTS);
      if (
        !state.settings.lists.sessions.includes(state.settings.defaultSession)
      ) {
        state.settings.defaultSession = "نيويورك";
      }
      await persistState();
      render();
      toast("تمت استعادة القوائم");
    };

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $("#installBtn").hidden = false;
    });
    $("#installBtn").onclick = async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("#installBtn").hidden = true;
    };
    $("#checkUpdateBtn").onclick = async () => {
      if (!serviceWorkerRegistration) {
        toast("التحديث التلقائي غير متاح في هذه المعاينة.", "error");
        return;
      }
      try {
        await serviceWorkerRegistration.update();
        toast("تم فحص التحديثات");
      } catch {
        toast("تعذر فحص التحديث الآن.", "error");
      }
    };
    $("#reloadAppBtn").onclick = () => {
      const worker = serviceWorkerRegistration?.waiting;
      if (worker) worker.postMessage({ type: "SKIP_WAITING" });
      else window.location.reload();
    };
  }

  async function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator) ||
      !location.protocol.startsWith("http")
    ) {
      return;
    }
    try {
      serviceWorkerRegistration =
        await navigator.serviceWorker.register("./sw.js");
      if (serviceWorkerRegistration.waiting) $("#updateBanner").hidden = false;
      serviceWorkerRegistration.addEventListener("updatefound", () => {
        const worker = serviceWorkerRegistration.installing;
        worker?.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            $("#updateBanner").hidden = false;
          }
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch {
      // The app remains fully usable online even if service-worker registration fails.
    }
  }

  async function init() {
    try {
      await loadState();
      applyPreferences();
      bindEvents();
      render();
      $("#appShell").hidden = false;
      $("#bootScreen").hidden = true;
      await registerServiceWorker();
      const action = new URLSearchParams(location.search).get("action");
      if (action === "add") {
        history.replaceState({}, "", location.pathname);
        openTrade();
      }
      try {
        if (
          state.meta.migratedFrom &&
          !sessionStorage.getItem("migrationShown")
        ) {
          sessionStorage.setItem("migrationShown", "1");
          toast("تمت ترقية بياناتك إلى Jan Trade Pro بنجاح");
        }
      } catch {
        // Some private browsing modes restrict sessionStorage.
      }
    } catch (error) {
      $("#bootScreen").innerHTML = `
        <div class="boot-logo">JT</div>
        <b>تعذر تشغيل Jan Trade</b>
        <span>${escapeHtml(error.message || "خطأ غير معروف")}</span>
        <button class="btn" onclick="location.reload()">إعادة المحاولة</button>`;
    }
  }

  init();
})();
