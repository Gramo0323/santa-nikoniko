# A3: 証拠 (fix_helpPoints)

## Commit 1: fix(help): set isHydrated after supabase load

### T1-T3 手動テスト結果
- **isHydrated の確認**: ページロード後に `true` になっていることを Console で確認。
- **保存処理**: +1 クリック時に "Skipping save..." の警告が出ず、localStorage が更新されることを確認。
- **復元**: ページリロード後も増加したカウントが維持されている。

#### 証拠画像
![Commit 1 検証録画](file:///Users/itoyuta/.gemini/antigravity/brain/2bc2393f-7234-45f1-b57c-608aee669101/test_commit1_hydration_1766112928719.webp)

## Commit 2: fix(help): disable help actions until hydration completes

### T1-T3 手動テスト結果
- **ロード中無効化**: ページロード開始直後、ボタンが `disabled` かつ title が `よみこみちゅう...` であることを確認。
- **ロード完了後有効化**: Hydration 完了後にボタンが活性化し、操作可能になることを確認。
- **データ整合性**: ロード完了後にクリックした分が正しく保存され、リロード後も維持される。

#### 証拠画像
![Commit 2 検証録画](file:///Users/itoyuta/.gemini/antigravity/brain/2bc2393f-7234-45f1-b57c-608aee669101/test_commit2_guard_1766113271955.webp)
> [!NOTE]
> 録画では、初期状態でボタンがグレーアウト（無効化）されており、ロード完了後に緑色の活性状態に切り替わる様子が確認できます。
