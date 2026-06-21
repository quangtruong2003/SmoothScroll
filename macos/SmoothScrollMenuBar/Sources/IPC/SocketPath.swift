import Foundation

/// Shared socket path for IPC communication.
/// MUST match Rust `ipc_socket_path()` which uses:
/// `ProjectDirs::from("com", "SmoothScroll", "SmoothScroll").data_dir().join("socket")`
///
/// On macOS, this produces:
/// `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket`
///
/// ⚠️ The directory name is `com.SmoothScroll.SmoothScroll` — NOT just `SmoothScroll`.
enum SocketPath {
    static let socket: String = {
        // Use guard-let instead of force unwrap for defensive coding
        guard let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            // Fallback: use temporary directory if Application Support unavailable
            let tempPath = NSTemporaryDirectory() + "com.SmoothScroll.SmoothScroll/socket"
            try? FileManager.default.createDirectory(
                atPath: tempPath,
                withIntermediateDirectories: true,
                attributes: nil
            )
            return tempPath
        }

        let socketDir = appSupport
            .appendingPathComponent("com.SmoothScroll.SmoothScroll")
            .appendingPathComponent("socket")

        // Ensure directory exists before returning
        try? FileManager.default.createDirectory(
            at: socketDir,
            withIntermediateDirectories: true,
            attributes: nil
        )

        return socketDir.path
    }()
}
