# Social-launch drafts

Each draft is ready to copy-paste. Posting requires the user's account on each platform.

---

## Hacker News — Show HN

**URL:** https://news.ycombinator.com/submit
**Title (max 80 chars):** `Show HN: SmoothScroll – Mac-style smooth scrolling for Windows, in Rust + Tauri`
**URL field:** `https://github.com/quangtruong2003/SmoothScroll`

**Comment to post immediately after submission:**

    Hi HN — I built SmoothScroll because mouse-wheel scrolling on Windows feels jagged compared to macOS trackpad inertia, and the closest existing tools (WizMouse, KatMouse) only redirect scroll without smoothing motion.

    It sits between the OS and your apps via the Windows low-level mouse hook (WH_MOUSE_LL) and macOS CGEventTap, swallows raw wheel ticks, and re-emits them as eased pulses at 120 Hz. Per-app exclusion lets you disable it for games or apps that prefer raw input.

    Stack: Rust (workspace with crates/core for the engine + crates/platform for OS-specific hooks), Tauri 2 host, React + TypeScript settings UI. Single binary, no Electron, no background services. MIT.

    Happy to answer questions about the input hook approach, the easing math, or the Tauri 2 migration.

**Best time to post:** Tuesday-Thursday, 8-10am Eastern. Avoid weekends and Mondays.

---

## Reddit — r/rust

**Title:** `Built a small Rust app to make Windows mouse-wheel scrolling feel like macOS`

**Body:**

    I bounce between a Mac and a Windows desktop for work, and the clicky feel of Windows wheel scrolling always bugged me after spending the day on a trackpad. Spent a few weekends writing a small thing in Rust to smooth it out, and figured this sub might find the approach interesting.

    It hooks the low-level wheel events (WH_MOUSE_LL on Windows, CGEventTap on macOS), eats the raw ticks, and re-emits them as eased pulses at 120 Hz. The easing math and settings sit in a pure-Rust core crate with no OS deps, and the platform side hides behind a trait so the core stays unit-testable. Tauri 2 hosts a tiny React settings UI.

    The trickiest bit honestly wasn't the hook, it was getting the easing curve to feel right without adding noticeable lag. Still tweaking it.

    Repo if you want to poke around: https://github.com/quangtruong2003/SmoothScroll

    Happy to hear thoughts on the trait split or the easing choices — currently defaulting to a quintic curve.

---

## Reddit — r/Windows11 (or r/Windows10)

**Title:** `Tried to fix the way mouse-wheel scrolling feels on Windows. Sharing the result.`

**Body:**

    I switch between a Macbook and a Windows desktop a lot, and going back to Windows always felt like the wheel was clicking through pages instead of gliding. Tried a bunch of existing tools, none of them felt quite right, so I ended up writing my own.

    It sits in the system tray, works in any app, and you can toggle it with Ctrl+Alt+S if you want to compare on/off. No drivers, no admin needed, no reboot. If a game wants raw input you can add it to an exclusion list.

    It's free and the source is on GitHub. Sharing it here in case anyone else has been bothered by the same thing:

    https://github.com/quangtruong2003/SmoothScroll

    Curious whether other folks notice the same difference, or if I'm just imagining things after too many years on a Mac.

---

## Reddit — r/sideproject

**Title:** `My side project for fixing rough mouse-wheel scrolling on Windows`

**Body:**

    Wanted to share a small thing I've been working on in my spare time. It's called SmoothScroll, and it adds Mac-style eased scrolling to any wheel mouse on Windows (and macOS too).

    The reason I started it: every time I came home from work on a Macbook and sat down at my Windows PC, scrolling felt jarring. The existing tools I tried either only redirected scroll without smoothing it, or were tied to one mouse brand. So I tried building my own.

    It runs from the system tray, has a hotkey to toggle, and you can exclude apps that prefer raw input (mostly games). Built in Rust with a Tauri shell, so it's a single small binary instead of an Electron app.

    Source and download here: https://github.com/quangtruong2003/SmoothScroll

    Would love to hear how it feels on other people's setups — especially anyone using a high-DPI mouse or a multi-monitor build.

---

## Facebook (English version)

