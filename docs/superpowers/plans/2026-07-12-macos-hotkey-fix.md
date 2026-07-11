# S1 macOS Hotkey Defects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the duplicate F12 keycode and correct the keycode field retrieval on macOS.

**Architecture:** macOS keycode map matches `"f12"` to the wrong keycode (F4=118). We correct it to 111. `read_keycode` uses a raw literal `7` instead of the system constant `kCGKeyboardEventKeycode` (9). We link the extern static key and use it.

**Tech Stack:** Rust (crates/platform target macOS).

## Global Constraints
- Target only macOS; do not touch Windows/Linux keycode maps.
- Tests mandatory.

---

### Task 1: Fix F12 keycode collision (A1)

**Files:**
- Modify: `crates/platform/src/macos/hotkey.rs:37`
- Test: `crates/platform/src/macos/hotkey.rs` (add unit test)

- [ ] **Step 1: Write unit test verifying F12 maps to 111**

Add a test block to `crates/platform/src/macos/hotkey.rs` (or extend existing):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_key_f12() {
        assert_eq!(parse_key("f12").unwrap(), 111);
        assert_eq!(parse_key("f4").unwrap(), 118);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --lib macos::hotkey` (gated macOS so only fails on macOS target, on Windows we verify compile).

- [ ] **Step 3: Sửa keycode F12**

Sửa dòng 37 thành: `"f12" => Ok(111),`

- [ ] **Step 4: Verify test passes**

Run compile check: `cargo check` (to verify syntax).

- [ ] **Step 5: Commit**

```bash
git add crates/platform/src/macos/hotkey.rs
git commit -m "fix(platform): correct macOS F12 virtual keycode"
```

---

### Task 2: Use `kCGKeyboardEventKeycode` for keycode retrieval (A2)

**Files:**
- Modify: `crates/platform/src/macos/event_tap.rs`

- [ ] **Step 1: Khai báo extern static**

Trong `event_tap.rs` block `extern "C"` (line 70), thêm:
```rust
    static kCGKeyboardEventKeycode: i64;
```

- [ ] **Step 2: Sử dụng hằng số trong read_keycode**

Sửa `read_keycode` (line 132) thành:
```rust
unsafe fn read_keycode(event: CGEventRef) -> u16 {
    CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) as u16
}
```

- [ ] **Step 3: Compile check**

Run: `cargo check`

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/macos/event_tap.rs
git commit -m "fix(platform): use kCGKeyboardEventKeycode constant on macOS"
```
