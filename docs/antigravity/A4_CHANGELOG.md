# A4: CHANGELOG (fix_helpPoints)

## [2025-12-25] ログイン成功時にカレンダー枠が消失する不具合の修正

### 修正内容
1.  **起動時の先行描画**:
    - `DOMContentLoaded` イベント直後に `renderDays()` を呼び出すように変更しました。これにより、Supabaseとの同期を待たずにページ下部のカレンダー枠（日付とスタンプ欄）が即座に表示されます。
2.  **ロード完了後の描画保証 (finally)**:
    - `loadDataFromSupabase` 関数をリファクタリングし、`try-catch-finally` 構造を導入しました。
    - `finally` ブロック内で `renderDays()` を呼び出すようにしたことで、データ取得の成功・失敗に関わらず、同期完了後に必ず正しい状態（保存データ反映済み）で枠が描画されることを保証しました。

### 影響範囲
- `app.js`: `DOMContentLoaded` リスナー、および `loadDataFromSupabase` 関数。

### 手動テスト結果
- **未ログイン起動**: 正常。起動直後に枠が表示される。
- **ログイン後表示**: 正常。ロード完了後も枠が維持/同期される。
- **スタンプ連携**: 正常。スタンプ押下でおてつだい/スゴロクが連動して更新される。

## [main 反映状況]
- 修正内容は現在 `bugfix/calendar-frame-missing` ブランチにあります（未push）。

## [公開手順（手動Netlify運用）]
1. `bugfix/calendar-frame-missing` ブランチを `main` へ反映（またはマージ）。
2. GitHub に push（ここまでの作業を Antigravity が担当）。
3. Netlify へのアップロード（手動デプロイ）をユーザーが実施。
4. 公開 URL で「ログイン後もカレンダー枠が正常に表示されること」を最終確認（QA）。
