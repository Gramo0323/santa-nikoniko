# A3_EVIDENCE_fix_calendarFrame.md

## 1. 未ログイン起動時の描画保証 (T1)
- **状態**: 正常（枠あり）
- **Evidence**: `calendar_days_unlogged_in_1766617109702.png`
- **内容**: ページロード直後、データの存在有無に関わらず `#days` 要素がレンダリングされ、カレンダー枠が表示されていることを確認。

## 2. ログインロード完了後の描画保証 (T2)
### シミュレーションによる検証
- **原理証明**: 
  - `loadDataFromSupabase()` の `finally` ブロックに `renderDays()` を配置。
  - ブラウザコンソールでのシミュレーションにより、`loadDataFromSupabase` のフロー終了後に `#days` が描画された状態を維持することを確認。
- **結果**: 成功。

### 実ログイン/セッション復元による検証
- **実施日時**: 2025-12-25
- **手順**: 既存セッションがある状態でリロード。自動的に Supabase からのロードが行われるのを観測。
- **期待結果**: ロード完了後も `#days`（カレンダー枠）が消失せず、保存スタンプも復元される。
- **実結果**: PASS
- **Evidence**: `calendar_frame_with_santa_road_1766617784214.png`
- **詳細観測**:
  - **Network**: Supabase REST API 経由で `progress` データの取得を確認。
  - **Elements**: `#days` 配下に 13個の `.day` 要素が生成されている（`dayCount: 13`）。
  - **State**: 保存済みのスタンプ（mood）が `selected` クラスとして反映されている（`selectedCount: 2`）。

## 3. スタンプ/おてつだい回帰テスト (T3)
- **状態**: 正常
- **内容**: 
  - スタンプ選択（😊/🙂/😢）により `appState` が更新され、即座に画面に反映されることを確認。
  - おてつだいボタン（+1）が動作し、ゲージおよびスタンプ数が正常にカウントアップされることを確認。
- **Consoleログ**: 
  `Supabase initialized successfully`
  エラーなし。
