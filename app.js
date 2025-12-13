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

// 初期化
document.addEventListener("DOMContentLoaded", () => {
    initSupabase();
    // loadData() は initSupabase -> setupAuth -> updateAuthUI の流れで呼ばれるように変更
    setupResetButton();
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
        }
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
        console.log("Supabase(progress)に保存しました");

    } catch (e) {
        console.error("Supabase save error:", e);
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
            dayEl.classList.add("today-highlight"); // 必要ならCSS追加。今回はJSで並び順制御のみでもOKだが、クラスは振っておく
        }

        dayEl.innerHTML = `
      <div class="day-title">${displayDate}（${dayOfWeek}）${dateKey === todayKey ? " <span style='font-size:0.8em; color:#888;'>★きょう</span>" : ""}</div>
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
    }

    saveData();
    renderDays(); // 再描画して表示を更新
    updatePoints();
}

function updatePoints() {
    let totalScore = 0;
    let todayScore = 0;

    // 今日の日付キーを取得（期間判定も兼ねる）
    const now = new Date();
    const todayKey = formatDateKey(now);
    let isTodayInRange = false;

    // 期間内かチェック（簡易的：開始日〜終了日の範囲内か）
    if (now >= START_DATE && now <= END_DATE) {
        isTodayInRange = true;
    }

    // 全データの集計
    Object.keys(appState).forEach(dateKey => {
        const dayData = appState[dateKey];
        if (dayData) {
            Object.values(dayData).forEach(val => {
                if (POINTS.hasOwnProperty(val)) {
                    totalScore += POINTS[val];
                }
            });

            // 今日の分を加算
            if (dateKey === todayKey) {
                Object.values(dayData).forEach(val => {
                    if (POINTS.hasOwnProperty(val)) {
                        todayScore += POINTS[val];
                    }
                });
            }
        }
    });

    // UI更新
    document.getElementById("scoreTotal").textContent = totalScore;

    const todayEl = document.getElementById("scoreToday");
    if (isTodayInRange) {
        todayEl.textContent = todayScore;
        todayEl.parentElement.childNodes[0].textContent = "きょう ";
    } else {
        todayEl.textContent = "0";
        todayEl.parentElement.childNodes[0].textContent = "きょう（きかんがい） ";
    }

    renderSugoroku(totalScore);
}

function renderSugoroku(score) {
    const container = document.getElementById("sugorokuBoard");
    container.innerHTML = "";

    // スコアの上限は40（ゴール）
    const progress = Math.min(score, 40);

    for (let i = 1; i <= 40; i++) {
        const sq = document.createElement("div");
        sq.className = "square";
        sq.textContent = i;

        // クラス適用
        if (i <= progress) {
            sq.classList.add("cleared");
        }

        if (i === 40) {
            sq.classList.add("goal");
            if (progress >= 40) {
                sq.textContent = "ゴール";
            }
        }

        // 現在地（0より大きく、かつ まだゴールしていないか、これがゴールなら）
        // 仕様：進み＝全期間合計点。40以上はゴール扱い。
        // scoreが0のときは何も選択されていない
        if (score > 0 && (i === progress)) {
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
