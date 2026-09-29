const SUITS = [
  { symbol: "♠", name: "黑桃", color: "black" },
  { symbol: "♥", name: "紅心", color: "red" },
  { symbol: "♦", name: "方塊", color: "red" },
  { symbol: "♣", name: "梅花", color: "black" },
];

const RULES = {
  A: { name: "免死金牌", description: "保留這次資格，之後可抵銷一次喝酒。使用後就失效。", persistent: true },
  2: { name: "陪酒小姐", description: "指定一位陪酒小姐；任何人喝酒時她都要陪喝，直到下一張 2 出現。" },
  3: { name: "PASS", description: "安全過關，這一輪不用喝。" },
  4: { name: "自己喝", description: "抽到這張牌的人喝一口。" },
  5: { name: "照相機", description: "可在任意時刻喊「照相機」讓大家定格；最後停下來的人喝。使用後取消。", persistent: true },
  6: { name: "划拳", description: "指定一位玩家划拳，輸的人喝一口。" },
  7: { name: "團康遊戲", description: "抽牌者發起一個大家都能參加的小遊戲，由輸家喝。" },
  8: { name: "廁所", description: "獲得一次離席上廁所的資格。", persistent: true },
  9: { name: "摸鼻子", description: "可在任意時刻偷偷摸鼻子；最後跟著摸鼻子的人喝。使用後取消。", persistent: true },
  10: { name: "神經病", description: "其他人不能回答抽牌者的問題；不小心回答的人喝。使用後取消。", persistent: true },
  J: { name: "左邊喝", description: "抽牌者左手邊的玩家喝一口。" },
  Q: { name: "右邊喝", description: "抽牌者右手邊的玩家喝一口。" },
  K: { name: "累積國王杯", description: "前 3 張 K 各倒一些飲料進國王杯；第 4 張 K 的人喝完。" },
};

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const STORAGE_KEY = "cheers-deck-state-v2";

const ui = {
  cardButton: document.querySelector("#cardButton"),
  drawButton: document.querySelector("#drawButton"),
  ruleOverline: document.querySelector("#ruleOverline"),
  ruleName: document.querySelector("#ruleName"),
  ruleDescription: document.querySelector("#ruleDescription"),
  remainingCount: document.querySelector("#remainingCount"),
  drawnCount: document.querySelector("#drawnCount"),
  deckProgress: document.querySelector("#deckProgress"),
  kingCount: document.querySelector("#kingCount"),
  ladyCount: document.querySelector("#ladyCount"),
  effectsList: document.querySelector("#effectsList"),
  effectCount: document.querySelector("#effectCount"),
  historyList: document.querySelector("#historyList"),
  rulesDialog: document.querySelector("#rulesDialog"),
  resetDialog: document.querySelector("#resetDialog"),
  rulesList: document.querySelector("#rulesList"),
  toast: document.querySelector("#toast"),
  setupDialog: document.querySelector("#setupDialog"),
  playerInputs: document.querySelector("#playerInputs"),
  playerCount: document.querySelector("#playerCount"),
  playerCountDisplay: document.querySelector("#playerCountDisplay"),
  currentPlayer: document.querySelector("#currentPlayer"),
  playersStrip: document.querySelector("#playersStrip"),
  roundLabel: document.querySelector("#roundLabel"),
  historySummary: document.querySelector("#historySummary"),
  fullscreenTip: document.querySelector("#fullscreenTip"),
  fullscreenCardView: document.querySelector("#fullscreenCardView"),
  fullscreenCard: document.querySelector("#fullscreenCard"),
  fullscreenRuleOverline: document.querySelector("#fullscreenRuleOverline"),
  fullscreenRuleName: document.querySelector("#fullscreenRuleName"),
  fullscreenRuleDescription: document.querySelector("#fullscreenRuleDescription"),
};

function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({
    id: `${suit.name}-${rank}`,
    rank,
    suit: suit.symbol,
    suitName: suit.name,
    color: suit.color,
  })));
}

