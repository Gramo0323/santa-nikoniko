// 期間設定（固定）
const START_DATE = new Date("2025-12-12");
const END_DATE = new Date("2025-12-24");
const STORAGE_KEY = "santa_nikoniko_v1";
const BOARD_ID = "b4a467a1-5f6a-4023-8e55-5390a3e98d2a";

const POINTS = { "😊": 2, "🙂": 1, "😢": 0 };

// 状態管理
let appState = {};
let supabaseClient = null;
let isHydrated = false; // 初期ロード完了フラグ
let saveTimeout = null; // デバウンス用タイマー

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

// 初期化
document.addEventListener("DOMContentLoaded", () => {
    initSupabase();
    // loadData() は initSupabase -> setupAuth -> updateAuthUI の流れで呼ばれるように変更
    setupResetButton();
    SoundManager.init();
});

async function loadData() {
    // ログイン中の場合、Supabaseから取得
    if (supabaseClient) {
        const session = await supabaseClient.auth.getSession();
        if (session && session.data.session) {
            await loadDataFromSupabase(session.data.session.user.id);
            return;
        }
    }

    // 未ログインまたはエラー時はlocalStorage
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            appState = JSON.parse(raw);
        }
        isHydrated = true; // LocalStorage読み込み完了でHydratedとする（未ログイン時）
        renderDays();
        updatePoints();
    } catch (e) {
        console.error("保存データの読み込みに失敗しました", e);
        // エラーでも操作可能にするためHydratedにはする（ただし空データ）
        isHydrated = true;
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
    // 常にlocalStorageには保存（オフライン対応/バックアップ）
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
        console.error("LocalStorage save error:", e);
    }

    // ログイン中ならSupabaseにも保存
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await saveDataToSupabase(session.user.id);
        } else {
            // ローカルのみ保存の場合もSaved表示
            showSaveStatus(true);
        }
    } else {
        showSaveStatus(true);
    }
}

async function loadDataFromSupabase(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('progress')
            .select('date, session, value')
            .eq('board_id', BOARD_ID)
            .gte('date', formatDateKey(START_DATE))
            .lte('date', formatDateKey(END_DATE));

        if (error) throw error;

        // DB形式 ([{date: "...", session: 1, value: "good"}, ...]) を appState形式に変換
        // マッピング: good->😊, ok->🙂, bad->😢
        // 逆マッピング用のオブジェクト
        const DB_TO_UI = { "good": "😊", "ok": "🙂", "bad": "😢" };

        const newState = {};
        if (data) {
            data.forEach(row => {
                if (!newState[row.date]) newState[row.date] = {};
                const uiValue = DB_TO_UI[row.value];
                if (uiValue) {
                    newState[row.date][row.session] = uiValue;
                }
            });
        }

        appState = newState;

        // 【重要】Supabaseから取得したデータをLocalStorageにも反映（キャッシュ同期）
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        } catch (e) {
            console.error("LocalStorage sync error:", e);
        }

        isHydrated = true; // Supabase同期完了
        console.log("Supabase(progress)からデータを読み込みました");
        renderDays();
        updatePoints();

    } catch (e) {
        console.error("Supabase load error:", e);
        // エラー時でも、とりあえずLocalStorageにあるものでHydratedとする（操作不能を防ぐ）
        // ただし、appStateは更新していないので、既にLocalStorageからロード済みならそのまま
        if (!isHydrated) {
            // まだ一度も表示していないならLocalStorageから復元を試みる最終手段
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) appState = JSON.parse(raw);
            } catch (localE) { }
            isHydrated = true;
            renderDays();
            updatePoints();
        }
    }
}

