# Phase 5: Kiosk化・結合テスト（最終仕上げ）詳細手順書

## 概要
Phase 1〜4で構築した各コンポーネントを統合し、「電源を入れたら自動でポータルが立ち上がるスマートテレビ」として完成させる。

### 完成時の動作フロー
```
VM起動
  → Windows 11 自動サインイン
    → http-server 起動（ポータル配信）
    → app-launcher 起動（アプリ起動API）
    → AirServer 起動（キャスト受信）
    → Unified Remote Server 起動（リモート操作）
    → Edge Kioskモードでポータルが全画面表示
      → リモコンでサービスを選択・起動
      → AirPlayキャスト時はキャスト画面が最前面に
      → キャスト終了後はポータルに自動復帰
```

---

## Step 1: Microsoft Edge Kioskモードの設定

### 1-1. なぜEdgeか
- Windows 11とのネイティブ統合が優秀
- Kioskモード用の専用フラグが充実
- Chrome「正しく終了できませんでした」問題が発生しない
- DRM（Widevine L1）対応で、ブラウザ内でのNetflix高画質再生もフォールバックとして使える

### 1-2. Kioskモード起動コマンド

```cmd
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ^
  http://localhost:3000 ^
  --kiosk ^
  --edge-kiosk-type=fullscreen ^
  --user-data-dir=C:\KioskData ^
  --no-first-run ^
  --disable-features=TranslateUI ^
  --autoplay-policy=no-user-gesture-required ^
  --window-position=0,0
```

**各フラグの意味：**

| フラグ | 効果 |
|--------|------|
| `--kiosk` | 全画面モード、アドレスバー・メニュー・ツールバーを非表示 |
| `--edge-kiosk-type=fullscreen` | デジタルサイネージ向けフルスクリーン |
| `--user-data-dir=C:\KioskData` | 専用プロファイル（通常ブラウジングと分離） |
| `--no-first-run` | 初回起動ウィザードをスキップ |
| `--disable-features=TranslateUI` | 翻訳バーを無効化 |
| `--autoplay-policy=no-user-gesture-required` | 動画の自動再生を許可 |

### 1-3. Kioskモード内での動作

- **URL遷移は可能** → ポータルからYouTube等のストリーミングサイトに移動できる
- **アドレスバーは非表示** → 直接URL入力はできない（Unified Remoteのキーボードで代替）
- **Alt+Home** → ホームページ（ポータル）に戻る
- **F11** → フルスクリーン切り替え（通常はKioskが常時フルスクリーン）

### 1-4. ホームページの設定

Kioskモードの起動URLが `http://localhost:3000` なので、ポータルがホームページになる。
追加で、Edge のレジストリ設定でホームページを固定：

```powershell
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v HomepageLocation /t REG_SZ /d "http://localhost:3000"
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v HomepageIsNewTabPage /t REG_DWORD /d 0
```

### 1-5. ショートカットの作成

```powershell
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut("C:\Users\$env:USERNAME\Desktop\ScreencastHubPortal-Kiosk.lnk")
$shortcut.TargetPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$shortcut.Arguments = 'http://localhost:3000 --kiosk --edge-kiosk-type=fullscreen --user-data-dir=C:\KioskData --no-first-run --disable-features=TranslateUI --autoplay-policy=no-user-gesture-required'
$shortcut.Save()
```

---

## Step 2: AirServer ⇔ Kioskブラウザのウィンドウ共存

### 2-1. 課題
AirServerがキャストを受信すると自前のウィンドウを開くが、Kioskモードのブラウザが最前面を占有しているため、キャスト画面が見えない可能性がある。

### 2-2. 解決策: ウィンドウ監視スクリプト（AutoHotkey）

AutoHotkeyを使って、AirServerの状態を監視し、自動でウィンドウの前後を切り替える。

**AHKスクリプト: `C:\Scripts\window-manager.ahk`**

