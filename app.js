// 期間設定（Run2.8 たこあげテーマ）
const START_DATE_STR = "2026-02-03";
const END_DATE_STR = "2026-03-31";
const CURRENT_SEASON_ID = "tako_2026_02_03";
const STORAGE_KEY = "tako_nikoniko_v1";
const SEASON_ID_KEY = "tako_season_id";

// たこあげスタンプ: 🎐=たのしい(2pt), 🪁=すこし(1pt), 🌥️=くもってる(0pt)
const POINTS = { "🎐": 2, "🪁": 1, "🌥️": 0 };

// 状態管理
let appState = {};
let helpTotal = 0;
let isHydrated = false;
let saveTimeout = null;

/**
 * JST（Asia/Tokyo）基準の現在日付を取得する
 * 実行環境のローカル時間に依存せず、常に日本時間で判定する
 */
function getJSTNow() {
    const now = new Date();
    // 日本時間との時差を考慮して調整
    const jstOffset = 9 * 60; // JSTはUTC+9
    const localOffset = now.getTimezoneOffset(); // 分単位（JSTなら -540）
    const jstTime = now.getTime() + (jstOffset + localOffset) * 60 * 1000;
    return new Date(jstTime);
}

function formatDateToKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateKey(date) {
    return formatDateToKey(date);
}

const START_DATE_JST = new Date(START_DATE_STR + "T00:00:00+09:00");
const END_DATE_JST = new Date(END_DATE_STR + "T23:59:59+09:00");

/**
 * リセット対象期間内（12/26〜1/7）か判定
 */
function isInSeasonWindow(now) {
    return now >= START_DATE_JST && now <= END_DATE_JST;
}

// 音管理
const SoundManager = {
    ctx: null,
    enabled: true,
    volume: 0.3,

    init() {
        // localStorageから設定読み込み
        const saved = localStorage.getItem("santa_sound_config");
        if (saved) {
            const config = JSON.parse(saved);
            this.enabled = config.enabled;
        }
        this.updateBtn();

        // ユーザー操作でAudioContext有効化
        document.addEventListener('click', () => this.resume(), { once: true });
        document.getElementById('soundToggleBtn').addEventListener('click', () => this.toggle());
    },

    resume() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    toggle() {
        this.enabled = !this.enabled;
        this.updateBtn();
        this.saveConfig();
        if (this.enabled) this.play('ok'); // 確認音
    },

    updateBtn() {
        const btn = document.getElementById('soundToggleBtn');
        if (btn) btn.textContent = this.enabled ? "♪ 音:ON" : "♪ 音:OFF";
    },

    saveConfig() {
        localStorage.setItem("santa_sound_config", JSON.stringify({ enabled: this.enabled }));
    },

    play(type) {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'happy') {
            // 明るい和音アルペジオ的なピコピコ
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
            gain.gain.setValueAtTime(this.volume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'ok') {
            // 優しい音
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(this.volume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'bad') {
            // 静かな音
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            gain.gain.setValueAtTime(this.volume * 0.5, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'streak') {
            // キラキラ
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
            osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6

            gain.gain.setValueAtTime(this.volume, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

            osc.start(now);
            osc.stop(now + 0.6);
        } else if (type === 'bonus') {
            // ボーナス用（少しリッチに）
            this.play('streak'); // 既存のstreak音を流用しつつ追加など
        }
    }
};

// Phase3: お手伝いUI更新関数
function updateHelpUI() {
    const gauge = helpTotal % 5;
    const helpBonus = Math.floor(helpTotal / 5);
    const remaining = gauge === 0 ? 5 : 5 - gauge;

    // ゲージ更新
    const gaugeEl = document.getElementById('helpGauge');
    if (gaugeEl) {
        const dots = gaugeEl.querySelectorAll('.gauge-dot');
        dots.forEach((dot, i) => {
            if (i < gauge) {
                dot.textContent = '●';
                dot.classList.add('filled');
            } else {
                dot.textContent = '○';
                dot.classList.remove('filled');
            }
        });
    }

    // 残り回数更新
    const remainingEl = document.getElementById('helpRemaining');
    if (remainingEl) {
        remainingEl.textContent = `あと${remaining}かいで ごほうびスタンプ+1！`;
    }

    // ボーナス表示更新
    const bonusEl = document.getElementById('helpBonusDisplay');
    if (bonusEl) {
        bonusEl.textContent = `スタンプ: ${helpBonus}こ`;
    }

    // Phase4: Hydrationが完了していたらボタンを有効化
    const btn = document.getElementById('helpButton');
    if (btn && isHydrated) {
        btn.disabled = false;
        btn.title = "お手伝いしたら押してね！";
    }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
    updateHeaderUI();
    renderDays();
    loadData(); // データ読み込みを追加
    setupResetButton();
    setupHelpButton();
    setupOnboarding();
    SoundManager.init();

    // タブ復帰（visibilitychange）で再描画（日付切り替わり対応）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateHeaderUI();
            renderDays();
        }
    });
});

/**
 * ヘッダーのタイトルとサブコピーをJST日付で更新する
 */
