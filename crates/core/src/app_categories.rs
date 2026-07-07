//! Application categorization for profile auto-suggestion.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AppCategory {
    Browser,
    Ide,
    Office,
    Pdf,
    Terminal,
    Chat,
    Media,
    Game,
    Unknown,
}

impl AppCategory {
    pub fn label(self) -> &'static str {
        match self {
            Self::Browser => "Browser",
            Self::Ide => "IDE",
            Self::Office => "Office",
            Self::Pdf => "PDF Reader",
            Self::Terminal => "Terminal",
            Self::Chat => "Chat",
            Self::Media => "Media Player",
            Self::Game => "Game",
            Self::Unknown => "Unknown",
        }
    }
}

const BROWSERS: &[&str] = &[
    "chrome.exe",
    "firefox.exe",
    "msedge.exe",
    "brave.exe",
    "vivaldi.exe",
    "opera.exe",
    "arc.exe",
    "thorium.exe",
];
const IDES: &[&str] = &[
    "code.exe",
    "code - insiders.exe",
    "cursor.exe",
    "idea64.exe",
    "idea.exe",
    "pycharm64.exe",
    "pycharm.exe",
    "webstorm64.exe",
    "webstorm.exe",
    "rider64.exe",
    "rider.exe",
    "clion64.exe",
    "clion.exe",
    "goland64.exe",
    "goland.exe",
    "rubymine64.exe",
    "rubymine.exe",
    "phpstorm64.exe",
    "phpstorm.exe",
    "sublime_text.exe",
    "atom.exe",
    "devenv.exe",
];
const OFFICE: &[&str] = &[
    "winword.exe",
    "excel.exe",
    "powerpnt.exe",
    "onenote.exe",
    "outlook.exe",
    "msaccess.exe",
];
const PDF: &[&str] = &[
    "acrobat.exe",
    "acrord32.exe",
    "sumatrapdf.exe",
    "foxitreader.exe",
    "foxitpdfreader.exe",
];
const TERMINAL: &[&str] = &[
    "windowsterminal.exe",
    "wt.exe",
    "wezterm-gui.exe",
    "alacritty.exe",
    "conemu64.exe",
    "conemu.exe",
    "cmder.exe",
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
];
const CHAT: &[&str] = &[
    "slack.exe",
    "discord.exe",
    "teams.exe",
    "ms-teams.exe",
    "telegram.exe",
    "whatsapp.exe",
    "skype.exe",
    "signal.exe",
];
const MEDIA: &[&str] = &[
    "vlc.exe",
    "spotify.exe",
    "musicbee.exe",
    "foobar2000.exe",
    "potplayer.exe",
    "potplayermini64.exe",
];
const GAMES: &[&str] = &[
    "leagueoflegends.exe",
    "valorant.exe",
    "csgo.exe",
    "cs2.exe",
    "dota2.exe",
    "apexlegends.exe",
    "rainbowsix.exe",
    "fortniteclient-win64-shipping.exe",
    "pubg.exe",
    "gta5.exe",
    "rdr2.exe",
    "eldenring.exe",
    "cyberpunk2077.exe",
    "witcher3.exe",
    "minecraftlauncher.exe",
    "javaw.exe",
    "rocketleague.exe",
    "overwatch.exe",
    "overwatch2.exe",
    "wow.exe",
    "ffxiv_dx11.exe",
    "warframe.exe",
    "factorio.exe",
    "terraria.exe",
    "stardewvalley.exe",
];

pub fn classify_app(name: &str) -> AppCategory {
    if name.is_empty() {
        return AppCategory::Unknown;
    }
    let lower = name.to_ascii_lowercase();
    if BROWSERS.contains(&lower.as_str()) {
        return AppCategory::Browser;
    }
    if IDES.contains(&lower.as_str()) {
        return AppCategory::Ide;
    }
    if OFFICE.contains(&lower.as_str()) {
        return AppCategory::Office;
    }
    if PDF.contains(&lower.as_str()) {
        return AppCategory::Pdf;
    }
    if TERMINAL.contains(&lower.as_str()) {
        return AppCategory::Terminal;
    }
    if CHAT.contains(&lower.as_str()) {
        return AppCategory::Chat;
    }
    if MEDIA.contains(&lower.as_str()) {
        return AppCategory::Media;
    }
    if GAMES.contains(&lower.as_str()) {
        return AppCategory::Game;
    }
    AppCategory::Unknown
}

use crate::settings::ScrollProfile;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", content = "data")]
pub enum SuggestedPreset {
    Profile(ScrollProfile),
    Disabled,
}

pub fn preset_for_category(cat: AppCategory) -> SuggestedPreset {
    let mut p = ScrollProfile::new("", "");
    match cat {
        AppCategory::Browser => {
            p.step_size_px = 120;
            p.animation_time_ms = 360;

            p.acceleration_max = 7;
        }
        AppCategory::Ide => {
            p.step_size_px = 100;
            p.animation_time_ms = 250;

            p.acceleration_max = 10;
        }
        AppCategory::Office => {
            p.step_size_px = 100;
            p.animation_time_ms = 400;

            p.acceleration_max = 6;
        }
        AppCategory::Pdf => {
            p.step_size_px = 140;
            p.animation_time_ms = 500;

            p.acceleration_max = 6;
        }
        AppCategory::Terminal => {
            p.step_size_px = 80;
            p.animation_time_ms = 200;

            p.acceleration_max = 12;
        }
        AppCategory::Chat => {
            p.step_size_px = 120;
            p.animation_time_ms = 300;

            p.acceleration_max = 8;
        }
        AppCategory::Media => {
            p.step_size_px = 100;
            p.animation_time_ms = 350;

            p.acceleration_max = 7;
        }
        AppCategory::Game => return SuggestedPreset::Disabled,
        AppCategory::Unknown => {
            p.step_size_px = 120;
            p.animation_time_ms = 360;

            p.acceleration_max = 7;
        }
    }
    SuggestedPreset::Profile(p)
}