```autohotkey
#Persistent
#SingleInstance Force
SetTitleMatchMode, 2

; === 設定 ===
KioskTitle := "Screencast Hub"            ; Edgeウィンドウのタイトルに含まれる文字列
AirServerExe := "AirServer.exe"
CheckInterval := 1000             ; 監視間隔（ミリ秒）
WasAirServerActive := false

; === メインループ ===
SetTimer, CheckWindowState, %CheckInterval%
return

CheckWindowState:
    ; AirServerのウィンドウが存在し、サイズが一定以上ならキャスト中と判定
    WinGet, airserverHwnd, ID, ahk_exe %AirServerExe%

    if (airserverHwnd) {
        WinGetPos, ax, ay, aw, ah, ahk_id %airserverHwnd%

        ; ウィンドウサイズが100x100以上ならキャスト中と判断
        if (aw > 100 && ah > 100) {
            if (!WasAirServerActive) {
                ; キャスト開始 → AirServerを最前面に
                WinSet, AlwaysOnTop, On, ahk_id %airserverHwnd%
                WinActivate, ahk_id %airserverHwnd%
                WasAirServerActive := true
            }
            return
        }
    }

    ; キャスト終了 → ブラウザを最前面に復帰
    if (WasAirServerActive) {
        WasAirServerActive := false

        ; AirServerのAlwaysOnTopを解除
        WinGet, airserverHwnd, ID, ahk_exe %AirServerExe%
        if (airserverHwnd) {
            WinSet, AlwaysOnTop, Off, ahk_id %airserverHwnd%
            WinMinimize, ahk_id %airserverHwnd%
        }

        ; Edgeをフォアグラウンドに
        WinActivate, %KioskTitle%
    }
return
```

### 2-3. AutoHotkeyのインストールと設定

1. https://www.autohotkey.com からAutoHotkey v2をダウンロード・インストール
2. 上記スクリプトを `C:\Scripts\window-manager.ahk` に保存
3. 動作テスト: ダブルクリックでスクリプトを実行
4. 正しく動いたらスタートアップに登録（Step 4で設定）

### 2-4. 代替案: PowerShellベースの監視

AutoHotkeyを入れたくない場合のPowerShell版：

```powershell
# window-manager.ps1
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
"@

$wasAirServerActive = $false

while ($true) {
    $airserver = Get-Process -Name "AirServer" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }

    if ($airserver) {
        # AirServerのウィンドウが存在 → キャスト中
        if (-not $wasAirServerActive) {
            [WinAPI]::SetForegroundWindow($airserver.MainWindowHandle)
            $wasAirServerActive = $true
        }
    } else {
        # AirServerのウィンドウなし → キャスト終了
        if ($wasAirServerActive) {
            $edge = Get-Process -Name "msedge" -ErrorAction SilentlyContinue |
                Where-Object { $_.MainWindowTitle -like "*Screencast Hub*" } |
                Select-Object -First 1
            if ($edge) {
                [WinAPI]::SetForegroundWindow($edge.MainWindowHandle)
            }
            $wasAirServerActive = $false
        }
    }

    Start-Sleep -Seconds 1
}
```

---

## Step 3: Windows 11 Kioskハードニング

Kiosk用途に不要なUIや通知を無効化する。

### 3-1. 一括設定スクリプト（PowerShell 管理者権限）

```powershell
# ========================================
# メディアセンターVM Kiosk ハードニング設定
# 管理者権限で実行すること
# ========================================

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

Write-Host "=== ハードニング完了（再起動後に有効） ===" -ForegroundColor Green
```

### 3-2. タスクバーの自動非表示（オプション）

Kioskモードではタスクバーは通常隠れるが、念のため：
```
設定 → 個人用設定 → タスクバー → タスクバーの動作 → 「タスクバーを自動的に隠す」をオン
```

---

## Step 4: 自動起動シーケンスの構成

### 4-1. 起動順序と方法

VM起動後、以下の順序でサービスを起動する。後続コンポーネントが前のコンポーネントに依存するため、遅延を入れて順次起動。

| 順序 | コンポーネント | 起動方法 | 遅延 | 備考 |
|------|---------------|---------|------|------|
| 1 | Unified Remote Server | Windows Service | 0s | インストール時にService登録済み |
| 2 | AirServer | スタートアップ | 0s | 内蔵の自動起動設定 |
| 3 | http-server (ポータル) | タスクスケジューラ | 5s | ポート3000でReact SPA配信 |
| 4 | app-launcher (API) | タスクスケジューラ | 10s | ポート3001でアプリ起動API |
| 5 | ウィンドウ監視スクリプト | タスクスケジューラ | 15s | AHK or PowerShell |
| 6 | Edge Kioskモード | タスクスケジューラ | 20s | 全サービス起動後に起動 |

