import AppKit
import SwiftUI
import os

final class MenuBarController: NSObject {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var hostingController: NSHostingController<SmoothScrollPopover>!
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "MenuBarController")

    func setup() {
        setupAppMenu()  // Must come first — enables ⌘Q
        setupStatusItem()
        setupPopover()
        // NOTE: Notification observer is in AppDelegate — avoids @MainActor/Sendable conflict.
    }

    func teardown() {
        // No observers to remove — notification observer lives in AppDelegate.
    }

    // MARK: - App Menu (enables ⌘Q for LSUIElement apps)

    private func setupAppMenu() {
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About SmoothScroll", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit SmoothScroll", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)
        NSApp.mainMenu = mainMenu
    }

    // MARK: - Status Item

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "SS"
            }
            button.target = self
            button.action = #selector(togglePopover)

            // Accessibility
            button.setAccessibilityLabel("SmoothScroll")
            button.setAccessibilityRole(.button)
            updateAccessibilityValue(scrollEnabled: false) // Initial state, will update via notification
        }
    }

    func updateAccessibilityValue(scrollEnabled: Bool) {
        statusItem.button?.setAccessibilityValue(
            scrollEnabled ? "Enabled" : "Disabled"
        )
    }

    // MARK: - Popover

    private func setupPopover() {
        hostingController = NSHostingController(rootView: SmoothScrollPopover())

        popover = NSPopover()
        popover.contentSize = NSSize(width: 280, height: 220)
        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = hostingController
    }

    @objc private func togglePopover(_ sender: NSStatusBarButton) {
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }

    func updateIcon(scrollEnabled: Bool) {
        guard let button = statusItem.button else { return }

        if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
            image.isTemplate = true
            button.image = image
            button.alphaValue = scrollEnabled ? 1.0 : 0.4
        }
    }
}

extension Notification.Name {
    static let scrollStateDidChange = Notification.Name("scrollStateDidChange")
}
