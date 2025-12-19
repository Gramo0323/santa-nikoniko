# A2: 修正計画 (fix_helpPoints)

## 変更点

### app.js
- `loadDataFromSupabase`:
  - `try` ブロックの最後、および `catch` ブロック（または全体の `finally`）で `isHydrated = true` を設定。
- `setupHelpButton`:
  - 初期化時の `btn.removeAttribute('disabled')` を削除（または明示的に `disabled` にする）。
  - クリックハンドラ冒頭に `if (!isHydrated) return;` のガードを追加。
- `loadData` / `loadDataFromSupabase`:
  - ロード完了後に `updateHelpUI()` を呼ぶ直前で、ボタンの `disabled` を解除する。

### styles.css
- `.help-btn:disabled` のスタイルを調整し、読み込み中であることが視覚的に分かるようにする（薄くする等）。

## 影響範囲
- おてつだい機能全般。
- データの保存・復元フロー。

## ロールバック方針
- `git checkout app.js styles.css` で元の状態に戻す。

## 手動テスト計画
### コミット1後
- **T1**: ログインして +1 実行 -> 保存メッセージ確認 -> リロード -> 復元確認。
### コミット2後
- **T2**: 超低速回線（を模してログ確認）でのロード中、ボタンが押せないことを確認。
- **T3**: ロード完了の瞬間にボタンが有効になることを確認。
