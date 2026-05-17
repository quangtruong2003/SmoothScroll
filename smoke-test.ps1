# SmoothScroll v0.3.0 Smoke Test - Automated UI Verification
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Linq;

public class Win32 {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPhysicalPoint(POINT pt);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }

    public static List<WinInfo> GetAllProcessWindows(uint pid) {
        var results = new List<WinInfo>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            uint wpid;
            GetWindowThreadProcessId(hWnd, out wpid);
            if (wpid != pid) return true;
            if (!IsWindowVisible(hWnd)) return true;
            RECT r;
            GetWindowRect(hWnd, out r);
            int w = Math.Abs(r.Right - r.Left);
            int h = Math.Abs(r.Bottom - r.Top);
            var sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            var sbTitle = new StringBuilder(512);
            GetWindowText(hWnd, sbTitle, 512);
            results.Add(new WinInfo { Hwnd = hWnd, ClassName = sbClass.ToString(), Title = sbTitle.ToString(), Width = w, Height = h, Area = w * h });
            return true;
        }, IntPtr.Zero);
        return results;
    }

    public static IntPtr GetMainWindow(uint pid) {
        var wins = GetAllProcessWindows(pid);
        var large = wins.Where(w => w.Width > 200 && w.Height > 200).OrderByDescending(w => w.Area).ToList();
        if (large.Count > 0) return large[0].Hwnd;
        return IntPtr.Zero;
    }

    public static WinInfo GetMainWindowInfo(uint pid) {
        var wins = GetAllProcessWindows(pid);
        var large = wins.Where(w => w.Width > 200 && w.Height > 200).OrderByDescending(w => w.Area).ToList();
        if (large.Count > 0) return large[0];
        return new WinInfo { Hwnd = IntPtr.Zero };
    }

    public class WinInfo {
        public IntPtr Hwnd;
        public string ClassName;
        public string Title;
        public int Width;
        public int Height;
        public int Area;
    }

    // Find window by title across all processes
    public static IntPtr FindWindowByTitle(string titlePart) {
        IntPtr best = IntPtr.Zero;
        int bestArea = 0;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            if (!IsWindowVisible(hWnd)) return true;
            var sbTitle = new StringBuilder(512);
            GetWindowText(hWnd, sbTitle, 512);
            string t = sbTitle.ToString();
            if (!string.IsNullOrEmpty(t) && t.Contains(titlePart)) {
                RECT r;
                GetWindowRect(hWnd, out r);
                int w = Math.Abs(r.Right - r.Left);
                int h = Math.Abs(r.Bottom - r.Top);
                if (w * h > bestArea && w > 200 && h > 200) { bestArea = w * h; best = hWnd; }
            }
            return true;
        }, IntPtr.Zero);
        return best;
    }
    public static string GetWindowClass(IntPtr hWnd) {
        var sb = new StringBuilder(256);
        GetClassName(hWnd, sb, 256);
        return sb.ToString();
    }
}
"@

$artifacts = "d:\SmoothScroll\smoke-test-artifacts"
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null

$results = @()
$mainHwnd = [IntPtr]::Zero
$mainPid = 0

function Add-Result {
    param([string]$Name, [string]$Status, [string]$Detail = "")
    $script:results += [PSCustomObject]@{ Name = $Name; Status = $Status; Detail = $Detail }
    $color = if ($Status -eq "PASS") { "Green" } elseif ($Status -eq "WARN") { "Yellow" } else { "Red" }
    Write-Host "[$Status] $Name" -ForegroundColor $color
    if ($Detail) { Write-Host "       $Detail" }
}

