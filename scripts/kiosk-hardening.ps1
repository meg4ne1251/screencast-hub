# kiosk-hardening.ps1
# メディアセンターVM Kiosk ハードニング設定
# 管理者権限で実行すること（右クリック → 管理者として実行）

Write-Host "=== Kioskハードニング開始 ===" -ForegroundColor Cyan

# --- ロック画面を無効化 ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\Personalization" `
  /v NoLockScreen /t REG_DWORD /d 1 /f

# --- スクリーンセーバーを無効化 ---
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveActive /t REG_SZ /d 0 /f

# --- 通知センターを無効化 ---
reg add "HKCU\Software\Policies\Microsoft\Windows\Explorer" `
  /v DisableNotificationCenter /t REG_DWORD /d 1 /f

# --- Cortana / 検索バーを無効化 ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\Windows Search" `
  /v AllowCortana /t REG_DWORD /d 0 /f

# --- タスクバーの検索を非表示 ---
reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" `
  /v SearchboxTaskbarMode /t REG_DWORD /d 0 /f

# --- Sticky Keys（固定キー）のショートカットを無効化 ---
reg add "HKCU\Control Panel\Accessibility\StickyKeys" `
  /v Flags /t REG_SZ /d 506 /f

# --- Filter Keys のショートカットを無効化 ---
reg add "HKCU\Control Panel\Accessibility\Keyboard Response" `
  /v Flags /t REG_SZ /d 122 /f

# --- Toggle Keys のショートカットを無効化 ---
reg add "HKCU\Control Panel\Accessibility\ToggleKeys" `
  /v Flags /t REG_SZ /d 58 /f

# --- 電源プランを「高パフォーマンス」に設定 ---
powercfg /setactive 8c5e7fda-e8bf-45a6-a6cc-4b3c9be882a7

# --- ディスプレイの電源オフを無効化（常時オン） ---
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

# --- Windows Update の自動再起動を無効化 ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" `
  /v NoAutoRebootWithLoggedOnUsers /t REG_DWORD /d 1 /f

# --- Edge の「ページ翻訳しますか？」を無効化 ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" `
  /v TranslateEnabled /t REG_DWORD /d 0 /f

# --- Edge の「デフォルトブラウザに設定しますか？」を無効化 ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" `
  /v DefaultBrowserSettingEnabled /t REG_DWORD /d 0 /f

# --- Edge のホームページをポータルに固定 ---
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" `
  /v HomepageLocation /t REG_SZ /d "http://localhost:3000" /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" `
  /v HomepageIsNewTabPage /t REG_DWORD /d 0 /f

Write-Host "=== ハードニング完了（再起動後に有効） ===" -ForegroundColor Green
