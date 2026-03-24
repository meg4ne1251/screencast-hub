#Persistent
#SingleInstance Force
SetTitleMatchMode, 2

; === 設定 ===
KioskTitle := "Screencast Hub"            ; Edgeウィンドウのタイトルに含まれる文字列
AirServerExe := "AirServer.exe"
CheckInterval := 1000                     ; 監視間隔（ミリ秒）
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