function Screenshot-Hwnd {
    param([IntPtr]$Hwnd, [string]$Name)
    if ($Hwnd -eq [IntPtr]::Zero) { Write-Host "  [WARN] No hwnd for $Name"; return }
    $rect = New-Object Win32+RECT
    [Win32]::GetWindowRect($Hwnd, [ref]$rect) | Out-Null
    $w = [Math]::Abs($rect.Right - $rect.Left)
    $h = [Math]::Abs($rect.Bottom - $rect.Top)
    if ($w -le 0 -or $h -le 0) { Write-Host "  [WARN] Invalid size ${w}x${h}"; return }
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
    $g.Dispose()
    $bmp.Save("$artifacts\$Name.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  [SCREENSHOT] $Name.png (${w}x${h})"
}

# Kill existing
Get-Process -Name "smoothscroll-app" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Launch app
$exePath = $null
if (Test-Path "C:\Users\nguye\AppData\Local\SmoothScroll\smoothscroll-app.exe") { $exePath = "C:\Users\nguye\AppData\Local\SmoothScroll\smoothscroll-app.exe" }
elseif (Test-Path "D:\SmoothScroll\target\release\smoothscroll-app.exe") { $exePath = "D:\SmoothScroll\target\release\smoothscroll-app.exe" }

Write-Host "=== Launching SmoothScroll ===" -ForegroundColor Cyan
Write-Host "  Exe: $exePath"
$proc = Start-Process $exePath -PassThru
Start-Sleep -Seconds 7

if ($proc -and -not $proc.HasExited) {
    $script:mainPid = $proc.Id
    Write-Host "  PID: $($proc.Id)"

    # Strategy 1: Find by title (works for WebView2 windows on separate threads)
    $script:mainHwnd = [Win32]::FindWindowByTitle("SmoothScroll")

    # Strategy 2: Find by process (largest visible window)
    if ($script:mainHwnd -eq [IntPtr]::Zero) {
        $winInfo = [Win32]::GetMainWindowInfo([uint32]$proc.Id)
        $script:mainHwnd = $winInfo.Hwnd
    }

    # Log all windows found for this process (debug)
    $allWins = [Win32]::GetAllProcessWindows([uint32]$proc.Id)
    foreach ($w in $allWins) {
        Write-Host "    HWND=$($w.Hwnd) Class='$($w.ClassName)' Title='$($w.Title)' Size=$($w.Width)x$($w.Height)"
    }

    if ($script:mainHwnd -ne [IntPtr]::Zero) {
        $w, $h = 0, 0
        $rect = New-Object Win32+RECT
        [Win32]::GetWindowRect($script:mainHwnd, [ref]$rect) | Out-Null
        $w = [Math]::Abs($rect.Right - $rect.Left)
        $h = [Math]::Abs($rect.Bottom - $rect.Top)
        $class = [Win32]::GetWindowClass($script:mainHwnd)
        Write-Host "  Main window: HWND=$($script:mainHwnd) Class='$class' Size=${w}x${h}"
        Add-Result "App launches" "PASS" "Process running, window found (${w}x${h})"
        Screenshot-Hwnd $script:mainHwnd "00_initial"
    } else {
        Add-Result "App launches" "FAIL" "Process running but no visible window found"
    }
} else {
    Add-Result "App launches" "FAIL" "Process not running or crashed"
}

# ================================================================
# TEST 1: Window minimum size 480x400
# ================================================================
Write-Host "`n--- Test 1: Window minimum size ---" -ForegroundColor Yellow
try {
    if ($script:mainHwnd -ne [IntPtr]::Zero) {
        # Initial size
        $w0, $h0 = 0, 0
        $rect0 = New-Object Win32+RECT
        [Win32]::GetWindowRect($script:mainHwnd, [ref]$rect0) | Out-Null
        $w0 = [Math]::Abs($rect0.Right - $rect0.Left)
        $h0 = [Math]::Abs($rect0.Bottom - $rect0.Top)
        Write-Host "  Initial: ${w0}x${h0}"

        # Try to resize below minimum
        [Win32]::MoveWindow($script:mainHwnd, 100, 100, 400, 300, $true) | Out-Null
        Start-Sleep -Milliseconds 1000

        $w1, $h1 = 0, 0
        $rect1 = New-Object Win32+RECT
        [Win32]::GetWindowRect($script:mainHwnd, [ref]$rect1) | Out-Null
        $w1 = [Math]::Abs($rect1.Right - $rect1.Left)
        $h1 = [Math]::Abs($rect1.Bottom - $rect1.Top)
        Write-Host "  After MoveWindow(400x300): ${w1}x${h1}"

        Screenshot-Hwnd $script:mainHwnd "01_min_size_test"

        if ($w1 -ge 480 -and $h1 -ge 400) {
            Add-Result "Window min size 480x400" "PASS" "Enforced: ${w1}x${h1}"
        } else {
            Add-Result "Window min size 480x400" "FAIL" "Shrank to ${w1}x${h1} (expected >= 480x400)"
        }

        # Restore normal size
        [Win32]::MoveWindow($script:mainHwnd, 100, 100, 900, 640, $true) | Out-Null
        Start-Sleep -Milliseconds 500
    } else {
        Add-Result "Window min size 480x400" "FAIL" "No window handle"
    }
} catch {
    Add-Result "Window min size 480x400" "FAIL" "$_"
}

# ================================================================
# TEST 2: Scroll tab presets
# ================================================================
Write-Host "`n--- Test 2: Scroll tab presets ---" -ForegroundColor Yellow
try {
    [System.Windows.Forms.SendKeys]::SendWait("^2")
    Start-Sleep -Seconds 2
    Screenshot-Hwnd $script:mainHwnd "02_scroll_tab"
    Add-Result "6 Scroll presets visible" "WARN" "Screenshot saved for manual verification"
    Write-Host "  Verify: 6 preset chips (Slow, Default, Fast, Snappy, Mac-like, Linear) in Scroll section"
} catch {
    Add-Result "6 Scroll presets visible" "FAIL" "$_"
}

# ================================================================
# TEST 3: Test sandbox flex-fill
# ================================================================
Write-Host "`n--- Test 3: Test sandbox flex-fill ---" -ForegroundColor Yellow
try {
    [System.Windows.Forms.SendKeys]::SendWait("^1")
    Start-Sleep -Seconds 2
    if ($script:mainHwnd -ne [IntPtr]::Zero) {
        [Win32]::MoveWindow($script:mainHwnd, 100, 100, 900, 800, $true) | Out-Null
        Start-Sleep -Milliseconds 800
    }
    Screenshot-Hwnd $script:mainHwnd "03_sandbox_flexfill"
    Add-Result "Test sandbox flex-fill" "WARN" "Screenshot saved for manual verification"
    Write-Host "  Verify: Test sandbox box grows taller when window is expanded"
} catch {
    Add-Result "Test sandbox flex-fill" "FAIL" "$_"
}

# ================================================================
# TEST 4: About check for updates
# ================================================================
Write-Host "`n--- Test 4: About check for updates ---" -ForegroundColor Yellow
try {
    [System.Windows.Forms.SendKeys]::SendWait("^5")
    Start-Sleep -Seconds 2
    Screenshot-Hwnd $script:mainHwnd "04_about_tab"

    if ($script:mainHwnd -ne [IntPtr]::Zero) {
        [Win32]::SetForegroundWindow($script:mainHwnd) | Out-Null
        Start-Sleep -Milliseconds 300
    }

    # Press Tab repeatedly to reach Check button, then Enter
    for ($i = 0; $i -lt 15; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
        Start-Sleep -Milliseconds 50
    }
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 2
    Screenshot-Hwnd $script:mainHwnd "05_about_checking"
    Start-Sleep -Seconds 6
    Screenshot-Hwnd $script:mainHwnd "06_about_result"

    Add-Result "About check for updates" "WARN" "Screenshots saved for manual verification"
    Write-Host "  Verify: 'You are running the latest version' or 'Update available' message"
} catch {
    Add-Result "About check for updates" "FAIL" "$_"
}

# ================================================================
# Cleanup
# ================================================================
Write-Host "`n=== Cleanup ===" -ForegroundColor Cyan
Get-Process -Name "smoothscroll-app" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "App closed."

# ================================================================
# Summary
# ================================================================
Write-Host "`n=== RESULTS SUMMARY ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$warn = ($results | Where-Object { $_.Status -eq "WARN" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $results.Count

Write-Host "Passed: $passed | Warnings: $warn | Failed: $failed | Total: $total"
$results | Format-Table -AutoSize

Write-Host "`nScreenshots:" -ForegroundColor Cyan
Get-ChildItem $artifacts -Filter "*.png" | Where-Object { $_.Name -match "^0[0-9]_" } | ForEach-Object { Write-Host "  $($_.FullName)" }

$results | ConvertTo-Json -Depth 5 | Set-Content "$artifacts\smoke-test-results.json"

# Core verification: App launches + min size pass
$corePass = ($results | Where-Object { $_.Name -eq "App launches" -and $_.Status -eq "PASS" }).Count -eq 1 -and
              ($results | Where-Object { $_.Name -eq "Window min size 480x400" -and $_.Status -eq "PASS" }).Count -eq 1

if ($corePass) {
    Write-Host "`n=== CORE VERIFICATION PASSED ===" -ForegroundColor Green
} else {
    Write-Host "`n=== SOME CORE TESTS FAILED ===" -ForegroundColor Red
}
