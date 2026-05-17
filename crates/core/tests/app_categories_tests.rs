use smoothscroll_core::app_categories::{classify_app, AppCategory};

#[test]
fn classifies_chrome_as_browser() {
    assert_eq!(classify_app("chrome.exe"), AppCategory::Browser);
}

#[test]
fn classification_is_case_insensitive() {
    assert_eq!(classify_app("ChRoMe.ExE"), AppCategory::Browser);
    assert_eq!(classify_app("CODE.EXE"), AppCategory::Ide);
}

#[test]
fn unknown_apps_return_unknown() {
    assert_eq!(classify_app("totally_random_app.exe"), AppCategory::Unknown);
}

#[test]
fn empty_input_returns_unknown() {
    assert_eq!(classify_app(""), AppCategory::Unknown);
}

#[test]
fn classifies_office_apps() {
    assert_eq!(classify_app("WINWORD.EXE"), AppCategory::Office);
    assert_eq!(classify_app("EXCEL.EXE"), AppCategory::Office);
}

#[test]
fn classifies_terminal_apps() {
    assert_eq!(classify_app("WindowsTerminal.exe"), AppCategory::Terminal);
    assert_eq!(classify_app("alacritty.exe"), AppCategory::Terminal);
}

#[test]
fn classifies_known_games() {
    assert_eq!(classify_app("LeagueOfLegends.exe"), AppCategory::Game);
    assert_eq!(classify_app("VALORANT.exe"), AppCategory::Game);
}