async function saveDataToSupabase(userId) {
    // UI -> DB マッピング
    const UI_TO_DB = { "😊": "good", "🙂": "ok", "😢": "bad" };

    // appState を progress テーブル用に変換
    const updates = [];

    Object.keys(appState).forEach(dateKey => {
        Object.keys(appState[dateKey]).forEach(sessionKey => {
            const uiVal = appState[dateKey][sessionKey];
            const dbVal = UI_TO_DB[uiVal];

            if (dbVal) {
                updates.push({
                    board_id: BOARD_ID,
                    date: dateKey,
                    session: parseInt(sessionKey, 10),
                    value: dbVal,
                    updated_by: userId,
                    updated_at: new Date().toISOString()
                });
            }
        });
    });

    if (updates.length === 0) return;

    try {
        // board_id + date + session がユニーク制約になっている前提
        const { error } = await supabaseClient
            .from('progress')
            .upsert(updates, { onConflict: 'board_id, date, session' });

        if (error) throw error;
        if (error) throw error;
        console.log("Supabase(progress)に保存しました");
        showSaveStatus(true);
    } catch (e) {
        console.error("Supabase save error:", e);
        showSaveStatus(false);
    }
}

async function deleteStampFromSupabase(dateKey, sessionKey) {
    if (!supabaseClient) return;

    // ログインチェック
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    try {
        const { error } = await supabaseClient
            .from('progress')
            .delete()
            .eq('board_id', BOARD_ID) // 現状の固定ID運用に合わせる
            .eq('date', dateKey)
            .eq('session', parseInt(sessionKey, 10));

        if (error) throw error;
        console.log(`Supabaseから削除しました: ${dateKey} - ${sessionKey}`);
        showSaveStatus(true);
    } catch (e) {
        console.error("Supabase delete error:", e);
        showSaveStatus(false);
    }
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

    const current = new Date(START_DATE);
    const now = new Date();
    const todayKey = formatDateKey(now);

    // Element storage
    let todayEl = null;
    const otherEls = [];

    while (current <= END_DATE) {
        // YYYY-MM-DD形式のキーを生成
        const dateKey = formatDateKey(current);
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
        ${createButtonHtml(dateKey, time, "😊", savedValue)}
        ${createButtonHtml(dateKey, time, "🙂", savedValue)}
        ${createButtonHtml(dateKey, time, "😢", savedValue)}
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

    const todayKey = formatDateKey(new Date());
    const wasGood = isGoodDay(todayKey); // 変更前の状態

    // トグル動作：既に選択されているものを押したら解除
    if (appState[dateKey][time] === type) {
        delete appState[dateKey][time];
        // Supabaseからも即座に削除
        deleteStampFromSupabase(dateKey, time);

        // 空になったらキー削除（データクリーンアップ）
        if (Object.keys(appState[dateKey]).length === 0) {
            delete appState[dateKey];
        }
    } else {
        // 上書き選択
        appState[dateKey][time] = type;

        // 音を鳴らす
        if (type === "😊") SoundManager.play('happy');
        else if (type === "🙂") SoundManager.play('ok');
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
    const now = new Date();
    const todayKey = formatDateKey(now);
    let isTodayInRange = false;

    // 期間内かチェック（簡易的：開始日〜終了日の範囲内か）
    if (now >= START_DATE && now <= END_DATE) {
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
    let checkDate = new Date(START_DATE);
    while (checkDate <= END_DATE) {
        const dKey = formatDateKey(checkDate);
        if (isGoodDay(dKey)) {
            totalBonus += 1;
            if (dKey === todayKey) {
                todayBonus = 1;
            }
        }
        checkDate.setDate(checkDate.getDate() + 1);
    }

    const totalAll = totalBase + totalBonus;
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
    let checkDate = new Date(START_DATE);
    const dateKeys = [];
    while (checkDate <= END_DATE && checkDate <= today) {
        dateKeys.push(formatDateKey(checkDate));
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
    return val === "😊" || val === "🙂";
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
            img.src = new URL('assets/bonus-santa.png', document.baseURI).href;
            img.alt = "BONUS Santa";
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
            saveData(); // Supabase側も空にすべきだが、saveDataの実装上 updates=[] になると消えない。
            // 明示的に削除処理を入れる
            if (supabaseClient) {
                supabaseClient.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                        // 期間内のデータを削除
                        supabaseClient.from('progress')
                            .delete()
                            .eq('board_id', BOARD_ID)
                            .gte('date', formatDateKey(START_DATE))
                            .lte('date', formatDateKey(END_DATE))
                            .then(() => {
                                console.log("Supabaseデータを全削除しました");
                            });
                    }
                });
            }
            renderDays();
            updatePoints();
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

async function initSupabase() {
    const statusEl = document.getElementById("supabase-status");
    if (!statusEl) return;

    if (typeof supabase === 'undefined') {
        statusEl.textContent = "Supabase: SDK not loaded";
        statusEl.style.color = "red";
        return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.startsWith("YOUR_")) {
        statusEl.textContent = "Supabase: Pending config";
        statusEl.style.color = "orange";
        return;
    }

    try {
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 接続確認のため軽量なリクエストを送信
        const { error } = await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        statusEl.textContent = "Supabase: connected";
        statusEl.style.color = "green";
        console.log("Supabase initialized successfully");

        // Auth初期化
        setupAuth();

    } catch (e) {
        console.error("Supabase connection error:", e);
        statusEl.textContent = "Supabase: not connected";
        statusEl.style.color = "red";
    }
}

function setupAuth() {
    if (!supabaseClient) return;

    // セッション状態監視
    supabaseClient.auth.onAuthStateChange((event, session) => {
        updateAuthUI(session);
    });

    // 初期セッション確認（非同期）
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        updateAuthUI(session);
    });

    // リスナー設定
    const sendBtn = document.getElementById("sendMagicLinkBtn");
    if (sendBtn) {
        sendBtn.addEventListener("click", async () => {
            const emailInput = document.getElementById("emailInput");
            const email = emailInput.value;
            const msgEl = document.getElementById("authMessage");

            if (!email) {
                alert("メールアドレスを入力してください");
                return;
            }

            msgEl.textContent = "送信中...";
            msgEl.style.color = "#666";
            sendBtn.disabled = true;

            const { error } = await supabaseClient.auth.signInWithOtp({
                email: email,
                options: {
                    emailRedirectTo: window.location.origin, // サイトのルートに戻る
                }
            });

            if (error) {
                console.error("Login error:", error);
                msgEl.textContent = "エラー: " + error.message;
                msgEl.style.color = "red";
                sendBtn.disabled = false;
            } else {
                msgEl.textContent = "ログインリンクを送信しました！メールを確認してください。";
                msgEl.style.color = "green";
                // ボタンはそのままdisabledにしておく（連打防止）
                setTimeout(() => { sendBtn.disabled = false; }, 5000);
            }
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                console.error("Logout error:", error);
            }
            // onAuthStateChangeが呼ばれるのでここでUI更新は不要
        });
    }
}