### 4-2. タスクスケジューラ一括登録スクリプト

```powershell
# ========================================
# メディアセンターVM 自動起動タスク一括登録
# 管理者権限で実行すること
# ========================================

$username = $env:USERNAME

# --- 1. http-server（ポータル配信） ---
$action1 = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c http-server C:\Users\$username\yamato-portal\build -p 3000 -c-1 --cors"
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$settings1 = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$delay1 = New-TimeSpan -Seconds 5
$trigger1.Delay = "PT5S"
Register-ScheduledTask -TaskName "ScreencastHub-01-PortalServer" `
  -Action $action1 -Trigger $trigger1 -Settings $settings1 `
  -Description "Screencast Hub Portal - http-server (port 3000)" -Force

# --- 2. app-launcher（アプリ起動API） ---
$action2 = New-ScheduledTaskAction `
  -Execute "node.exe" `
  -Argument "C:\Users\$username\app-launcher\server.js"
$trigger2 = New-ScheduledTaskTrigger -AtLogOn
$trigger2.Delay = "PT10S"
Register-ScheduledTask -TaskName "ScreencastHub-02-AppLauncher" `
  -Action $action2 -Trigger $trigger2 -Settings $settings1 `
  -Description "Screencast Hub Portal - App Launcher API (port 3001)" -Force

# --- 3. ウィンドウ監視スクリプト ---
$action3 = New-ScheduledTaskAction `
  -Execute "C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe" `
  -Argument "C:\Scripts\window-manager.ahk"
$trigger3 = New-ScheduledTaskTrigger -AtLogOn
$trigger3.Delay = "PT15S"
Register-ScheduledTask -TaskName "ScreencastHub-03-WindowManager" `
  -Action $action3 -Trigger $trigger3 -Settings $settings1 `
  -Description "Screencast Hub Portal - AirServer/Browser Window Manager" -Force

# --- 4. Edge Kioskモード ---
$action4 = New-ScheduledTaskAction `
  -Execute "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  -Argument "http://localhost:3000 --kiosk --edge-kiosk-type=fullscreen --user-data-dir=C:\KioskData --no-first-run --disable-features=TranslateUI --autoplay-policy=no-user-gesture-required"
$trigger4 = New-ScheduledTaskTrigger -AtLogOn
$trigger4.Delay = "PT20S"
Register-ScheduledTask -TaskName "ScreencastHub-04-KioskBrowser" `
  -Action $action4 -Trigger $trigger4 -Settings $settings1 `
  -Description "Screencast Hub Portal - Edge Kiosk Mode" -Force

Write-Host "=== 自動起動タスク登録完了 ===" -ForegroundColor Green
Write-Host "タスク一覧: ScreencastHub-01 ~ ScreencastHub-04" -ForegroundColor Cyan
```

### 4-3. 起動の確認

```powershell
# 登録されたタスクを確認
Get-ScheduledTask -TaskName "ScreencastHub-*" | Format-Table TaskName, State, Description
```

---

## Step 5: 遠隔起動・自動シャットダウン

### 5-1. Proxmox VMの自動起動

Proxmox WebUIから設定：
```
Proxmox WebUI → VM <VMID> (メディアセンターVM)
  → Options → Start at boot: Yes
  → Start/Shutdown order: 2（他のVMより後に起動）
  → Startup delay: 30（秒）
```

→ Proxmoxホスト起動時にVMも自動起動する。

### 5-2. 自動シャットダウン（スケジュール）

毎日深夜0時にVMをシャットダウン：

```powershell
# Windows側: タスクスケジューラで設定
$action = New-ScheduledTaskAction -Execute "shutdown.exe" -Argument "/s /t 60 /c `"メディアセンターVM: 自動シャットダウン（60秒後）`""
$trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
Register-ScheduledTask -TaskName "ScreencastHub-AutoShutdown" `
  -Action $action -Trigger $trigger `
  -Description "メディアセンターVM 毎日0:00に自動シャットダウン" -Force
```