function shuffle(cards) {
  const result = [...cards];
  const random = new Uint32Array(result.length);
  crypto.getRandomValues(random);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = random[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function freshState() {
  return { deck: shuffle(createDeck()), history: [], effects: [], kingCount: 0, ladyCount: 0, current: null, players: [], currentPlayerIndex: 0 };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.deck) || !Array.isArray(parsed.history)) return freshState();
    return { ...freshState(), ...parsed };
  } catch {
    return freshState();
  }
}

let state = loadState();
let toastTimer;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDisplayRule(card) {
  const base = RULES[card.rank];
  const owner = card.playerName ? `${card.playerName} 抽到` : "";
  if (card.rank === "K") {
    const isFourth = state.kingCount === 4;
    return {
      overline: `${owner}・第 ${state.kingCount} 張 K`,
      name: isFourth ? "國王降臨・喝完國王杯" : "累積國王杯",
      description: isFourth ? "你抽到第 4 張 K，請喝完累積的國王杯。" : `這是第 ${state.kingCount} 張 K，倒一些飲料進國王杯。`,
    };
  }
  if (card.rank === "2") {
    return { overline: `${owner}・第 ${state.ladyCount} 位陪酒小姐`, name: base.name, description: base.description };
  }
  return { overline: `${owner}・${card.suitName} ${card.rank}`, name: base.name, description: base.description };
}

function getCardFaceHTML(card) {
  return `
    <span class="card-corner"><span class="card-rank">${card.rank}</span><span class="card-suit">${card.suit}</span></span>
    <span class="card-center"><span>${card.suit}<small>${RULES[card.rank].name}</small></span></span>
    <span class="card-corner bottom"><span class="card-rank">${card.rank}</span><span class="card-suit">${card.suit}</span></span>`;
}

function renderCard(card, animate = false) {
  if (!card) {
    ui.cardButton.className = "playing-card card-back";
    ui.cardButton.innerHTML = '<span class="back-mark">♢</span><span class="back-title">CHEERS</span><span class="back-hint">點一下抽牌</span>';
    ui.cardButton.setAttribute("aria-label", "抽一張牌");
    ui.fullscreenTip.hidden = true;
    return;
  }
  ui.cardButton.className = `playing-card card-face ${card.color}${animate ? " draw-in" : ""}`;
  ui.cardButton.innerHTML = getCardFaceHTML(card);
  ui.cardButton.setAttribute("aria-label", `${card.suitName}${card.rank}，${RULES[card.rank].name}`);
  ui.fullscreenTip.hidden = false;
  if (animate) setTimeout(() => ui.cardButton.classList.remove("draw-in"), 500);
}

function openFullscreenCard() {
  if (!state.current) return;
  const display = getDisplayRule(state.current);
  ui.fullscreenCard.innerHTML = `<div class="playing-card card-face ${state.current.color} fullscreen-display-card">${getCardFaceHTML(state.current)}</div>`;
  ui.fullscreenRuleOverline.textContent = display.overline;
  ui.fullscreenRuleName.textContent = display.name;
  ui.fullscreenRuleDescription.textContent = display.description;
  ui.fullscreenCardView.hidden = false;
  document.body.classList.add("fullscreen-open");
  document.querySelector("#closeFullscreenCard").focus();
}

function closeFullscreenCard() {
  ui.fullscreenCardView.hidden = true;
  document.body.classList.remove("fullscreen-open");
}

