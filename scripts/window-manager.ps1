# window-manager.ps1
# AirServerのキャスト状態を監視し、Kioskブラウザとのウィンドウ前後を自動切り替えする
# AutoHotkeyを使わない場合の代替スクリプト
# タスクスケジューラからログオン時に起動すること

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