### 5-3. Wake-on-LAN（WoL）によるリモート起動

**VM側の設定:**
1. Proxmox VMのネットワークアダプタのMACアドレスを確認
2. Windows VM内: デバイスマネージャー → ネットワークアダプタ → プロパティ → 電源管理 → 「このデバイスでコンピューターのスタンバイを解除できるようにする」にチェック

**Proxmox側からの起動:**
```bash
# Proxmoxホストから VMを起動（WoLではなくQEMU API）
qm start <VMID>
```

**スマートフォンからの起動:**
1. Androidに「Wake on LAN」アプリをインストール
2. VMのMACアドレスとIPアドレスを登録
3. ボタン一発でVMを起動

**またはProxmox APIからの起動:**
```bash
# curlでProxmox APIを叩いてVM起動（スマホのショートカットに登録可能）
curl -k -b "PVEAuthCookie=$TICKET" \
  https://proxmox-host:8006/api2/json/nodes/pve/qemu/<VMID>/status/start \
  -X POST
```

### 5-4. スマートプラグ連動（発展）

プロジェクター（プロジェクター）の電源ONに連動してVMを起動する構成：

```
[スマートプラグ ON（プロジェクターの電源）]
  → IFTTT / Home Assistant がフックを受信
    → Proxmox APIを叩いてVM <VMID>を起動
      → VM起動 → 自動サインイン → ポータル表示
```

※ これは将来の拡張アイデア。まずはスマホアプリからの手動起動で運用。

---

## Step 6: 結合テストシナリオ

### テスト1: フルブートシーケンス
```
手順:
1. Proxmox WebUIからVM <VMID>を起動
2. 何も操作せずに待つ

期待結果:
- Windows 11が自動サインインする
- 20秒後にEdge KioskモードでポータルUIが全画面表示される
- 時計が正しく表示されている
- 6つのサービスカードが表示されている
```

### テスト2: リモコンでNetflix起動→ポータル復帰
```
手順:
1. Unified Remoteアプリを開く
2. 「Screencast Hub Portal」カスタムリモートを選択
3. 十字キーでNetflixにフォーカス
4. OKボタン（Enter）を押す
5. Netflixで何かを再生
6. 「ポータルに戻る」ボタンを押す

期待結果:
- フォーカスがNetflixカードに移動し、カードが拡大する
- Netflixアプリが起動する（またはブラウザでNetflixが開く）
- 「ポータルに戻る」でポータル画面に戻る
```

### テスト3: AirPlayキャスト→自動復帰
```
手順:
1. ポータルが表示された状態で待機
2. MacBookからAirPlayミラーリングを開始
3. MacBookの画面がプロジェクターに表示されることを確認
4. AirPlayミラーリングを停止

期待結果:
- キャスト中: AirServerのウィンドウが最前面に表示される
- キャスト終了後: ウィンドウ監視スクリプトが検知し、ポータルが自動復帰
- 復帰までの時間: 1〜3秒以内
```

### テスト4: Google Cast→自動復帰
```
手順:
1. ポータルが表示された状態で待機
2. AndroidからGoogle Cast（画面キャスト）を開始
3. Android画面がプロジェクターに表示されることを確認
4. Google Castを停止

期待結果:
- テスト3と同様の挙動
```

### テスト5: ストリーミング中のキャスト割り込み
```
手順:
1. ポータルからYouTubeを起動（ブラウザ内で再生中）
2. MacBookからAirPlayを開始

期待結果:
- YouTube再生がバックグラウンドに回る
- AirServerのキャスト画面が最前面に
- キャスト終了後、Edgeが最前面に復帰（YouTubeの再生位置は維持）
```

### テスト6: 自動シャットダウン→翌日起動
```
手順:
1. 深夜0時に自動シャットダウンが実行されることを確認
2. 翌日、スマホアプリまたはProxmox APIからVMを起動

期待結果:
- 0:00にシャットダウン通知（60秒カウントダウン）が表示される
- VMがシャットダウンする
- 翌日の起動でフルブートシーケンス（テスト1）が正常に動作する
```