function renderEffects() {
  ui.effectCount.textContent = state.effects.length;
  if (!state.effects.length) {
    ui.effectsList.innerHTML = '<p class="empty-effects">目前沒有未使用的功能牌</p>';
    return;
  }
  const activeOwners = [...new Set(state.effects.map((effect) => effect.playerName))];
  const players = [
    ...state.players.filter((name) => activeOwners.includes(name)),
    ...activeOwners.filter((name) => !state.players.includes(name)),
  ];
  ui.effectsList.innerHTML = players.map((playerName) => {
    const effects = state.effects.filter((effect) => effect.playerName === playerName);
    return `
      <div class="player-effects-row has-effects">
        <div class="player-effect-owner">
          <span class="player-avatar">${escapeHTML(playerName).slice(0, 1)}</span>
          <div><strong>${escapeHTML(playerName)}</strong><small>${effects.length} 張功能牌未使用</small></div>
        </div>
        <div class="player-effect-cards">
          ${effects.map((effect) => `
            <div class="effect-chip">
              <div><strong>${effect.icon} ${effect.name}</strong><small>${effect.suitName}${effect.rank}</small></div>
              <button class="use-effect" type="button" data-effect-id="${effect.id}">用掉</button>
            </div>`).join("")}
        </div>
      </div>`;
  }).join("");
}

function renderHistory() {
  if (!state.history.length) {
    ui.historySummary.textContent = "尚無紀錄";
    ui.historyList.innerHTML = '<p class="empty-history">第一張牌會出現在這裡</p>';
    return;
  }
  const latest = state.history[0];
  ui.historySummary.textContent = `最新：${latest.playerName}・${latest.suitName}${latest.rank}`;
  ui.historyList.innerHTML = state.history.slice(0, 6).map((entry) => `
    <div class="history-item">
      <span class="mini-card ${entry.color}">${entry.rank}${entry.suit}</span>
      <div class="history-copy"><strong>${entry.label}</strong><span>${entry.playerName}・${entry.suitName} ${entry.rank}</span></div>
    </div>`).join("");
}

function render(animateCard = false) {
  const drawn = 52 - state.deck.length;
  ui.remainingCount.textContent = state.deck.length;
  ui.drawnCount.textContent = drawn;
  ui.deckProgress.style.width = `${(drawn / 52) * 100}%`;
  ui.kingCount.textContent = `${state.kingCount} / 4`;
  ui.ladyCount.textContent = state.ladyCount ? `第 ${state.ladyCount} 位進行中` : "尚未出現";
  ui.drawButton.disabled = state.deck.length === 0;
  ui.drawButton.querySelector("span:first-child").textContent = state.deck.length ? "抽下一張" : "牌已經抽完了";
  const player = state.players[state.currentPlayerIndex] || "玩家 1";
  ui.currentPlayer.textContent = player;
  const completedTurns = 52 - state.deck.length;
  const round = state.players.length ? Math.floor(completedTurns / state.players.length) + 1 : 1;
  ui.roundLabel.textContent = `第 ${round} 輪`;
  ui.playersStrip.innerHTML = state.players.map((name, index) => `<span class="player-pill${index === state.currentPlayerIndex ? " current" : ""}">${name}</span>`).join("");

  renderCard(state.current, animateCard);
  if (state.current) {
    const display = getDisplayRule(state.current);
    ui.ruleOverline.textContent = display.overline;
    ui.ruleName.textContent = display.name;
    ui.ruleDescription.textContent = display.description;
  } else {
    ui.ruleOverline.textContent = "準備好了嗎？";
    ui.ruleName.textContent = "輪流拿起手機抽牌";
    ui.ruleDescription.textContent = "抽到牌後，照著畫面上的規則玩。";
  }
  renderEffects();
  renderHistory();
}

function showToast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2200);
}

function drawCard(keepFullscreen = false) {
  if (!state.deck.length) return;
  const fullscreenWasOpen = !ui.fullscreenCardView.hidden;
  const card = state.deck.pop();
  card.playerName = state.players[state.currentPlayerIndex] || `玩家 ${state.currentPlayerIndex + 1}`;
  state.current = card;
  if (card.rank === "K") state.kingCount += 1;
  if (card.rank === "2") state.ladyCount += 1;

  const rule = RULES[card.rank];
  if (rule.persistent) {
    const icon = card.rank === "A" ? "🛡️" : card.rank === "5" ? "📷" : card.rank === "8" ? "🚻" : card.rank === "9" ? "👃" : "🌀";
    state.effects.push({ id: `${card.id}-${Date.now()}`, rank: card.rank, suitName: card.suitName, name: rule.name, icon, playerName: card.playerName });
  }

  const display = getDisplayRule(card);
  state.history.unshift({ ...card, label: `${display.overline}・${display.name}` });
  if (state.players.length) state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  saveState();
  render(true);
  if (keepFullscreen && fullscreenWasOpen) openFullscreenCard();
  if (navigator.vibrate) navigator.vibrate(35);
}