function updateHeaderUI() {
    const now = getJSTNow();
    const dateKey = formatDateToKey(now);
    const m = now.getMonth() + 1;
    const d = now.getDate();

    // タイトル
    const h1 = document.querySelector('header h1');
    if (h1) {
        h1.innerHTML = '<span class="title-mark">🎐</span> たこあげカレンダー';
    }
    document.title = "たこあげカレンダー";

    // サブコピー
    const sub = document.querySelector('header .sub');
    if (sub) {
        let msg = "きょうも たかく とぼう！";
        if (m === 2 && d === 3) {
            msg = "きょうから たこあげスタート！たかく とぼう！";
        } else if (m === 2 && d >= 4 && d <= 8) {
            msg = "まめまめしい いちにちを。きょうも たかく とぼう！";
        } else if (m === 3 && d >= 3 && d <= 8) {
            msg = "もうすぐ おひなさま。きょうも たかく とぼう！";
        } else if (m === 3 && d >= 14 && d <= 21) {
            msg = "春が まっています。きょうも たかく とぼう！";
        }
        sub.textContent = msg;
    }
}

/**
 * 導線A（初回おひっこし）の実装
 */
function setupOnboarding() {
    const ONBOARDING_KEY = "tako_onboarding_v1";
    const now = getJSTNow();
    const dateKey = formatDateToKey(now);

    // 2/3以降かつ未完了の場合のみ表示
    if (dateKey >= "2026-02-03" && !localStorage.getItem(ONBOARDING_KEY)) {
        showOnboardingModal();
    }
}