function updateAuthUI(session) {
    const loginForm = document.getElementById("loginForm");
    const userInfo = document.getElementById("userInfo");
    const userEmailEl = document.getElementById("userEmail");
    const userIdEl = document.getElementById("userId");

    if (session) {
        // ログイン中
        loginForm.style.display = "none";
        userInfo.style.display = "block";
        userEmailEl.textContent = session.user.email;
        userIdEl.textContent = session.user.id;

        // ログインしたらデータ再読み込み
        loadData();
    } else {
        // 未ログイン
        loginForm.style.display = "block";
        userInfo.style.display = "none";
        userEmailEl.textContent = "";
        userIdEl.textContent = "";
        document.getElementById("authMessage").textContent = ""; // メッセージクリア

        // ログアウトしたらデータ再読み込み（localStorageに戻る）
        loadData();
    }
}

// Step 2: Timer Logic (Countdown)
let timerDuration = 600; // default 10min
// Step 3: State Management
let timerStatus = 'idle'; // 'idle' | 'running' | 'paused' | 'finished'
let tickTimerId = null;
let endAtMs = 0;
let remainingSec = 0; // Stored during pause

function setupTimer() {
    const presetSelect = document.getElementById("timerPreset");
    const customInput = document.getElementById("timerCustom");
    const startBtn = document.getElementById("timerStartBtn"); // Main screen start
    const overlay = document.getElementById("timerOverlay");
    const closeBtn = document.getElementById("timerCloseBtn");
    const display = document.getElementById("timerDisplay");

    // Step 3 UI Controls
    const overlayStartBtn = document.getElementById("timerOverlayStartBtn");
    const pauseBtn = document.getElementById("timerPauseBtn");
    const resumeBtn = document.getElementById("timerResumeBtn");
    const resetBtn = document.getElementById("timerResetBtn");

    if (!presetSelect || !startBtn || !overlay || !customInput) return;

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
        if (!overlayStartBtn || !pauseBtn || !resumeBtn || !resetBtn) return;

        // Default hidden
        overlayStartBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        resetBtn.style.display = 'block'; // Always visible in overlay

        if (timerStatus === 'idle') {
            overlayStartBtn.style.display = 'inline-block';
        } else if (timerStatus === 'running') {
            pauseBtn.style.display = 'inline-block';
        } else if (timerStatus === 'paused') {
            resumeBtn.style.display = 'inline-block';
        } else if (timerStatus === 'finished') {
            // Maybe show Reset only? Or Start?
            overlayStartBtn.style.display = 'inline-block';
            overlayStartBtn.textContent = "もういちど";
            resetBtn.style.display = 'inline-block';
        }

        if (timerStatus !== 'finished') {
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

        stopTimer();
        startTimerLogic();
    });

    // Start (Overlay)
    if (overlayStartBtn) {
        overlayStartBtn.addEventListener("click", () => {
            stopTimer(); // Safety
            startTimerLogic();
        });
    }

    function startTimerLogic() {
        // Setup for start
        remainingSec = timerDuration; // Reset remaining
        endAtMs = Date.now() + timerDuration * 1000;
        timerStatus = 'running';

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

    // Close
    closeBtn.addEventListener("click", () => {
        stopTimer();
        overlay.style.display = "none";
        updateFromInput();
    });

    // Initial control update when overlay is opened or page loaded
    // This ensures correct button states if timer was running/paused before refresh
    updateControls();
    // Also ensure display is correct on load
    updateFromInput();
}

