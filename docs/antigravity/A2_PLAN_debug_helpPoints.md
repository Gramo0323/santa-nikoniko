# A2: 調査計画 (debug_helpPoints)

## 観測ポイント
- [ ] DOM状態: `helpButton` の `disabled` 属性の有無。
- [ ] イベント: クリック時に `console.log` が出力されるか（一時的に追加可）。
- [ ] State: `helpTotal` 変数の変化。
- [ ] 永続化: `localStorage.getItem("helpTotal")` の値。

## 調査手順
1. **Phase0: ベースライン再現**
   - ブラウザで開き、現状の挙動を録画/ログ採取。
2. **Phase1: クリック処理の切り分け**
   - `app.js` の `helpButton` ハンドラを特定。
   - `addEventListener` が呼ばれているか確認。
3. **Phase2: localStorageの切り分け**
   - DevTools Applicationタブで `localStorage` の値を確認。
   - `saveData` / `loadData` 関数のロジックを確認。
4. **Phase3: コード解析**
   - `helpTotal` の初期化、更新、保存のフローを追跡。
   - `DOMContentLoaded` 時の処理順序を確認。
