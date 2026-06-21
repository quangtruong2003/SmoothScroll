import AppKit
import SwiftUI
import os

@MainActor
final class MenuBarController: NSObject {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var hostingController: NSHostingController<SmoothScrollPopover>!
    private var settingsObserver: NSObjectProtocol?
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "MenuBarController")

    func setup() {
        setupAppMenu()  // Must come first — enables ⌘Q
        setupStatusItem()
        setupPopover()
        setupObservers()
    }

    func teardown() {
        if let observer = settingsObserver {
            NotificationCenter.default.removeObserver(observer)
        }
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
            updateAccessibilityValue()
        }
    }

    private func updateAccessibilityValue() {
        let enabled = SettingsStore.shared.scrollEnabled
        statusItem.button?.setAccessibilityValue(
            enabled ? "Enabled" : "Disabled"
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

    // MARK: - Observers

    private func setupObservers() {
        // Notification fires on main queue (queue: .main).
        // Task { @MainActor in } ensures proper actor isolation for @MainActor methods.
        settingsObserver = NotificationCenter.default.addObserver(
            forName: .scrollStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.updateIcon()
                self?.updateAccessibilityValue()
            }
        }
    }

    private func updateIcon() {
        guard let button = statusItem.button else { return }
        let enabled = SettingsStore.shared.scrollEnabled

        if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
            image.isTemplate = true
            button.image = image
            button.alphaValue = enabled ? 1.0 : 0.4
        }
    }
}

extension Notification.Name {
    static let scrollStateDidChange = Notification.Name("scrollStateDidChange")
}