function resetGame() {
  const players = [...state.players];
  state = { ...freshState(), players };
  saveState();
  render();
  ui.resetDialog.close();
  showToast("已重新洗牌，開始新的一局");
}

function renderPlayerInputs(count, existing = []) {
  ui.playerCount.value = count;
  ui.playerCountDisplay.textContent = count;
  ui.playerInputs.innerHTML = Array.from({ length: count }, (_, index) => `
    <div class="player-input-row">
      <span>${index + 1}</span>
      <input type="text" maxlength="12" value="${escapeHTML(existing[index] || "")}" placeholder="玩家 ${index + 1}" aria-label="第 ${index + 1} 位玩家名字" />
      <span class="order-buttons">
        <button type="button" data-move="up" data-index="${index}" aria-label="將第 ${index + 1} 位玩家往前移" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-move="down" data-index="${index}" aria-label="將第 ${index + 1} 位玩家往後移" ${index === count - 1 ? "disabled" : ""}>↓</button>
      </span>
    </div>`).join("");
}

function escapeHTML(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function openPlayerSetup(editing = false) {
  const count = editing && state.players.length ? state.players.length : Number(ui.playerCount.value || 4);
  renderPlayerInputs(count, editing ? state.players : []);
  document.querySelector("#cancelPlayerEdit").hidden = !editing;
  document.querySelector("#setupTitle").textContent = editing ? "調整玩家與順序" : "今晚有幾位玩家？";
  document.querySelector("#setupDescription").textContent = editing ? "可以隨時增減人數、改名字或調整下一輪的順序。" : "輸入名字後，牌面會記住每張牌是誰抽的。";
  document.querySelector("#startGame span:first-child").textContent = editing ? "儲存玩家設定" : "開始牌局";
  ui.setupDialog.showModal();
}

function savePlayers() {
  const players = [...ui.playerInputs.querySelectorAll("input")].map((input, index) => input.value.trim() || `玩家 ${index + 1}`);
  const samePlayers = JSON.stringify(players) === JSON.stringify(state.players);
  state.players = players;
  if (!samePlayers) state.currentPlayerIndex = 0;
  saveState();
  ui.setupDialog.close();
  render();
  showToast("玩家名單已設定完成");
}

function populateRules() {
  ui.rulesList.innerHTML = RANKS.map((rank) => `
    <div class="rule-row">
      <span class="rule-badge">${rank}</span>
      <div><strong>${RULES[rank].name}</strong><p>${RULES[rank].description}</p></div>
    </div>`).join("");
}

ui.drawButton.addEventListener("click", () => drawCard());
let cardClickTimer = null;
let lastTouchTap = 0;
let suppressNextCardClick = false;

// 單擊牌面：抽下一張牌
ui.cardButton.addEventListener("click", () => {
  // 手機雙擊時，避免第二次 click 又抽一張
  if (suppressNextCardClick) {
    suppressNextCardClick = false;
    return;
  }

  clearTimeout(cardClickTimer);

  // 稍微等待，以便判斷使用者是單擊還是雙擊
  cardClickTimer = setTimeout(() => {
    lastTouchTap = 0;
    drawCard();
  }, 260);
});

// 電腦雙擊牌面：開啟全螢幕
ui.cardButton.addEventListener("dblclick", (event) => {
  event.preventDefault();
  clearTimeout(cardClickTimer);

  // 還沒抽第一張牌時，雙擊只抽牌
  if (!state.current) {
    drawCard();
    return;
  }

  openFullscreenCard();
});

// 手機快速點兩下：開啟全螢幕
ui.cardButton.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "touch" || !state.current) return;

  const now = Date.now();

  if (now - lastTouchTap < 380) {
    event.preventDefault();
    clearTimeout(cardClickTimer);
    lastTouchTap = 0;
    suppressNextCardClick = true;
    openFullscreenCard();
  } else {
    lastTouchTap = now;
  }
});
document.querySelector("#closeFullscreenCard").addEventListener("click", closeFullscreenCard);
let fullscreenDrawLocked = false;
ui.fullscreenCard.addEventListener("click", () => {
  if (fullscreenDrawLocked) return;
  fullscreenDrawLocked = true;
  drawCard(true);
  setTimeout(() => { fullscreenDrawLocked = false; }, 420);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.fullscreenCardView.hidden) closeFullscreenCard();
});
document.querySelector("#openRules").addEventListener("click", () => ui.rulesDialog.showModal());
document.querySelector("#closeRules").addEventListener("click", () => ui.rulesDialog.close());
document.querySelector("#resetButton").addEventListener("click", () => ui.resetDialog.showModal());
document.querySelector("#cancelReset").addEventListener("click", () => ui.resetDialog.close());
document.querySelector("#confirmReset").addEventListener("click", resetGame);
document.querySelector("#openPlayers").addEventListener("click", () => openPlayerSetup(true));
document.querySelector("#startGame").addEventListener("click", savePlayers);
document.querySelector("#cancelPlayerEdit").addEventListener("click", () => ui.setupDialog.close());
document.querySelector("#decreasePlayers").addEventListener("click", () => {
  const existing = [...ui.playerInputs.querySelectorAll("input")].map((input) => input.value);
  renderPlayerInputs(Math.max(2, Number(ui.playerCount.value) - 1), existing);
});
document.querySelector("#increasePlayers").addEventListener("click", () => {
  const existing = [...ui.playerInputs.querySelectorAll("input")].map((input) => input.value);
  renderPlayerInputs(Math.min(12, Number(ui.playerCount.value) + 1), existing);
});
ui.playerInputs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-move]");
  if (!button) return;
  const values = [...ui.playerInputs.querySelectorAll("input")].map((input) => input.value);
  const index = Number(button.dataset.index);
  const target = button.dataset.move === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= values.length) return;
  [values[index], values[target]] = [values[target], values[index]];
  renderPlayerInputs(values.length, values);
  ui.playerInputs.querySelectorAll("input")[target].focus();
});

