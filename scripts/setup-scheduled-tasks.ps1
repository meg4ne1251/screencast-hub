# setup-scheduled-tasks.ps1
# メディアセンターVM 自動起動タスク一括登録
# 管理者権限で実行すること（右クリック → 管理者として実行）
#
# 起動順序:
#   +5s  ScreencastHub-01-PortalServer   : http-server (port 3000)
#   +10s ScreencastHub-02-AppLauncher    : app-launcher (port 3001)
#   +15s ScreencastHub-03-WindowManager  : AirServer/Browser 切り替えスクリプト
#   +20s ScreencastHub-04-KioskBrowser   : Edge Kioskモード
#   毎日 0:00 ScreencastHub-AutoShutdown : 自動シャットダウン

$username = $env:USERNAME
$noLimitSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Write-Host "=== 自動起動タスク登録開始 ===" -ForegroundColor Cyan

# --- 1. http-server（ポータル配信） ---
$action1 = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c http-server C:\Users\$username\screencast-hub\portal\dist -p 3000 -c-1 --cors"
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$trigger1.Delay = "PT5S"
Register-ScheduledTask -TaskName "ScreencastHub-01-PortalServer" `
  -Action $action1 -Trigger $trigger1 -Settings $noLimitSettings `
  -Description "Screencast Hub Portal - http-server (port 3000)" -Force
Write-Host "  [OK] ScreencastHub-01-PortalServer" -ForegroundColor Green

# --- 2. app-launcher（アプリ起動API） ---
$action2 = New-ScheduledTaskAction `
  -Execute "node.exe" `
  -Argument "C:\Users\$username\screencast-hub\app-launcher\server.js"
$trigger2 = New-ScheduledTaskTrigger -AtLogOn
$trigger2.Delay = "PT10S"
Register-ScheduledTask -TaskName "ScreencastHub-02-AppLauncher" `
  -Action $action2 -Trigger $trigger2 -Settings $noLimitSettings `
  -Description "Screencast Hub Portal - App Launcher API (port 3001)" -Force
Write-Host "  [OK] ScreencastHub-02-AppLauncher" -ForegroundColor Green

# --- 3. ウィンドウ監視スクリプト ---
# AutoHotkey版を使う場合は $useAhk = $true に変更
$useAhk = $false

if ($useAhk) {
  $action3 = New-ScheduledTaskAction `
    -Execute "C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe" `
    -Argument "C:\Users\$username\screencast-hub\scripts\window-manager.ahk"
} else {
  $action3 = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Users\$username\screencast-hub\scripts\window-manager.ps1"
}
$trigger3 = New-ScheduledTaskTrigger -AtLogOn
$trigger3.Delay = "PT15S"
Register-ScheduledTask -TaskName "ScreencastHub-03-WindowManager" `
  -Action $action3 -Trigger $trigger3 -Settings $noLimitSettings `
  -Description "Screencast Hub Portal - AirServer/Browser Window Manager" -Force
Write-Host "  [OK] ScreencastHub-03-WindowManager" -ForegroundColor Green

# --- 4. Edge Kioskモード ---
$action4 = New-ScheduledTaskAction `
  -Execute "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  -Argument "http://localhost:3000 --kiosk --edge-kiosk-type=fullscreen --user-data-dir=C:\KioskData --no-first-run --disable-features=TranslateUI --autoplay-policy=no-user-gesture-required --window-position=0,0"
$trigger4 = New-ScheduledTaskTrigger -AtLogOn
$trigger4.Delay = "PT20S"
Register-ScheduledTask -TaskName "ScreencastHub-04-KioskBrowser" `
  -Action $action4 -Trigger $trigger4 -Settings $noLimitSettings `
  -Description "Screencast Hub Portal - Edge Kiosk Mode" -Force
Write-Host "  [OK] ScreencastHub-04-KioskBrowser" -ForegroundColor Green

# --- 5. 自動シャットダウン（毎日0:00） ---
$action5 = New-ScheduledTaskAction `
  -Execute "shutdown.exe" `
  -Argument '/s /t 60 /c "メディアセンターVM: 自動シャットダウン（60秒後）"'
$trigger5 = New-ScheduledTaskTrigger -Daily -At "00:00"
Register-ScheduledTask -TaskName "ScreencastHub-AutoShutdown" `
  -Action $action5 -Trigger $trigger5 `
  -Description "メディアセンターVM 毎日0:00に自動シャットダウン" -Force
Write-Host "  [OK] ScreencastHub-AutoShutdown" -ForegroundColor Green

Write-Host ""
Write-Host "=== 登録完了 ===" -ForegroundColor Green
Write-Host "登録済みタスク一覧:" -ForegroundColor Cyan
Get-ScheduledTask -TaskName "ScreencastHub-*" | Format-Table TaskName, State, Description -AutoSize
