// Bundled icons for the default known-games list
// (crates/core/src/settings.rs::default_games_list). Keys are canonical exe
// names: lowercase, ".exe" stripped. Adding a default game = drop a 48x48 PNG
// in src/assets/games/ + one entry here. Games absent from this map get their
// icon extracted on the backend when installed/running, or fall back to a
// generic gamepad icon.
import apexlegends from "@/assets/games/apexlegends.png";
import ats from "@/assets/games/ats.png";
import csgo from "@/assets/games/csgo.png";
import cs2 from "@/assets/games/cs2.png";
import cyberpunk2077 from "@/assets/games/cyberpunk2077.png";
import dishonored2 from "@/assets/games/dishonored2.png";
import eldenring from "@/assets/games/eldenring.png";
import ets2 from "@/assets/games/ets2.png";
import factorio from "@/assets/games/factorio.png";
import fortniteclientWin64Shipping from "@/assets/games/fortniteclient-win64-shipping.png";
import gta5 from "@/assets/games/gta5.png";
import javaw from "@/assets/games/javaw.png";
import leagueoflegends from "@/assets/games/leagueoflegends.png";
import minecraftlauncher from "@/assets/games/minecraftlauncher.png";
import overwatch from "@/assets/games/overwatch.png";
import overwatch2 from "@/assets/games/overwatch2.png";
import pubg from "@/assets/games/pubg.png";
import rdr2 from "@/assets/games/rdr2.png";
import rocketleague from "@/assets/games/rocketleague.png";
import stardewvalley from "@/assets/games/stardewvalley.png";
import terraria from "@/assets/games/terraria.png";
import valorant from "@/assets/games/valorant.png";
import warframe from "@/assets/games/warframe.png";
import witcher3 from "@/assets/games/witcher3.png";
import wow from "@/assets/games/wow.png";
import dota2 from "@/assets/games/dota2.png";
import ffxivDx11 from "@/assets/games/ffxiv_dx11.png";
import rainbowsix from "@/assets/games/rainbowsix.png";

const gameIcons: Record<string, string> = {
  apexlegends,
  ats,
  csgo,
  cs2,
  cyberpunk2077,
  dishonored2,
  eldenring,
  ets2,
  factorio,
  "fortniteclient-win64-shipping": fortniteclientWin64Shipping,
  gta5,
  javaw,
  leagueoflegends,
  minecraftlauncher,
  overwatch,
  overwatch2,
  pubg,
  rdr2,
  rocketleague,
  stardewvalley,
  terraria,
  valorant,
  warframe,
  witcher3,
  wow,
  dota2,
  ffxiv_dx11: ffxivDx11,
  rainbowsix,
};

export function gameIconFor(name: string): string | null {
  const key = name.trim().replace(/\.exe$/i, "").toLowerCase();
  return gameIcons[key] ?? null;
}
