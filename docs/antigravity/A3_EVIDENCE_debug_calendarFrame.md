# A3_EVIDENCE_debug_calendarFrame.md

## 1. 再現テストの結果 (未ログイン時)
- **状態**: 正常（枠あり）
- **Evidence**: `initial_unlogged_view.png`, `scrolled_view.png`
- **内容**: 未ログイン（LocalStorageロード）時は、ページ下部にカレンダー枠が表示される。

## 2. 再現テストの結果 (ログイン時シミュレーション)
- **状態**: 異常（枠書き換えなし/消失）
- **Evidence**:
  - ブラウザコンソールでのシミュレーションにより、`loadDataFromSupabase` の正常系パス（tryブロック）を通った後に `#days` の内容が更新されないことを確認。
  - `renderDays()` が呼び出されていないことが Console 出力から判明。

## 3. 根因のコード抜粋 (`app.js`)
```javascript
// app.js:280
async function loadDataFromSupabase(userId) {
    try {
        // ... 中略 ...
        updatePoints();
        updateHelpUI();
        isHydrated = true; 
        // ここに renderDays(); が必要だが、欠落している
    } catch (e) {
        console.error("Supabase load error:", e);
        // ... 中略 ...
        renderDays(); // catchブロックには存在する
    }
}
```

## 4. DOMの状態 (異常時)
- `#days` 要素自体は存在するが、中身が空（`innerHTML = ""`）または初期状態のまま更新されない。
- CSS の `display: none` 等による消失ではなく、JS による要素生成プロセスのスキップであると断定。
