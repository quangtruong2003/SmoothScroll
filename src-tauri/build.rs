fn main() {
    kill_running_instance();
    bake_trusted_host();
    tauri_build::build();
}

/// Bake the build machine's hostname into the binary as a trusted host so
/// `is_trusted_device()` returns true on the device that produced the build.
/// An explicit `SMOOTHSCROLL_TRUSTED_HOSTS` env var (comma-separated) still
/// wins when set. Re-run on every build because hostname is cheap to read.
fn bake_trusted_host() {
    println!("cargo:rerun-if-env-changed=SMOOTHSCROLL_TRUSTED_HOSTS");
    if std::env::var_os("SMOOTHSCROLL_TRUSTED_HOSTS").is_some() {
        return;
    }
    if let Ok(host) = hostname::get() {
        let host = host.to_string_lossy();
        println!("cargo:rustc-env=SMOOTHSCROLL_TRUSTED_HOSTS={host}");
    }
}

fn kill_running_instance() {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "smoothscroll-app.exe", "/T"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-x", "smoothscroll-app"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-x", "smoothscroll-app"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}