### テスト7: config.jsonの編集
```
手順:
1. RDPでVMに接続（またはUnified Remoteのキーボード操作）
2. C:\Users\...\yamato-portal\build\config.json を編集
3. 新しいサービス（例: TVer）を追加
4. Edgeをリロード（Unified RemoteでF5を送信）

期待結果:
- 新しいサービスカードがグリッドに表示される
- 十字キーで新しいカードにフォーカスできる
- Enterで新しいサービスが起動する
```

---

## Step 7: 動作確認チェックリスト（最終）

### Kiosk化
- [ ] Edge Kioskモードでポータルが全画面表示される
- [ ] アドレスバー・ツールバーが非表示
- [ ] ポータルからストリーミングサイトに遷移できる
- [ ] Alt+Homeでポータルに戻れる

### ウィンドウ管理
- [ ] AirPlayキャスト受信時にAirServerが最前面に来る
- [ ] キャスト終了後にEdgeが自動で最前面に復帰する
- [ ] ウィンドウ監視スクリプトが常駐動作している

### 自動起動
- [ ] VM起動→自動サインイン→ポータル表示が完全自動
- [ ] http-serverが自動起動してポート3000で配信
- [ ] app-launcherが自動起動してポート3001で待機
- [ ] AirServerが自動起動してキャスト受信可能
- [ ] Unified Remote Serverが自動起動して操作可能

### Kioskハードニング
- [ ] ロック画面が無効化されている
- [ ] スクリーンセーバーが無効化されている
- [ ] 通知センターが無効化されている
- [ ] 固定キー（Sticky Keys）のショートカットが無効化されている
- [ ] ディスプレイが自動オフしない

### 遠隔操作
- [ ] スマホからUnified RemoteでVM操作可能
- [ ] MacBookからAirPlayキャスト可能
- [ ] AndroidからGoogle Cast可能
- [ ] Proxmox API / スマホアプリからVM起動可能

### 電源管理
- [ ] Proxmoxホスト起動時にVMが自動起動する
- [ ] 毎日0:00に自動シャットダウンされる
- [ ] WoLまたはProxmox APIで遠隔起動できる

---

## トラブルシューティング

### ポータルが表示されない（白画面）
1. http-serverが起動しているか確認: `curl http://localhost:3000`
2. タスクスケジューラの「ScreencastHub-01-PortalServer」の状態を確認
3. ビルドフォルダにindex.htmlが存在するか確認

### Edge Kioskが起動しない
1. タスクスケジューラの「ScreencastHub-04-KioskBrowser」が実行されたか確認
2. 遅延時間が十分か確認（http-serverより後に起動する必要がある）
3. `--user-data-dir` で指定したフォルダが存在し、書き込み可能か確認

### キャスト終了後にポータルに戻らない
1. ウィンドウ監視スクリプト（AHK / PS1）が動作しているか確認
2. AirServerのプロセス名を確認（`Get-Process | Where-Object { $_.Name -like "*Air*" }`）
3. Edgeのウィンドウタイトルに「Screencast Hub」が含まれるか確認

### 自動シャットダウンが実行されない
1. タスクスケジューラの「ScreencastHub-AutoShutdown」の次回実行時刻を確認
2. タスクの「履歴」タブでエラーがないか確認
3. shutdown.exeのパスが正しいか確認

---

## 完成後の運用ガイド

### 日常操作
1. **起動:** スマホのWoLアプリ or ProxmoxからVM起動 → 自動でポータル表示
2. **視聴:** Unified Remoteでサービス選択 → 視聴
3. **キャスト:** MacBook/AndroidからAirPlay/Castで画面投影
4. **終了:** 深夜0時に自動シャットダウン、または手動でPowerリモートからシャットダウン

### メンテナンス
- **サービス追加:** config.jsonを編集 → F5リロード
- **Windows Update:** 週末にRDPで接続して手動更新推奨
- **ログ確認:** タスクスケジューラの履歴タブ

### 緊急時
- **画面が固まった:** Unified Remote → Power → 再起動
- **VMが応答しない:** Proxmox WebUI → VM <VMID> → Stop → Start
- **ネットワーク障害:** サーバー側を確認（Proxmoxホストのネットワーク）
