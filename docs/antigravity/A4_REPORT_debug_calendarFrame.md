# A4_REPORT_debug_calendarFrame.md

## 1. 根因の特定
- **再現条件**: ログイン成功時（Supabaseからのデータロード成功時）にのみ発生。
- **根因**: `app.js` 内の `loadDataFromSupabase()` 関数の `try` ブロックにおいて、データの加工と状態更新の後に `renderDays()`（カレンダー描画関数）を呼び出す処理が欠落している。
- **場所**: `app.js` の 330行目付近（`isHydrated = true;` の直後）。

## 2. 影響範囲
- ログインして利用するユーザー全員に影響。
- 未ログインのユーザーには影響しない。
- エラー発生時（`catch` ブロック）は逆に描画されるため、通信成功時のみ「消える」という不可解な挙動となっている。

## 3. フェーズ2（最小修正）への提案

### 変更点
1.  **[MODIFY] app.js**: `loadDataFromSupabase` の `try` ブロック最後に `renderDays();` を追加。
2.  **[MODIFY] index.html**: `#days`（カレンダー枠）を `#helpSection` の前、または `main` の先頭に移動し、スクロールなしで見えるようにする（視認性の改善）。

### 修正後テスト3本
1.  **ログイン後表示確認**: Magic Link等でログインし、カレンダー枠が表示されること。
2.  **再ログイン/リロード確認**: ログイン状態でリロードしても枠が消えないこと。
3.  **データ反映確認**: ログイン後に表示された枠でスタンプを押し、保存後にリロードして状態が維持されていること。

## 4. フェーズ3（GitHub push）の手順提案
- **ブランチ名**: `bugfix/calendar-frame-missing`
- **コミット方針**:
    - `fix: call renderDays after successful supabase load`
    - `style: move calendar frame above help section for better visibility`
- **コマンド**:
    ```bash
    git checkout -b bugfix/calendar-frame-missing
    git add app.js index.html
    git commit -m "fix: restore calendar frame for logged-in users"
    git push origin bugfix/calendar-frame-missing
    ```
