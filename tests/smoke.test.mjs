import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { JSDOM } from "jsdom";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const script = await readFile(new URL("app.js", root), "utf8");

const pause = (milliseconds = 20) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(check, message, timeout = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = check();
    if (value) return value;
    await pause();
  }
  throw new Error(message);
}

async function launch(seed = {}) {
  const dom = new JSDOM(html, {
    url: "https://dahir180.github.io/-jan-trade/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.indexedDB = new IDBFactory();
  window.IDBKeyRange = IDBKeyRange;
  window.confirm = () => true;
  window.scrollTo = () => {};
  window.URL.createObjectURL = () => "blob:test";
  window.URL.revokeObjectURL = () => {};
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
  for (const [key, value] of Object.entries(seed)) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  window.eval(script);
  await waitFor(
    () => window.document.querySelector("#appShell")?.hidden === false,
    "The app did not finish booting",
  );
  return dom;
}

function storedState(window) {
  return JSON.parse(window.localStorage.getItem("janTrade.pro.v4"));
}

function input(window, selector, value) {
  const element = window.document.querySelector(selector);
  assert.ok(element, `Missing field ${selector}`);
  if (element.type === "checkbox") element.checked = Boolean(value);
  else element.value = String(value);
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

async function submit(window, formSelector) {
  const form = window.document.querySelector(formSelector);
  const submitter = form.querySelector('button[value="save"]');
  form.dispatchEvent(
    new window.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter,
    }),
  );
  await pause(60);
}

async function editAccount(window, id, values) {
  window.document.querySelector(`.edit-account[data-id="${id}"]`).click();
  for (const [field, value] of Object.entries(values)) {
    input(window, `#${field}`, value);
  }
  await submit(window, "#accountForm");
}

async function addAccount(window, values) {
  window.document.querySelector("#addAccountBtn").click();
  for (const [field, value] of Object.entries(values)) {
    input(window, `#${field}`, value);
  }
  await submit(window, "#accountForm");
}

async function addTrade(window, values, copy = true) {
  window.document.querySelector("#addTradeBtn").click();
  for (const [field, value] of Object.entries(values)) {
    input(window, `#${field}`, value);
  }
  const copyBox = window.document.querySelector("#copyToGroup");
  if (!copyBox.closest("[hidden]")) copyBox.checked = copy;
  await submit(window, "#tradeForm");
}

async function chooseMt5Report(window, report, name = "statement.html") {
  const file = new window.File([report], name, { type: "text/html" });
  file.text = async () => report;
  const picker = window.document.querySelector("#mt5ReportFile");
  Object.defineProperty(picker, "files", {
    configurable: true,
    value: [file],
  });
  picker.dispatchEvent(new window.Event("change", { bubbles: true }));
  await waitFor(
    () => window.document.querySelector("#mt5ImportDialog").open,
    `MT5 preview did not open: ${
      window.document.querySelector("#toast")?.textContent || "no error"
    }`,
  );
}

async function confirmMt5Import(window) {
  const form = window.document.querySelector("#mt5ImportForm");
  const submitter = window.document.querySelector("#confirmMt5Import");
  form.dispatchEvent(
    new window.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter,
    }),
  );
  await pause(100);
}

test("fresh boot exposes the full configurable PWA", async () => {
  const dom = await launch();
  const { document } = dom.window;
  assert.equal(storedState(dom.window).version, 4);
  assert.match(
    document.querySelector("#storageInfo").textContent,
    /إصدار البيانات: 4/,
  );
  assert.ok(document.querySelector("#accountDailyLossMode"));
  assert.ok(document.querySelector("#accountDayResetHour"));
  assert.ok(document.querySelector("#accountConsistency"));
  assert.ok(document.querySelector("#accountMaxRiskPct"));
  assert.ok(document.querySelector("#mt5ReportImportBtn"));
  assert.equal(document.querySelectorAll(".nav").length, 6);
  dom.window.close();
});