**Post:**

    Mình hay đi qua đi lại giữa Macbook và máy bàn Windows, và mỗi lần ngồi vào Windows thì cảm giác lăn chuột nó cứ giật giật, không mượt như trên Mac. Tìm thử mấy app có sẵn nhưng không cái nào ưng nên rảnh rỗi tự viết một cái cho đỡ ngứa mắt.

    Nó là một app nhỏ chạy ở khay hệ thống, không cần driver, không cần quyền admin, không cần khởi động lại máy. Bật/tắt bằng Ctrl+Alt+S nếu muốn so sánh. App nào hay game nào cần input thô thì cho vào danh sách loại trừ.

    Free, mã nguồn mở. Ai dùng Windows mà cũng thấy lăn chuột hơi cứng thì thử xem sao:
    https://github.com/quangtruong2003/SmoothScroll

    Có gì góp ý mình với nhé, đang muốn tinh chỉnh thêm phần cảm giác lăn cho đỡ trễ.

**Tips để bài không bị Facebook giảm hiển thị:**

- Đăng từ tài khoản cá nhân, không spam vào nhiều group cùng lúc.
- Không kèm hashtag quảng cáo (#freeapp, #download...). Để bài nhìn tự nhiên.
- Không viết hoa toàn câu, không dùng "MIỄN PHÍ", "TẢI NGAY".
- Ảnh chụp app hoặc GIF demo dán trực tiếp vào bài, đừng để chỉ có link.
- Nếu post vào group, đọc rule group trước. Nhiều group cấm link GitHub trong bài; có thể bỏ link và để ở comment đầu tiên.

---

## Twitter / X

**Tweet 1 (announce):**

    Just shipped SmoothScroll v0.1.13 🪶

    Free, open-source, Mac-style smooth mouse-wheel scrolling for Windows and macOS.

    → Native input hook (no driver)
    → 120 Hz frame-perfect easing
    → Per-app exclusion
    → Single Rust binary, MIT

    https://quangtruong2003.github.io/SmoothScroll/
    #rustlang #tauri

**Tweet 2 (technical thread, optional):**

    Stack:
    - crates/core: pure Rust engine + easing math
    - crates/platform: WH_MOUSE_LL on Windows, CGEventTap on macOS
    - Tauri 2 host
    - React + TS settings UI

    Trait-bounded OS layer keeps core 100% unit-testable.

---

## LinkedIn

**Post:**

    Excited to share v0.1.13 of SmoothScroll — a small, free, open-source utility that brings Mac-style smooth mouse-wheel scrolling to Windows.

    Built with Rust and Tauri 2, it intercepts wheel input at the OS level and re-emits eased pulses at 120 Hz. The core engine is pure Rust with full unit-test coverage; OS-specific input lives behind trait abstractions.

    If you've ever felt that Windows scrolling was rougher than macOS — try it.

    GitHub: https://github.com/quangtruong2003/SmoothScroll
    Site: https://quangtruong2003.github.io/SmoothScroll/

    #opensource #rustlang #tauri #productivity

---

## Product Hunt launch

**URL:** https://www.producthunt.com/posts/new
**Tagline (60 chars):** `Smooth mouse-wheel scrolling for Windows and macOS`

**Description:**

    Free, open-source utility that adds Mac-style smooth scrolling to Windows and consistent mouse-wheel inertia on macOS. Native low-level input interception, frame-perfect easing at 120 Hz, per-app exclusion, system-tray UI. Built with Rust and Tauri 2. MIT licensed, no telemetry.

**Topics:** Productivity · Developer Tools · Open Source · Mac · Windows

**First comment (post immediately after launch goes live):**

    Hi Product Hunt! I built SmoothScroll because mouse-wheel scrolling on Windows feels jagged compared to macOS trackpad inertia, and the closest existing tools (WizMouse, KatMouse) only redirect scroll without smoothing motion.

    It sits between the OS and your apps via the Windows low-level mouse hook (WH_MOUSE_LL) and macOS CGEventTap, swallows raw wheel ticks, and re-emits them as eased pulses at 120 Hz. Per-app exclusion lets you disable it for games or apps that prefer raw input.

    Stack: Rust + Tauri 2 + React. Single binary, no Electron, no telemetry. MIT licensed.

    Happy to answer questions — and feedback on the easing curves or input-hook design is very welcome.

**Best launch day:** Tuesday or Wednesday at 12:01am Pacific.

---

## Posting checklist

- [ ] Take a 5-10s GIF of SmoothScroll smoothing a Notepad / browser scroll. Save as `docs/seo/demo.gif`.
- [ ] Post Show HN (Tue-Thu 8-10am ET).
- [ ] Post r/rust, r/Windows11, r/sideproject (stagger by 1 day each to avoid spam-flag).
- [ ] Post Twitter + LinkedIn the same day as HN.
- [ ] Schedule Product Hunt for the following Tuesday.