function stopTimer() {
    if (tickTimerId) {
        clearInterval(tickTimerId);
        tickTimerId = null;
    }
    timerStatus = 'idle';
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
        timerStatus = 'finished';

        // Update UI controls to show "Finished" state (Start/Reset)
        // We need to access updateControls... but it's inside setupTimer scope.
        // Quick fix: Trigger a click or event? Or move helper out?
        // Let's just update display here, and UI controls might lag until clicked?
        // Better: Make updateControls accessible or just minimal handle here.
        // Actually, the tick function is outside. 
        // Let's rely on the fact that when finished, user sees 00:00.
        // If they click "Reset", it handles properly.
        // Ideally we update buttons too.
        // Let's expose a global event or just re-query in tick? 
        // Simple: Just update display. The buttons (Pause) will remain visible but ineffective until clicked?
        // No, Pause button visible at 00:00 is weird.
        // Let's do simple DOM hiding here since we know IDs.
        const pauseBtn = document.getElementById("timerPauseBtn");
        const resumeBtn = document.getElementById("timerResumeBtn");
        const overlayStartBtn = document.getElementById("timerOverlayStartBtn");

        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (overlayStartBtn) {
            overlayStartBtn.style.display = 'inline-block';
            overlayStartBtn.textContent = "もういちど";
        }
    }

    updateTimerDisplay(displayEl, remainingSec);
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
