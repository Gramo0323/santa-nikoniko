# A3: 証拠 (fix_helpPoints)

## Commit 1: fix(help): set isHydrated after supabase load

### T1-T3 手動テスト結果
- **isHydrated の確認**: ページロード後に `true` になっていることを Console で確認。
- **保存処理**: +1 クリック時に "Skipping save..." の警告が出ず、localStorage が更新されることを確認。
- **復元**: ページリロード後も増加したカウントが維持されている。

#### 証拠画像
![Commit 1 検証録画](file:///Users/itoyuta/.gemini/antigravity/brain/2bc2393f-7234-45f1-b57c-608aee669101/test_commit1_hydration_1766112928719.webp)
> [!NOTE]
> 録画では、isHydrated が true であること、およびリロード後に値が保持されている様子を確認できます。
