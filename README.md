# Lumen

A tvOS-style home screen for rooted LG webOS TVs, tuned for a weak TV graphics chip. Lumen is a set of patches on top of
[partridgeworks/webos-launcher](https://github.com/partridgeworks/webos-launcher) (MIT), plus a few small scripts that run on the TV.
Its companion is [Lumen Gallery](https://github.com/ammar027/lumen-gallery-webos), an art-mode screensaver.

Tested on an LG 65UQ8040PSB (webOS 22, Chromium 87, 1.5 GB RAM). It needs a rooted TV with the
[Homebrew Channel](https://www.webosbrew.org/); a few features (screen off, restart, picture mode, the Home-button takeover) use its root service.

## What it adds

- **tvOS navigation and look:** a glass dock row of apps, a second row of more apps and a Recent row that appear as you move down, focus lift with a name
  under the tile, a wallpaper library (cloud and bundled, shuffle per category, favourites, auto-change, night dimming), folders, hold-OK menu
  (move, remove, add to folder), and a Settings app in the same style.
- **Control Center:** sound, picture mode, sleep timer, screensaver start time, LG Home, Settings, Art mode, start screensaver, screen off, restart and volume.
- **Top left:** date, time and weather (Open-Meteo, optional city); top right: Inputs and Control Center.
- **Cheap on purpose:** no live blur or SVG filters. The "glass" is a pre-blurred copy of the wallpaper seen through the glass shapes, with static rim lights;
  only `transform` and `opacity` animate. See [RESEARCH.md](RESEARCH.md).
- **TV side** ([tools/tv/](tools/tv/)): a small watcher that turns the remote's Home button into "open Lumen" and starts Lumen Gallery when the TV's screensaver
  starts, plus an update-notification blocker.

## How to build it

`app/` is a clone of the upstream launcher and is not part of this repository. Everything changed is re-applied by the scripts in `tools/`.
See [REBUILD.md](REBUILD.md) for the exact order.

```sh
git clone https://github.com/partridgeworks/webos-launcher app
cd app && npm install
# then the steps in REBUILD.md
```

Brand icons and logos of third-party apps, and the bundled default wallpapers, are **not** included here (trademarks and other people's photographs).
`tools/gen_iconpack.py` and `tools/build_iconpack.py` build the icon tiles from logos you put in `tools/logos/` and from your own TV's app icons.

## Install on the TV

```sh
ares-setup-device           # add your TV as "lgtv" (developer mode on, or rooted)
npx -p @webos-tools/cli ares-install --device lgtv build/*.ipk
```

To make Home open Lumen, copy `tools/tv/watch.sh` to `/var/lib/homehook/` and `tools/tv/60-homehook` to `/var/lib/webosbrew/init.d/` on the TV.
To undo it, delete the hook file and stop `watch.sh`.

## Credits

Built on partridgeworks/webos-launcher (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Not affiliated with LG, Apple or any app vendor.
Licence: [MIT](LICENSE).