test("percentage copy groups preserve proportional risk and return", async () => {
  const dom = await launch();
  const { window } = dom;
  await editAccount(window, "main", {
    accountName: "25K",
    accountBalance: 25000,
    accountCopyGroup: "G1",
    accountRiskPct: 0.5,
  });
  await addAccount(window, {
    accountName: "10K",
    accountBalance: 10000,
    accountCopyGroup: "G1",
    accountRiskPct: 0.5,
  });
  const second = storedState(window).accounts.find(
    (account) => account.name === "10K",
  );
  assert.ok(second);

  await addTrade(window, {
    tradeAccount: "main",
    symbol: "XAUUSD",
    resultMode: "r",
    riskPct: 0.5,
    resultR: 2,
    fees: 0,
    swap: 0,
  });
  const state = await waitFor(
    () => storedState(window).trades.length === 2 && storedState(window),
    "Copied trades were not saved",
  );
  const primary = state.trades.find((trade) => trade.accountId === "main");
  const copied = state.trades.find((trade) => trade.accountId === second.id);
  assert.equal(primary.riskAmount, 125);
  assert.equal(primary.netPnl, 250);
  assert.equal(primary.pnlPct, 1);
  assert.equal(copied.riskAmount, 50);
  assert.equal(copied.netPnl, 100);
  assert.equal(copied.pnlPct, 1);
  assert.equal(copied.resultR, 2);
  assert.equal(copied.copiedFrom, primary.id);
  dom.window.close();
});

test("exact copy mode preserves the same money values across account sizes", async () => {
  const dom = await launch();
  const { window } = dom;
  await editAccount(window, "main", {
    accountName: "25K",
    accountBalance: 25000,
    accountCopyGroup: "G1",
    accountRiskPct: 0.5,
  });
  await addAccount(window, {
    accountName: "10K",
    accountBalance: 10000,
    accountCopyGroup: "G1",
    accountRiskPct: 0.5,
  });
  input(window, "#prefCopyMode", "exact");
  await submit(window, "#preferencesForm");
  await addTrade(window, {
    tradeAccount: "main",
    symbol: "XAUUSD",
    resultMode: "r",
    riskPct: 0.5,
    resultR: 2,
  });
  const state = await waitFor(
    () => storedState(window).trades.length === 2 && storedState(window),
    "Exact copied trades were not saved",
  );
  for (const trade of state.trades) {
    assert.equal(trade.riskAmount, 125);
    assert.equal(trade.netPnl, 250);
    assert.equal(trade.resultR, 2);
  }
  const copied = state.trades.find((trade) => trade.accountId !== "main");
  assert.equal(copied.pnlPct, 2.5);
  dom.window.close();
});

test("all three result modes calculate deterministic net P&L", async () => {
  const dom = await launch();
  const { window } = dom;
  await addTrade(
    window,
    {
      symbol: "XAUUSD",
      resultMode: "r",
      riskAmount: 50,
      resultR: 2,
      fees: 3,
      swap: 2,
    },
    false,
  );
  await addTrade(
    window,
    {
      symbol: "NAS100",
      resultMode: "money",
      grossPnl: -100,
      fees: 3,
      swap: 2,
    },
    false,
  );
  await addTrade(
    window,
    {
      symbol: "GBPUSD",
      resultMode: "percent",
      pnlPct: 1,
      fees: 3,
      swap: 2,
    },
    false,
  );
  const state = await waitFor(
    () => storedState(window).trades.length === 3 && storedState(window),
    "Result-mode trades were not saved",
  );
  assert.equal(
    state.trades.find((trade) => trade.symbol === "XAUUSD").netPnl,
    95,
  );
  assert.equal(
    state.trades.find((trade) => trade.symbol === "NAS100").netPnl,
    -105,
  );
  assert.equal(
    state.trades.find((trade) => trade.symbol === "GBPUSD").netPnl,
    100,
  );
  assert.equal(
    state.trades.find((trade) => trade.symbol === "GBPUSD").grossPnl,
    105,
  );
  dom.window.close();
});

test("guardrail blocking enforces a configured maximum trade risk", async () => {
  const dom = await launch();
  const { window } = dom;
  await editAccount(window, "main", {
    accountMaxRiskPct: 0.4,
  });
  input(window, "#prefGuardrailBlock", true);
  await submit(window, "#preferencesForm");
  await addTrade(
    window,
    {
      symbol: "XAUUSD",
      resultMode: "r",
      riskPct: 0.5,
      resultR: 1,
    },
    false,
  );
  assert.equal(storedState(window).trades.length, 0);
  assert.equal(window.document.querySelector("#tradeDialog").open, true);
  assert.match(
    window.document.querySelector("#toast").textContent,
    /تتجاوز حد الصفقة/,
  );
  dom.window.close();
});