ui.effectsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-effect-id]");
  if (!button) return;
  const effect = state.effects.find((item) => item.id === button.dataset.effectId);
  state.effects = state.effects.filter((item) => item.id !== button.dataset.effectId);
  saveState();
  render();
  showToast(`${effect?.name ?? "效果"}已使用並取消`);
});

for (const dialog of [ui.rulesDialog, ui.resetDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const tools = [
    {
      name: "draw_next_card",
      title: "抽下一張牌",
      description: "從目前牌局抽出下一張牌，並更新畫面與規則。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        if (!state.deck.length) throw new Error("牌已經抽完了");
        drawCard();
        return { card: `${state.current.suitName}${state.current.rank}`, rule: getDisplayRule(state.current).name, remaining: state.deck.length };
      },
    },
    {
      name: "read_game_state",
      title: "查看牌局狀態",
      description: "查看目前牌面、剩餘張數、K 計數及持續效果。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return { currentCard: state.current ? `${state.current.suitName}${state.current.rank}` : null, remaining: state.deck.length, kingCount: state.kingCount, effects: state.effects.map((e) => e.name) };
      },
    },
  ];
  tools.forEach((tool) => Promise.resolve(context.registerTool(tool)).catch(() => {}));
}

populateRules();
render();
registerWebMCP();
if (!state.players.length) openPlayerSetup(false);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
