# A2_PLAN_debug_calendarFrame.md

## 調査計画

### 1. 観測ポイント
- **DOM**: `#days` 要素の直下の子要素（`.day`）が生成されているか。
- **Console**: JavaScriptエラー（特に `Promise` 内の未キャッチ例外）が発生していないか。
- **Network**: Supabaseへの通信が 200 OK で返っているか。
- **JavaScript State**: ログイン後の `isHydrated` フラグや `appState` の値が正しいか。

### 2. 切り分け手順
1.  **未ログインでの起動**: ブラウザのシークレットモード等で開き、LocalStorage経由で枠が出るか確認。
2.  **ログイン処理のシミュレート**: ブラウザコンソールから `loadDataFromSupabase` が呼ばれるフローを追い、描画関数 `renderDays` がどの経路で呼ばれるか（あるいは呼ばれないか）を静的解析と動的実行で確認。
3.  **DOM生成タイミングの確認**: `DOMContentLoaded` 時、またはデータ取得完了時のどのタイミングで `#days` が更新されるべきかをコードから特定。
4.  **CSSの確認**: 要素が存在するのに見えない場合（`display: none` 等）を Computed スタイルで確認。

### 3. 使用ツール
- Browser Subagent (DevTools / Console / Elements)
- 静的コード解析 (grep / view_file)
- ローカルサーバー (python3 http.server)