test("editing, Enter-key submission, deletion, and undo preserve one trade", async () => {
  const dom = await launch();
  const { window } = dom;
  await addTrade(
    window,
    {
      symbol: "XAUUSD",
      resultMode: "r",
      riskAmount: 50,
      resultR: 1,
    },
    false,
  );
  window.document.querySelector(".edit-trade").click();
  input(window, "#resultR", 3);
  window.document.querySelector("#tradeForm").dispatchEvent(
    new window.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  await waitFor(
    () => storedState(window).trades[0]?.netPnl === 150,
    "Enter-key editing did not save",
  );
  assert.equal(storedState(window).trades.length, 1);

  window.document.querySelector(".delete-trade").click();
  await waitFor(
    () => storedState(window).trades.length === 0,
    "Trade deletion did not persist",
  );
  window.document.querySelector("#toast").click();
  await waitFor(
    () => storedState(window).trades.length === 1,
    "Undo did not restore the trade",
  );
  assert.equal(storedState(window).trades[0].netPnl, 150);
  dom.window.close();
});

test("playbooks can be edited and archived without losing their rules", async () => {
  const dom = await launch();
  const { window } = dom;
  window.document.querySelector('.edit-pb[data-id="pb-a"]').click();
  input(window, "#pbEntry", "Sweep + SMT + CISD");
  input(window, "#pbActive", false);
  await submit(window, "#playbookForm");
  const state = storedState(window);
  assert.equal(state.playbooks[0].active, false);
  assert.equal(state.playbooks[0].entry, "Sweep + SMT + CISD");
  window.document.querySelector("#addTradeBtn").click();
  assert.equal(
    [...window.document.querySelector("#setup").options].some(
      (option) => option.value === "pb-a",
    ),
    false,
  );
  dom.window.close();
});

test("legacy v1 data migrates without changing trade economics", async () => {
  const legacy = {
    accounts: [{ id: "old", name: "Old 10K", balance: 10000 }],
    playbooks: [],
    trades: [
      {
        id: "t1",
        accountId: "old",
        date: "2026-07-30T10:00",
        symbol: "XAUUSD",
        direction: "long",
        session: "نيويورك",
        riskAmount: 50,
        resultR: 2,
        fees: 3,
      },
    ],
  };
  const dom = await launch({ "janTrade.pro.v1": legacy });
  const state = storedState(dom.window);
  assert.equal(state.version, 4);
  assert.equal(state.trades.length, 1);
  assert.equal(state.trades[0].netPnl, 97);
  assert.equal(state.trades[0].resultR, 2);
  assert.equal(state.meta.migratedFrom, "janTrade.pro.v1");
  dom.window.close();
});

test("standalone journal and inline-mobile backups migrate correctly", async () => {
  const journalDom = await launch({
    "janTradeJournal.v1": {
      settings: { initialBalance: 20000, currency: "GBP" },
      trades: [
        {
          id: "j1",
          date: "2026-07-29T09:00",
          symbol: "GBPUSD",
          direction: "buy",
          session: "لندن",
          strategy: "Sweep",
          risk: 50,
          resultR: 2,
          fees: 3,
        },
      ],
    },
  });
  const journalState = storedState(journalDom.window);
  assert.equal(journalState.accounts[0].balance, 20000);
  assert.equal(journalState.settings.currency, "GBP");
  assert.equal(journalState.trades[0].netPnl, 97);
  assert.equal(journalState.trades[0].reason, "Sweep");
  journalDom.window.close();

  const inlineDom = await launch({
    janTradeInlineV2: [
      {
        id: "i1",
        date: "2026-07-28",
        symbol: "NAS100",
        session: "نيويورك",
        risk: 40,
        r: -1,
        strategy: "CISD",
      },
    ],
  });
  const inlineState = storedState(inlineDom.window);
  assert.equal(inlineState.trades[0].netPnl, -40);
  assert.equal(inlineState.trades[0].resultR, -1);
  assert.equal(inlineState.meta.migratedFrom, "janTradeInlineV2");
  inlineDom.window.close();
});

test("attached TSX backup shape keeps percentage outcomes and account rules", async () => {
  const attached = {
    accounts: [
      {
        id: "c25",
        label: "25K",
        company: "Firm",
        size: 25000,
        cDaily: 4,
        cTotal: 8,
        ourDaily: 1,
        p1: 8,
        copyGroup: "G1",
      },
    ],
    strats: [
      {
        id: "s1",
        name: "A+",
        market: "XAUUSD",
        entryConditions: "Sweep",
      },
    ],
    trades: [
      {
        id: "a1",
        accountId: "c25",
        date: "2026-07-31",
        pair: "XAUUSD",
        direction: "buy",
        session: "asia",
        pnl: 1,
        riskUSD: 125,
        commission: 0,
        strategyId: "s1",
      },
    ],
  };
  const dom = await launch({ "jan-v8": attached });
  const state = storedState(dom.window);
  assert.equal(state.accounts[0].balance, 25000);
  assert.equal(state.accounts[0].dailyLossPct, 4);
  assert.equal(state.trades[0].netPnl, 250);
  assert.equal(state.trades[0].pnlPct, 1);
  assert.equal(state.trades[0].resultR, 2);
  assert.equal(state.trades[0].session, "آسيا");
  assert.equal(state.meta.migratedFrom, "jan-v8");
  dom.window.close();
});

test("CSV import accepts common MT5 timestamps and skips an exact re-import", async () => {
  const dom = await launch();
  const { window } = dom;
  const csv =
    "ticket,openTime,closeTime,symbol,type,lots,netProfit,commission,swap\n" +
    "9001,2026.07.31 08:30:00,2026.07.31 09:15:00,XAUUSD,buy,0.10,100,3,2\n";
  const file = new window.File([csv], "mt5.csv", { type: "text/csv" });
  file.text = async () => csv;
  const picker = window.document.querySelector("#csvFile");
  Object.defineProperty(picker, "files", {
    configurable: true,
    value: [file],
  });
  picker.dispatchEvent(new window.Event("change", { bubbles: true }));
  await pause(150);
  if (storedState(window).trades.length === 0) {
    throw new Error(
      `CSV import failed: ${window.document.querySelector("#toast").textContent}`,
    );
  }
  await waitFor(
    () => storedState(window).trades.length === 1,
    "CSV trade was not imported",
  );
  let state = storedState(window);
  assert.equal(state.trades[0].date, "2026-07-31T08:30:00");
  assert.equal(state.trades[0].netPnl, 100);
  assert.equal(state.trades[0].grossPnl, 105);
  assert.equal(state.trades[0].externalId, "9001");

  picker.dispatchEvent(new window.Event("change", { bubbles: true }));
  await pause(80);
  state = storedState(window);
  assert.equal(state.trades.length, 1);
  dom.window.close();
});

test("original MT5 Positions HTML is previewed and imported with exact net P&L", async () => {
  const dom = await launch();
  const { window } = dom;
  const report = `<!doctype html>
    <html><head><meta charset="utf-8"><title>MT5 Statement</title></head>
    <body><table>
      <tr><td colspan="15">Account: 123456 Name: Trader Currency: USD</td></tr>
      <tr><th colspan="15">Positions</th></tr>
      <tr>
        <th>Time</th><th>Position</th><th>Symbol</th><th>Type</th>
        <th>Volume</th><th>Price</th><th>S/L</th><th>T/P</th>
        <th>Time</th><th>Price</th><th>Commission</th><th>Fee</th>
        <th>Swap</th><th>Profit</th><th>Comment</th>
      </tr>
      <tr>
        <td>2026.07.31 08:30:00</td><td>7001</td><td>XAUUSD</td><td>buy</td>
        <td>0.10</td><td>2300.00</td><td>2290.00</td><td>2320.00</td>
        <td>2026.07.31 09:15:00</td><td>2310.00</td><td>-2.00</td><td>0</td>
        <td>-1.00</td><td>100.00</td><td>tp 2320</td>
      </tr>
    </table></body></html>`;

  await chooseMt5Report(window, report);
  assert.equal(storedState(window).trades.length, 0);
  assert.match(
    window.document.querySelector("#mt5ImportSummary").textContent,
    /جديدة\s*1/,
  );
  await confirmMt5Import(window);
  const state = await waitFor(
    () => storedState(window).trades.length === 1 && storedState(window),
    "MT5 position was not imported",
  );
  const trade = state.trades[0];
  assert.equal(trade.source, "mt5");
  assert.equal(trade.date, "2026-07-31T08:30:00");
  assert.equal(trade.closeDate, "2026-07-31T09:15:00");
  assert.equal(trade.direction, "long");
  assert.equal(trade.grossPnl, 100);
  assert.equal(trade.fees, 2);
  assert.equal(trade.swap, 1);
  assert.equal(trade.netPnl, 97);
  assert.equal(trade.externalId, "mt5:123456:position:7001");
  dom.window.close();
});

test("Arabic MT5 headers, digits, and decimal separators are parsed", async () => {
  const dom = await launch();
  const { window } = dom;
  const report = `<!doctype html><html lang="ar" dir="rtl"><body><table>
    <tr><td colspan="15">رقم الحساب: ١٢٣٤٥٦ العملة: USD</td></tr>
    <tr><th colspan="15">المراكز المغلقة</th></tr>
    <tr>
      <th>وقت</th><th>المركز</th><th>الرمز</th><th>النوع</th>
      <th>الحجم</th><th>السعر</th><th>وقف الخسارة</th><th>جني الربح</th>
      <th>وقت</th><th>السعر</th><th>العمولة</th><th>الرسوم</th>
      <th>التبييت</th><th>الربح</th><th>تعليق</th>
    </tr>
    <tr>
      <td>٢٠٢٦.٠٧.٣١ ٠٨:٣٠:٠٠</td><td>٧٠٠٢</td><td>XAUUSD</td><td>شراء</td>
      <td>٠٫١٠</td><td>٢٣٠٠٫٠٠</td><td>٢٢٩٠٫٠٠</td><td>٢٣٢٠٫٠٠</td>
      <td>٢٠٢٦.٠٧.٣١ ٠٩:١٥:٠٠</td><td>٢٣١٠٫٠٠</td><td>-٢٫٠٠</td><td>٠</td>
      <td>-١٫٠٠</td><td>١٠٠٫٠٠</td><td>tp</td>
    </tr>
  </table></body></html>`;
  await chooseMt5Report(window, report, "arabic-report.htm");
  await confirmMt5Import(window);
  const state = await waitFor(
    () => storedState(window).trades.length === 1 && storedState(window),
    "Arabic MT5 report was not imported",
  );
  assert.equal(state.trades[0].externalId, "mt5:123456:position:7002");
  assert.equal(state.trades[0].entry, 2300);
  assert.equal(state.trades[0].size, 0.1);
  assert.equal(state.trades[0].netPnl, 97);
  dom.window.close();
});

test("MT5 Deals HTML merges partial closes and updates without losing review notes", async () => {
  const dom = await launch();
  const { window } = dom;
  const report = (secondClose = false) => `<!doctype html>
    <html><head><meta charset="utf-8"></head><body><table>
      <tr><td colspan="15">Account: 654321 Currency: USD</td></tr>
      <tr><th colspan="15">Deals</th></tr>
      <tr>
        <th>Time</th><th>Deal</th><th>Position</th><th>Order</th>
        <th>Symbol</th><th>Type</th><th>Direction</th><th>Volume</th>
        <th>Price</th><th>S/L</th><th>T/P</th><th>Commission</th>
        <th>Fee</th><th>Swap</th><th>Profit</th><th>Comment</th>
      </tr>
      <tr>
        <td>2026.07.31 08:00:00</td><td>1001</td><td>777</td><td>9001</td>
        <td>XAUUSD</td><td>buy</td><td>in</td><td>0.20</td><td>2300</td>
        <td>2290</td><td>2360</td><td>-1.00</td><td>0</td><td>0</td><td>0</td><td></td>
      </tr>
      <tr>
        <td>2026.07.31 09:00:00</td><td>1002</td><td>777</td><td>9002</td>
        <td>XAUUSD</td><td>sell</td><td>out</td><td>0.10</td><td>2350</td>
        <td>2290</td><td>2360</td><td>-0.50</td><td>0</td><td>0</td><td>50</td><td>partial</td>
      </tr>
      ${
        secondClose
          ? `<tr>
        <td>2026.07.31 09:30:00</td><td>1003</td><td>777</td><td>9003</td>
        <td>XAUUSD</td><td>sell</td><td>out</td><td>0.10</td><td>2360</td>
        <td>2290</td><td>2360</td><td>-0.50</td><td>0</td><td>-1.00</td><td>70</td><td>tp</td>
      </tr>`
          : ""
      }
    </table></body></html>`;

  await chooseMt5Report(window, report(false), "partial.html");
  await confirmMt5Import(window);
  await waitFor(
    () => storedState(window).trades.length === 1,
    "First partial close was not imported",
  );
  let state = storedState(window);
  assert.equal(state.trades[0].size, 0.1);
  assert.equal(state.trades[0].netPnl, 48.5);

  window.document.querySelector(".edit-trade").click();
  input(window, "#notes", "مراجعتي الخاصة لا تُحذف");
  await submit(window, "#tradeForm");

  await chooseMt5Report(window, report(true), "complete.html");
  assert.match(
    window.document.querySelector("#mt5ImportSummary").textContent,
    /تحديث\s*1/,
  );
  await confirmMt5Import(window);
  state = await waitFor(
    () => storedState(window).trades[0]?.netPnl === 117 && storedState(window),
    "Partial-close update was not applied",
  );
  assert.equal(state.trades.length, 1);
  assert.equal(state.trades[0].size, 0.2);
  assert.equal(state.trades[0].entry, 2300);
  assert.equal(state.trades[0].exit, 2355);
  assert.equal(state.trades[0].grossPnl, 120);
  assert.equal(state.trades[0].fees, 2);
  assert.equal(state.trades[0].swap, 1);
  assert.equal(state.trades[0].notes, "مراجعتي الخاصة لا تُحذف");

  await chooseMt5Report(window, report(true), "duplicate.html");
  assert.equal(
    window.document.querySelector("#confirmMt5Import").disabled,
    true,
  );
  assert.match(
    window.document.querySelector("#mt5ImportSummary").textContent,
    /مكررة\s*1/,
  );
  dom.window.close();
});

test("MT5 deal reports without Position IDs use a visible conservative fallback", async () => {
  const dom = await launch();
  const { window } = dom;
  const report = `<!doctype html><html><body><table>
    <tr><td colspan="13">Account: 998877 Currency: USD</td></tr>
    <tr><th colspan="13">Deals</th></tr>
    <tr>
      <th>Time</th><th>Deal</th><th>Order</th><th>Symbol</th>
      <th>Type</th><th>Direction</th><th>Volume</th><th>Price</th>
      <th>Commission</th><th>Fee</th><th>Swap</th><th>Profit</th><th>Comment</th>
    </tr>
    <tr>
      <td>2026.07.31 10:00:00</td><td>501</td><td>401</td><td>GBPUSD</td>
      <td>sell</td><td>in</td><td>0.10</td><td>1.3200</td>
      <td>-0.50</td><td>0</td><td>0</td><td>0</td><td></td>
    </tr>
    <tr>
      <td>2026.07.31 10:20:00</td><td>502</td><td>402</td><td>GBPUSD</td>
      <td>buy</td><td>out</td><td>0.10</td><td>1.3180</td>
      <td>-0.50</td><td>0</td><td>0</td><td>20</td><td>manual</td>
    </tr>
  </table></body></html>`;
  await chooseMt5Report(window, report, "deals-no-position.htm");
  assert.match(
    window.document.querySelector("#mt5ImportWarnings").textContent,
    /لا تحتوي رقم Position/,
  );
  await confirmMt5Import(window);
  const state = await waitFor(
    () => storedState(window).trades.length === 1 && storedState(window),
    "Fallback deal was not imported",
  );
  assert.equal(state.trades[0].direction, "short");
  assert.equal(state.trades[0].netPnl, 19);
  dom.window.close();
});

test("invalid backups are rejected without replacing current data", async () => {
  const dom = await launch();
  const { window } = dom;
  await addTrade(
    window,
    {
      symbol: "XAUUSD",
      resultMode: "r",
      riskAmount: 50,
      resultR: 1,
    },
    false,
  );
  const invalid = new window.File(['{"foo":"bar"}'], "invalid.json", {
    type: "application/json",
  });
  invalid.text = async () => '{"foo":"bar"}';
  const picker = window.document.querySelector("#restoreFile");
  Object.defineProperty(picker, "files", {
    configurable: true,
    value: [invalid],
  });
  picker.dispatchEvent(new window.Event("change", { bubbles: true }));
  await pause(100);
  assert.equal(storedState(window).trades.length, 1);
  assert.match(
    window.document.querySelector("#toast").textContent,
    /بنية بيانات/,
  );
  dom.window.close();
});

test("manifest, service worker, icons, and responsive rules are deployable", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.webmanifest", root), "utf8"),
  );
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  for (const icon of manifest.icons) {
    await access(new URL(icon.src, root));
  }

  const worker = await readFile(new URL("sw.js", root), "utf8");
  assert.match(worker, /jan-trade-v4-/);
  for (const asset of [
    "index.html",
    "styles.css",
    "app.js",
    "manifest.webmanifest",
    "icons/apple-touch-icon.png",
  ]) {
    assert.match(worker, new RegExp(asset.replaceAll(".", "\\.")));
    await access(new URL(asset, root));
  }
  const css = await readFile(new URL("styles.css", root), "utf8");
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 410px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