function showOnboardingModal() {
    const modal = document.createElement('div');
    modal.id = "takoOnboarding";
    modal.className = "onboarding-overlay";
    modal.innerHTML = `
        <div class="onboarding-card">
            <h2>🎐 たこあげスタート！</h2>
            <p>きょうから たこあげカレンダー！<br>いちにち 2かいまで スタンプをおせるよ。<br>たかく とぼう！</p>
            <div class="onboarding-btns">
                <button class="btn-primary" id="onboardingOk">スタート！</button>
                <button class="btn" id="onboardingLater">あとで</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
        localStorage.setItem("tako_onboarding_v1", "done");
        localStorage.setItem("themeId", "tako");
        modal.remove();
    };

    document.getElementById('onboardingOk').onclick = close;
    document.getElementById('onboardingLater').onclick = close;
}

// Phase4: お手伝いボタンのセットアップとイベントハンドリング
function setupHelpButton() {
    const btn = document.getElementById('helpButton');
    if (!btn) return;

    // 初期状態は disabled（ロード完了後に有効化）
    btn.disabled = true;
    btn.title = "よみこみちゅう...";

    // クリックイベント
    btn.addEventListener('click', () => {
        if (!isHydrated) return; // セーフティガード
        // 連打防止
        btn.disabled = true;

        // カウントアップ
        helpTotal++;

        // 音を鳴らす（UX向上）
        SoundManager.play('ok');

        // UI即時更新
        updateHelpUI();
        updatePoints(); // Phase5: スゴロク進行も即時更新

        // 保存実行 (localStorage + Supabase)
        saveData();

        // 連打防止解除（少し長めに取る）
        setTimeout(() => {
            btn.disabled = false;
        }, 800);
    });
}

async function loadData() {
    // 期間内リセット判定
    const now = getJSTNow();
    if (isInSeasonWindow(now)) {
        const storedId = localStorage.getItem(SEASON_ID_KEY);
        if (storedId !== CURRENT_SEASON_ID) {
            console.log("Season reset triggered (Local)");
            await performSeasonReset();
        }
    }

    // LocalStorageからデータ読み込み
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            appState = JSON.parse(raw);
        }
        const savedHelp = localStorage.getItem('tako_help_total');
        helpTotal = savedHelp ? parseInt(savedHelp, 10) : 0;
        if (isNaN(helpTotal)) helpTotal = 0;

        isHydrated = true;
        renderDays();
        updatePoints();
        updateHelpUI();
    } catch (e) {
        console.error("保存データの読み込みに失敗しました", e);
        isHydrated = true;
        updateHelpUI();
    }
}

/**
 * シーズンリセット実行
 */
async function performSeasonReset() {
    // メモリ上の進捗をクリア
    appState = {};
    helpTotal = 0;

    // localStorageの進捗をクリア
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('tako_help_total');
        localStorage.setItem(SEASON_ID_KEY, CURRENT_SEASON_ID);
    } catch (e) {
        console.error("Local reset error:", e);
    }
}

async function saveData() {
    // 【重要】初期ロードが完了するまでは保存しない（空データでの上書き防止）
    if (!isHydrated) {
        console.warn("Skipping save: Not hydrated yet.");
        return;
    }

    // デバウンス処理（連打対策：500ms待ってから保存）
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
        _performSave();
    }, 500);
}

// 実際の保存処理
async function _performSave() {
    // LocalStorageに保存
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        localStorage.setItem('tako_help_total', helpTotal.toString());
    } catch (e) {
        console.error("LocalStorage save error:", e);
    }

    showSaveStatus(true);
}

function showSaveStatus(success) {
    const el = document.getElementById("saveStatus");
    if (!el) return;
    el.classList.remove("fadeout");
    if (success) {
        el.textContent = "保存しました✓";
        el.style.color = "#006400";
        setTimeout(() => {
            el.classList.add("fadeout");
        }, 2000);

        // ボーナス演出発火（予約がある場合）
        if (window.pendingBonusAnimation) {
            window.pendingBonusAnimation = false;
            const overlay = document.getElementById('bonusOverlay');
            if (overlay) {
                overlay.classList.remove('active');
                void overlay.offsetWidth; // リフロー
                overlay.classList.add('active');
                SoundManager.play('bonus');
            }
        }
    } else {
        el.textContent = "未保存⚠︎";
        el.style.color = "red";
    }
}

function renderDays() {
    const container = document.getElementById("days");
    container.innerHTML = "";

    const current = new Date(START_DATE_JST);
    const nowJST = getJSTNow();
    const todayKey = formatDateToKey(nowJST);
    const end = new Date(END_DATE_JST);

    // Element storage
    let todayEl = null;
    const otherEls = [];

    while (current <= end) {
        // YYYY-MM-DD形式のキーを生成
        const dateKey = formatDateToKey(current);
        const displayDate = `${current.getMonth() + 1}/${current.getDate()}`;

        // 曜日の取得
        const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][current.getDay()];

        const dayEl = document.createElement("div");
        dayEl.className = "day";
        // 今日の場合は強調用クラスをつける（CSSで枠線を太くするなど任意だが、今回は並び順変更が主）
        if (dateKey === todayKey) {
            dayEl.classList.add("today-highlight");
        }

        let titleHtml = `${displayDate}（${dayOfWeek}）`;
        if (dateKey === todayKey) {
            titleHtml += " <span style='font-size:0.8em; color:#888;'>★きょう</span>";
        }

        // ボーナス達成バッジ（その日クリア）
        if (isGoodDay(dateKey)) {
            titleHtml += ` <span class="bonus-badge">BONUS✓</span>`;
        }

        dayEl.innerHTML = `
      <div class="day-title">${titleHtml}</div>
      ${createRowHtml(dateKey, 1)}
      ${createRowHtml(dateKey, 2)}
      ${(dateKey === todayKey && isGoodDay(dateKey)) ? '<div class="fuku-badge">福</div>' : ''}
    `;

        if (dateKey === todayKey) {
            todayEl = dayEl;
        } else {
            otherEls.push(dayEl);
        }

        // 日付を進める
        current.setDate(current.getDate() + 1);
    }

    // 表示順：今日があれば先頭、その後に他を順番通り
    if (todayEl) {
        container.appendChild(todayEl);
    }
    otherEls.forEach(el => container.appendChild(el));

    // ボタンにイベントリスナーを設定
    document.querySelectorAll(".choice").forEach(btn => {
        btn.addEventListener("click", handleChoiceClick);
    });
}

function createRowHtml(dateKey, time) {
    // 現在の選択状態を取得
    const savedValue = appState[dateKey]?.[time] || null;

    return `
    <div class="row">
      <label>${time === 1 ? "1かいめ" : "2かいめ"}</label>
      <div class="choices">
        ${createButtonHtml(dateKey, time, "🎐", savedValue)}
        ${createButtonHtml(dateKey, time, "🪁", savedValue)}
        ${createButtonHtml(dateKey, time, "🌥️", savedValue)}
      </div>
    </div>
  `;
}

function createButtonHtml(dateKey, time, type, savedValue) {
    const isSelected = savedValue === type ? "selected" : "";
    return `<button class="choice ${isSelected}" data-date="${dateKey}" data-time="${time}" data-type="${type}">${type}</button>`;
}

function handleChoiceClick(e) {
    const btn = e.target;
    const dateKey = btn.dataset.date;
    const time = btn.dataset.time;
    const type = btn.dataset.type;

    // 状態を更新
    if (!appState[dateKey]) {
        appState[dateKey] = {};
    }

    const todayKey = formatDateKey(getJSTNow());
    const wasGood = isGoodDay(todayKey); // 変更前の状態

    // トグル動作：既に選択されているものを押したら解除
    if (appState[dateKey][time] === type) {
        delete appState[dateKey][time];

        // 空になったらキー削除（データクリーンアップ）
        if (Object.keys(appState[dateKey]).length === 0) {
            delete appState[dateKey];
        }
    } else {
        // 上書き選択
        appState[dateKey][time] = type;

        // 音を鳴らす
        if (type === "🎐") SoundManager.play('happy');
        else if (type === "🪁") SoundManager.play('ok');
        else SoundManager.play('bad');
    }

    // ボーナス演出判定（保存処理とは非同期だが、操作直後のフィードバックとして予約）
    const isNowGood = isGoodDay(todayKey);
    if (!wasGood && isNowGood && dateKey === todayKey) {
        window.pendingBonusAnimation = true;
    }

    saveData();
    renderDays(); // 再描画して表示を更新
    updatePoints();
}

function updatePoints() {
    let totalBase = 0; // 基本点（スタンプの合計）
    let totalBonus = 0; // ボーナス点（1日2回達成の日数 × 1点）
    let todayBase = 0;
    let todayBonus = 0;

    // 今日の日付キーを取得（期間判定も兼ねる）
    const now = getJSTNow();
    const todayKey = formatDateKey(now);
    let isTodayInRange = false;

    // 期間内かチェック
    if (now >= START_DATE_JST && now <= END_DATE_JST) {
        isTodayInRange = true;
    }

    // 1. 基本点の集計
    Object.keys(appState).forEach(dateKey => {
        const dayData = appState[dateKey];
        if (dayData) {
            Object.values(dayData).forEach(val => {
                if (POINTS.hasOwnProperty(val)) {
                    totalBase += POINTS[val];
                }
            });

            // 今日の分を加算
            if (dateKey === todayKey) {
                Object.values(dayData).forEach(val => {
                    if (POINTS.hasOwnProperty(val)) {
                        todayBase += POINTS[val];
                    }
                });
            }
        }
    });

    // 2. ボーナス点の集計（期間内の日付について isGoodDay を判定）
    let checkDate = new Date(START_DATE_JST);
    while (checkDate <= END_DATE_JST) {
        const dKey = formatDateToKey(checkDate);
        if (isGoodDay(dKey)) {
            totalBonus += 1;
            if (dKey === todayKey) {
                todayBonus = 1;
            }
        }
        checkDate.setDate(checkDate.getDate() + 1);
    }

    const helpBonus = Math.floor(helpTotal / 5);
    const totalAll = totalBase + totalBonus + helpBonus;
    const todayAll = todayBase + todayBonus;

    // UI更新
    // 既存仕様維持：単純合計を表示
    document.getElementById("scoreTotal").textContent = totalAll;

    const todayEl = document.getElementById("scoreToday");
    if (isTodayInRange) {
        todayEl.textContent = todayAll;
        todayEl.parentElement.childNodes[0].textContent = "きょう ";
    } else {
        todayEl.textContent = "0";
        todayEl.parentElement.childNodes[0].textContent = "きょう（きかんがい） ";
    }

    // スゴロク描画（合計点と基本点を渡す）
    renderSugoroku(totalAll, totalBase);
    calculateStreak();
}

function calculateStreak() {
    const today = new Date();
    const todayKey = formatDateKey(today);

    // 期間内の日付リスト作成（開始日〜今日）
    let checkDate = new Date(START_DATE_JST);
    const dateKeys = [];
    while (checkDate <= END_DATE_JST && checkDate <= today) {
        dateKeys.push(formatDateToKey(checkDate));
        checkDate.setDate(checkDate.getDate() + 1);
    }

    // 逆順（今日から過去へ）でチェック
    // ストリークの定義：
    // 「連続成功数」。今日が成功なら+1、昨日が成功なら+1... 途切れたら終了
    // ただし「今日の分」がまだ未達成でも、昨日まで続いていれば「継続中」とみなして表示したいが、
    // 「今何日連続か」という事実は「完了した日の数」で数えるのが自然。

    let currentStreak = 0;
    // 日付昇順リストなので逆順ループ
    for (let i = dateKeys.length - 1; i >= 0; i--) {
        const dKey = dateKeys[i];
        if (isGoodDay(dKey)) {
            currentStreak++;
        } else {
            // 今日(dateKeys[dateKeys.length-1]) がダメでも、それが今日の未入力のせいなら、
            // ストリークが「途切れた」と判定するのは早いかもしれないが、
            // 「N日連続達成中！」というバッジは「完了形」の数を出すのがセオリー。
            // 昨日の時点で5日連続なら、今日も完了しないと「6日連続」にはならない。
            // よってシンプルに「直近から連続していくつGoodDayがあるか」を数える。
            break;
        }
    }

    // 表示更新
    const badge = document.getElementById("streakBadge");
    if (badge) {
        if (currentStreak >= 2) {
            badge.style.display = "inline-block";
            badge.textContent = `🔥 ${currentStreak}日連続！`;

            // ストリークが増えたら音（簡易実装：前回値より増えていれば鳴らす）
            // 注意: リロード時は lastStreak=0 なので鳴る可能性があるが、
            // ユーザー操作時以外は鳴らさない制御が必要。
            // 今回はシンプルに「SoundManager.play('streak')」を呼び出すだけに留める（updatePointsが頻繁に呼ばれる可能性を考慮し、状態管理が必要だが、最小実装）。
            // 安全策：streak音は updatePoints からは呼ばず、handleChoiceClick で判定するか、
            // ここで lastStreak と比較して増えた時だけ鳴らす。
            if (typeof lastStreak !== 'undefined' && currentStreak > lastStreak && lastStreak > 0) {
                SoundManager.play('streak');
            }
        } else {
            badge.style.display = "none";
        }
    }

    // グローバル変数として保持（簡易）
    window.lastStreak = currentStreak;

    // 予告メッセージ作成
    let forecastMsg = "";
    const todayData = appState[todayKey] || {};
    const val1 = todayData[1];
    const val2 = todayData[2];
    const isTodayGood = isGoodOrBetter(val1) && isGoodOrBetter(val2);

    if (isTodayGood) {
        forecastMsg = "きょうは ボーナス もらえた！";
    } else {
        let missing = 0;
        if (!isGoodOrBetter(val1)) missing++;
        if (!isGoodOrBetter(val2)) missing++;
        if (missing > 0) {
            forecastMsg = `きょう あと${missing}回🙂以上で ボーナス！`;
        }
    }

    const forecastEl = document.getElementById("forecastMsg");
    if (forecastEl) {
        forecastEl.textContent = forecastMsg;
        if (isTodayGood) {
            forecastEl.style.color = "#d32f2f";
            forecastEl.style.fontWeight = "bold";
        } else {
            forecastEl.style.color = "#555";
            forecastEl.style.fontWeight = "normal";
        }
    }
}

function isGoodDay(dateKey) {
    const d = appState[dateKey];
    if (!d) return false;
    return isGoodOrBetter(d[1]) && isGoodOrBetter(d[2]);
}

function isGoodOrBetter(val) {
    return val === "🎐" || val === "🪁";
}

function renderSugoroku(totalScore, baseScore) {
    const container = document.getElementById("sugorokuBoard");
    container.innerHTML = "";

    // スコアの上限は40（ゴール）
    const progress = Math.min(totalScore, 40);

    for (let i = 1; i <= 40; i++) {
        const sq = document.createElement("div");
        sq.className = "square";
        sq.textContent = i;

        // クラス適用
        // 1. 基本点で到達したか
        if (i <= baseScore && i <= 40) {
            sq.classList.add("cleared");
        }
        // 2. ボーナス点で到達したか（基本点より大きく、かつ合計点以内）
        else if (i > baseScore && i <= progress) {
            sq.classList.add("bonus-cleared");
            // ユーザー要件によりimg要素を生成・挿入
            const img = document.createElement("img");
            // file:// プロトコルでも正しく参照できるようにベースURIを使用
            img.src = new URL('assets/tako_bonus.svg', document.baseURI).href;
            img.alt = "たこあげ ボーナス";
            img.className = "bonus-img";
            sq.appendChild(img);
        }

        if (i === 40) {
            sq.classList.add("goal");
            if (progress >= 40) {
                sq.textContent = "ゴール";
            }
        }

        // 現在地（Totalで判定）
        if (totalScore > 0 && (i === progress)) {
            sq.classList.add("current");
        }

        container.appendChild(sq);
    }
}

function setupResetButton() {
    const btn = document.getElementById("resetBtn");
    btn.addEventListener("click", () => {
        if (confirm("ほんとうに ぜんぶ けしますか？")) {
            appState = {};
            helpTotal = 0;
            localStorage.removeItem('tako_help_total');
            saveData();
            renderDays();
            updatePoints();
            updateHelpUI();
        }
    });
}

// ヘルパー：Date -> "YYYY-MM-DD"
function formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Step 2: Timer Logic (Countdown)
let timerDuration = 600; // default 10min
// Step 3: State Management
let timerStatus = 'idle'; // 'idle' | 'running' | 'paused' | 'finished' | 'finished_alarm'
let tickTimerId = null;
let endAtMs = 0;
let remainingSec = 0; // Stored during pause

// Step 5: Web Audio API & Sound Settings
let soundEnabled = false; // Step 8C: Default OFF for first-time users (safety first)
let soundVolume = 0.5;   // Default 50%
let audioCtx = null;
let masterGain = null;
let alarmOscillator = null;
let alarmIntervalId = null;
let alarmAutoStopTimeoutId = null;
let alarmAutoStopped = false;

function setupTimer() {
    const presetSelect = document.getElementById("timerPreset");
    const customInput = document.getElementById("timerCustom");
    const startBtn = document.getElementById("timerStartBtn"); // Main screen start
    const overlay = document.getElementById("timerOverlay");
    const closeBtn = document.getElementById("timerCloseBtn");
    const display = document.getElementById("timerDisplay");

    // Step 4 Message
    const timerMessage = document.getElementById("timerMessage");

    // Step 3 UI Controls
    const overlayStartBtn = document.getElementById("timerOverlayStartBtn");
    const pauseBtn = document.getElementById("timerPauseBtn");
    const resumeBtn = document.getElementById("timerResumeBtn");
    const resetBtn = document.getElementById("timerResetBtn");
    // Step 4 Control
    const stopSoundBtn = document.getElementById("timerStopSoundBtn");

    // Step 7: Stamp CTA
    const timerStampBtn = document.getElementById("timerStampBtn");

    // Step 5 Sound Controls
    const soundToggle = document.getElementById("timerSoundToggle");
    const volumeSlider = document.getElementById("timerVolume");

    if (!presetSelect || !startBtn || !overlay || !customInput || !soundToggle || !volumeSlider || !timerStampBtn) return;

    // Load Sound Settings
    const storedSound = localStorage.getItem("timer_sound_enabled");
    if (storedSound !== null) soundEnabled = storedSound === "1";

    const storedVolume = localStorage.getItem("timer_sound_volume");
    if (storedVolume !== null) soundVolume = parseFloat(storedVolume);

    // Apply init settings to UI
    soundToggle.checked = soundEnabled;
    volumeSlider.value = Math.floor(soundVolume * 100);

    // Sound Control Listeners
    soundToggle.addEventListener("change", (e) => {
        soundEnabled = e.target.checked;
        localStorage.setItem("timer_sound_enabled", soundEnabled ? "1" : "0");

        // If alarm is currently active (UI is in alarm mode), toggle sound immediately
        if (timerStatus === 'finished_alarm') {
            if (soundEnabled) {
                startAlarmSound();
            } else {
                stopAlarmSound();
            }
        }
    });

    volumeSlider.addEventListener("input", (e) => {
        soundVolume = parseInt(e.target.value, 10) / 100;
        localStorage.setItem("timer_sound_volume", soundVolume.toFixed(2));
        // Update live volume
        if (masterGain) {
            masterGain.gain.setValueAtTime(soundVolume, audioCtx.currentTime);
        }
    });

    // Helper: Update duration based on active input
    const updateFromInput = () => {
        const customVal = parseInt(customInput.value, 10);
        if (!isNaN(customVal) && customVal > 0) {
            // Valid custom input (1-60)
            if (customVal < 1 || customVal > 60) {
                startBtn.disabled = true;
                startBtn.style.opacity = 0.5;
            } else {
                startBtn.disabled = false;
                startBtn.style.opacity = 1.0;
                timerDuration = customVal * 60;
                updateTimerDisplay(display, timerDuration);
            }
            presetSelect.style.opacity = 0.5;
            customInput.style.borderColor = "#006400";
        } else {
            // No custom input -> use Preset
            startBtn.disabled = false;
            startBtn.style.opacity = 1.0;
            timerDuration = parseInt(presetSelect.value, 10);
            updateTimerDisplay(display, timerDuration);
            presetSelect.style.opacity = 1.0;
            customInput.style.borderColor = "#ccc";
        }
    };

    // Helper: Update Control Visibility
    const updateControls = () => {
        if (!overlayStartBtn || !pauseBtn || !resumeBtn || !resetBtn || !stopSoundBtn || !timerMessage || !closeBtn) return;

        // Default hidden
        overlayStartBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        resetBtn.style.display = 'none'; // Changed default to none for cleaner logic below
        stopSoundBtn.style.display = 'none';
        timerMessage.style.display = 'none';
        closeBtn.style.display = 'block'; // Default visible
        if (timerStampBtn) timerStampBtn.style.display = 'none';

        if (timerStatus === 'idle') {
            overlayStartBtn.style.display = 'inline-block';
            resetBtn.style.display = 'block';
        } else if (timerStatus === 'running') {
            pauseBtn.style.display = 'inline-block';
            resetBtn.style.display = 'block';
        } else if (timerStatus === 'paused') {
            resumeBtn.style.display = 'inline-block';
            resetBtn.style.display = 'block';
        } else if (timerStatus === 'finished') {
            // Should not happen if we jump to finished_alarm, but for safety:
            overlayStartBtn.style.display = 'inline-block';
            overlayStartBtn.textContent = "もういちど";
            resetBtn.style.display = 'block';
        } else if (timerStatus === 'finished_alarm') {
            // Step 4: Alarm State
            stopSoundBtn.style.display = 'inline-block';
            timerMessage.style.display = 'block';
            closeBtn.style.display = 'none'; // Hide close button

            // Step 7: Show Stamp CTA
            if (timerStampBtn) timerStampBtn.style.display = 'inline-block';
        }

        if (timerStatus !== 'finished' && timerStatus !== 'finished_alarm') {
            overlayStartBtn.textContent = "スタート";
        }
    };

    // Preset Change
    presetSelect.addEventListener("change", (e) => {
        customInput.value = "";
        updateFromInput();
    });

    // Custom Input Change
    customInput.addEventListener("input", (e) => {
        updateFromInput();
    });

    // Start (Main Screen)
    startBtn.addEventListener("click", () => {
        const customVal = parseInt(customInput.value, 10);
        if (customInput.value && (isNaN(customVal) || customVal < 1 || customVal > 60)) {
            alert("1〜60ぷん の あいだで にゅうりょく してね");
            return;
        }

        ensureAudioUnlocked(); // Unlock Audio
        stopTimer();
        startTimerLogic();
    });

    // Start (Overlay)
    if (overlayStartBtn) {
        overlayStartBtn.addEventListener("click", () => {
            ensureAudioUnlocked(); // Unlock Audio
            stopTimer(); // Safety
            startTimerLogic();
        });
    }

    function startTimerLogic() {
        // Setup for start
        remainingSec = timerDuration; // Reset remaining
        endAtMs = Date.now() + timerDuration * 1000;
        timerStatus = 'running';

        // Step 8A: Reset auto-stop message
        const autoStopMsg = document.getElementById('timerAutoStopMsg');
        if (autoStopMsg) autoStopMsg.style.display = 'none';
        alarmAutoStopped = false;

        updateTimerDisplay(display, timerDuration);
        overlay.style.display = "flex";
        updateControls();

        tickTimerId = setInterval(() => tick(display), 200);
    }

    // Pause
    if (pauseBtn) {
        pauseBtn.addEventListener("click", () => {
            if (timerStatus !== 'running') return;
            // Calulate exact remaining (freeze it)
            // remainingSec is updated in tick, but let's be precise
            const now = Date.now();
            remainingSec = Math.max(0, Math.ceil((endAtMs - now) / 1000));

            clearInterval(tickTimerId);
            tickTimerId = null;
            timerStatus = 'paused';

            updateTimerDisplay(display, remainingSec);
            updateControls();
        });
    }

    // Resume
    if (resumeBtn) {
        resumeBtn.addEventListener("click", () => {
            if (timerStatus !== 'paused') return;

            // Recalculate endAt based on stored remainingSec
            endAtMs = Date.now() + remainingSec * 1000;
            timerStatus = 'running';

            updateControls();
            tickTimerId = setInterval(() => tick(display), 200);
        });
    }

    // Reset
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            stopTimer(); // Clears interval, sets idle
            // Reset display to selection
            updateFromInput();
            // Keep overlay open? Requirement C says yes.
            // Since we updatedFromInput, display is back to e.g. 10:00
            overlay.style.display = "flex";
            updateControls();
        });
    }

    // Stop Sound (Step 4)
    if (stopSoundBtn) {
        stopSoundBtn.addEventListener("click", () => {
            stopTimer(); // Sets idle (and stops alarm)
            overlay.style.display = "none"; // Return to main screen
            updateFromInput();
        });
    }

    // Step 7: Stamp CTA
    if (timerStampBtn) {
        timerStampBtn.addEventListener("click", () => {
            stopTimer(); // 1. Stop sound/timer
            overlay.style.display = "none"; // 2. Hide overlay
            updateFromInput();
            scrollToTodayAndHighlight(); // 3. Jump to today
        });
    }

    // Close
    closeBtn.addEventListener("click", () => {
        stopTimer();
        overlay.style.display = "none";
        updateFromInput();
    });

    // Initial control update when overlay is opened or page loaded
    updateControls();
    updateFromInput();
}

// Step 7 Helper
function scrollToTodayAndHighlight() {
    const todayKey = formatDateKey(new Date());
    // Find the element with class 'today-highlight'
    const todayEl = document.querySelector(".today-highlight");

    if (!todayEl) {
        console.log("Today element not found (maybe out of range)");
        return;
    }

    // Scroll
    todayEl.scrollIntoView({ behavior: "smooth", block: "center" });

    // Determine target to highlight
    const todayData = appState[todayKey] || {};
    let targetEl = null;

    if (!todayData[1]) {
        // 1st empty
        const btn = todayEl.querySelector('button[data-time="1"]');
        if (btn) targetEl = btn.closest('.row');
    } else if (!todayData[2]) {
        // 2nd empty
        const btn = todayEl.querySelector('button[data-time="2"]');
        if (btn) targetEl = btn.closest('.row');
    } else {
        // Both full -> highlight whole card
        targetEl = todayEl;
    }

    if (targetEl) {
        targetEl.classList.add("highlight-target");
        // Remove class after animation (1.5s)
        setTimeout(() => {
            targetEl.classList.remove("highlight-target");
        }, 1500);
    }
}

function stopTimer() {
    if (tickTimerId) {
        clearInterval(tickTimerId);
        tickTimerId = null;
    }
    stopAlarmSound(); // Step 5: Stop alarm if running
    timerStatus = 'idle';
    // Helper to force visible Close button if we stopped manually (e.g. from Alarm)
    // Actually updateControls handles this if status is idle.
    // However, if we just call stopTimer(), status becomes idle but UI not updated until explicit call.
    // In event handlers above, we call updateControls().
    // If called from elsewhere, might need explicit update.
}

function tick(displayEl) {
    const now = Date.now();
    // Only update if running (double check)
    if (timerStatus !== 'running') return;

    remainingSec = Math.ceil((endAtMs - now) / 1000);

    if (remainingSec <= 0) {
        remainingSec = 0;
        clearInterval(tickTimerId);
        tickTimerId = null;
        timerStatus = 'finished_alarm'; // Step 4: Alarm State

        startAlarmSound(); // Step 5: Start Alarm

        // Setup timer helper inside tick is hard to access for updateControls() ref.
        // We need updateControls() to run.
        // Re-querying exact same way as setupTimer:
        const pauseBtn = document.getElementById("timerPauseBtn");
        const resumeBtn = document.getElementById("timerResumeBtn");
        const overlayStartBtn = document.getElementById("timerOverlayStartBtn");
        const resetBtn = document.getElementById("timerResetBtn");
        const stopSoundBtn = document.getElementById("timerStopSoundBtn");
        const timerMessage = document.getElementById("timerMessage");
        const closeBtn = document.getElementById("timerCloseBtn");

        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
        if (overlayStartBtn) overlayStartBtn.style.display = 'none';

        if (stopSoundBtn) stopSoundBtn.style.display = 'inline-block';
        if (timerMessage) timerMessage.style.display = 'block';
        if (closeBtn) closeBtn.style.display = 'none';
    }

    updateTimerDisplay(displayEl, remainingSec);
}

// Step 5: Web Audio Functions
function ensureAudioUnlocked() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // Update gain in case it wasn't set (or reset on creation)
    if (masterGain) {
        masterGain.gain.setValueAtTime(soundVolume, audioCtx.currentTime);
    }
}

function startAlarmSound() {
    // Check if enabled
    if (!soundEnabled || soundVolume <= 0) {
        console.log("Alarm silent (disabled or volume 0)");
        return;
    }

    // Prevent double start
    if (alarmIntervalId) return;

    ensureAudioUnlocked();

    // Step 8A: 60-second auto-stop failsafe
    alarmAutoStopped = false;
    if (alarmAutoStopTimeoutId) clearTimeout(alarmAutoStopTimeoutId);
    alarmAutoStopTimeoutId = setTimeout(() => {
        stopAlarmSound();
        alarmAutoStopped = true;
        // Show auto-stop message
        const autoStopMsg = document.getElementById('timerAutoStopMsg');
        if (autoStopMsg) autoStopMsg.style.display = 'block';
        console.log("Alarm auto-stopped after 60 seconds");
    }, 60000);

    // Loop sparkle function (Step 6)
    const playSparkle = () => {
        if (!audioCtx || !masterGain) return;
        const now = audioCtx.currentTime;

        // Sparkle Arpeggio: A4 -> C#5 -> E5 -> A5 (Kirakira Rising)
        // Adjust keys for child-friendly gentle sound
        // Let's use: C5(523), E5(659), G5(784), C6(1046) - Major Chord
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const times = [0.0, 0.12, 0.24, 0.36];

        notes.forEach((freq, i) => {
            const t = now + times[i];
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.connect(gain);
            gain.connect(masterGain);

            osc.type = 'triangle'; // Soft but clear
            osc.frequency.setValueAtTime(freq, t);

            // Envelope: Short Attack, Decay (Bell-like)
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.8, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3); // Fade out

            osc.start(t);
            osc.stop(t + 0.35); // Stop after envelope
        });
    };

    // Play immediately
    playSparkle();
    // Repeat every 1.2s (0.36 + fade is short, but we want space between loops)
    alarmIntervalId = setInterval(playSparkle, 1200);
}

function stopAlarmSound() {
    if (alarmIntervalId) {
        clearInterval(alarmIntervalId);
        alarmIntervalId = null;
    }
    // Step 8A: Clear auto-stop timeout
    if (alarmAutoStopTimeoutId) {
        clearTimeout(alarmAutoStopTimeoutId);
        alarmAutoStopTimeoutId = null;
    }
    stopAlarmPlayback(); // Stop any currently playing continuous sound
}

function stopAlarmPlayback() {
    // If we were using a continuous oscillator, we'd stop it here.
    // Since we use fire-and-forget loops, we rely on clearing interval.
    // However, if we want to silence immediately:
    if (masterGain && audioCtx) {
        // Ramp down master volume quickly to avoid click
        masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

        // We need to restore volume for next time though!
        // So better: Master gain logic is strictly volume control.
        // We should just stop scheduling new beeps (which clearInterval does).
        // The current beep (0.5s) will finish. That is acceptable.

        // BUT if user toggles "Sound Off", we wanted silence.
        // So yes, ramp down is good, but then we need `startAlarmSound` to reset it.
        // Or simpler: don't touch masterGain here, just let the beep finish.
        // It's only 0.5s.
    }
}

function updateTimerDisplay(el, seconds) {
    if (!el) return;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
}

// Add to initialization
document.addEventListener("DOMContentLoaded", () => {
    setupTimer();
});

// Step 8B: Sleep/Wake Resilience
function handleWakeUp() {
    if (document.hidden) return; // Only on visible

    const now = Date.now();

    if (timerStatus === 'running') {
        if (now >= endAtMs) {
            // Timer ended during sleep - trigger alarm
            if (tickTimerId) {
                clearInterval(tickTimerId);
                tickTimerId = null;
            }
            remainingSec = 0;
            timerStatus = 'finished_alarm';

            // Update display
            const display = document.getElementById('timerDisplay');
            if (display) updateTimerDisplay(display, 0);

            // Trigger alarm UI
            const pauseBtn = document.getElementById("timerPauseBtn");
            const resumeBtn = document.getElementById("timerResumeBtn");
            const overlayStartBtn = document.getElementById("timerOverlayStartBtn");
            const resetBtn = document.getElementById("timerResetBtn");
            const stopSoundBtn = document.getElementById("timerStopSoundBtn");
            const timerMessage = document.getElementById("timerMessage");
            const closeBtn = document.getElementById("timerCloseBtn");
            const timerStampBtn = document.getElementById("timerStampBtn");

            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (resetBtn) resetBtn.style.display = 'none';
            if (overlayStartBtn) overlayStartBtn.style.display = 'none';
            if (stopSoundBtn) stopSoundBtn.style.display = 'inline-block';
            if (timerMessage) timerMessage.style.display = 'block';
            if (closeBtn) closeBtn.style.display = 'none';
            if (timerStampBtn) timerStampBtn.style.display = 'inline-block';

            startAlarmSound();
            console.log("Timer ended during sleep - alarm triggered on wake");
        } else {
            // Still running - resync display
            const display = document.getElementById('timerDisplay');
            if (display) {
                remainingSec = Math.ceil((endAtMs - now) / 1000);
                updateTimerDisplay(display, remainingSec);
            }
        }
    } else if (timerStatus === 'finished_alarm') {
        // Ensure AudioContext is resumed (may have been suspended during sleep)
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                console.log("AudioContext resumed on wake");
            });
        }
    }
}

document.addEventListener("visibilitychange", handleWakeUp);
