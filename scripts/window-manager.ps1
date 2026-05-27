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
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@

# SetWindowPos 用定数
$HWND_TOPMOST   = [IntPtr](-1)
$HWND_NOTOPMOST = [IntPtr](-2)
$SWP_NOMOVE     = 0x0002
$SWP_NOSIZE     = 0x0001
$SWP_SHOWWINDOW = 0x0040
$SWP_FLAGS      = $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_SHOWWINDOW
$SW_MINIMIZE    = 6

# ウィンドウを確実に最前面へ持ってくる（フォアグラウンドロック対策で TOPMOST を併用）
function Set-WindowForeground([IntPtr]$hWnd) {
    [WinAPI]::SetWindowPos($hWnd, $HWND_TOPMOST, 0, 0, 0, 0, $SWP_FLAGS) | Out-Null
    [WinAPI]::SetForegroundWindow($hWnd) | Out-Null
    [WinAPI]::SetWindowPos($hWnd, $HWND_NOTOPMOST, 0, 0, 0, 0, $SWP_FLAGS) | Out-Null
}

$wasAirServerActive = $false

while ($true) {
    $airserver = Get-Process -Name "AirServer" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
        Select-Object -First 1

    if ($airserver) {
        # AirServerのウィンドウが存在 → キャスト中
        if (-not $wasAirServerActive) {
            Set-WindowForeground $airserver.MainWindowHandle
            $wasAirServerActive = $true
        }
    } else {
        # AirServerのウィンドウなし → キャスト終了
        if ($wasAirServerActive) {
            $edge = Get-Process -Name "msedge" -ErrorAction SilentlyContinue |
                Where-Object { $_.MainWindowTitle -like "*Screencast Hub*" } |
                Select-Object -First 1
            if ($edge) {
                Set-WindowForeground $edge.MainWindowHandle
            }
            $wasAirServerActive = $false
        }
    }

    Start-Sleep -Seconds 1
}
