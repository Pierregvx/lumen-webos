---
name: tv
description: Sam's TV over SSH from this Mac. Use to install a build on the TV, read lumen.log, run JS or CSS in the live Lumen page, take a TV screenshot, or develop live while Sam watches the TV.
---

# The TV over SSH

The TV is `root@192.168.0.20` (also `LUMEN_TV_HOST` in the gitignored `.env`). Key auth works from this Mac, so every call uses `-o BatchMode=yes`. Add `-o LogLevel=ERROR` to hide the post-quantum warning the TV prints on each connection. If ssh fails inside the sandbox, rerun it with the sandbox off.

## Consent

Installing, launching, key presses and live CSS all change what is on Sam's screen, and he may be watching something. Ask before each install, the same way you ask before a commit: one yes or no line. When Sam asks for a push, read "push" as a GitHub push for a dev build unless he names the TV. Reading the log, `eval` of read-only expressions and screenshots need no ask.

## Install a build

1. Push to any branch other than `main`. The dev build is `1.0.9xxx`. Check it with `gh run list -R samrenfrew/lumen-webos --limit 1 --json headSha,status,conclusion`. Without `-R`, it returns nothing.
2. Download the build into its own scratchpad folder: `gh release download dev -R samrenfrew/lumen-webos -p 'com.samrenfrew.lumen_1.0.<n>_all.ipk' -D <dir>`.
3. Install it with the copy and `luna-send` lines from `tools/deploy.sh`, with `<dir>/<file>` for the `.ipk`. `luna-send` prints nothing without `ssh -tt`. A final `"install has been disconnected."` after `"installed"` is normal.
4. Check `grep version /media/developer/apps/usr/palm/applications/com.samrenfrew.lumen/appinfo.json`, then launch with `luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"com.samrenfrew.lumen"}'` (with `-tt`).
5. Done is Lumen in front: `luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}'` gives `com.samrenfrew.lumen`. It can take about 4 seconds. If ssh stops answering, the TV is in standby: say that Lumen starts on the new build at the next switch-on.

`npm run deploy` builds locally and installs that build instead. Use it only when the change is not pushed.

## The log

`/var/lib/homehook/lumen.log` is on the TV, and only ssh can read it. The app cannot read it. Use `grep ' boot ' … | tail -3`, `grep guide … | tail`, or `grep ' nav ' …`. `docs/startup-perf.md` explains the boot line.

## DevTools: eval, CSS, screenshots, keys

WebAppMgr serves Chrome DevTools on the TV's `127.0.0.1:9998`. Open the tunnel once a session:

```sh
curl -s -m 3 http://127.0.0.1:19998/json >/dev/null || ssh -o BatchMode=yes -o LogLevel=ERROR -o ExitOnForwardFailure=yes -f -N -L 19998:127.0.0.1:9998 root@192.168.0.20
```

If the tunnel goes stale, run `pkill -f 19998:127.0.0.1:9998` and open it again. Then use `node tools/tv/cdp.mjs`:

- `eval '<expr>'` runs in the live page. Wrap objects in `JSON.stringify(...)`. Use it to check a **(verify)** item from page state (classes, `getComputedStyle`, `getBoundingClientRect`) before you ask Sam to look.
- `css '<css>'` sets a `<style id="live">` block, and `css ''` clears it.
- `shot <file.png> [x,y,w,h]` saves a 1920x1080 PNG of about 2 MB. Save it in the scratchpad, and read it yourself before you send it.
- `key down down enter 500 back` presses remote keys, and a number waits that many ms.

Quirks:

- The video wallpaper plays on a hardware layer under the page, so a screenshot shows black where the video is. Reading the video's pixels returns black too. Still wallpapers and Immich photos capture normally.
- A key press wakes the screensaver. Some screens save state: for example, opening the Full guide makes the Guide open there next time. Put things back as they were (Back to home, the same guide mode) after a key-driven screenshot.
- The page id changes at every relaunch. `cdp.mjs` looks it up each time.
- Anything set over DevTools is gone after a relaunch or an install. Interacting with the page can also undo an injected effect.

## Live development with Sam

Use this for a look-and-feel change (spacing, size, position, colour), where one round trip through a dev build is slow.

1. Ask Sam if he can see the TV now. If he says no, make the change in source and push a dev build.
2. Inject the change with `css` (or `eval` for a DOM or state change). Say in one line what to look at, and wait for his reply. Make one change per round.
3. When Sam says it looks wrong ("things moved", "can you see?"), take a `shot` and measure with `eval`. Do not guess. For example, an absolute label once collapsed the tiles from 212px to 144px, and `getBoundingClientRect` showed it at once.
4. A heavy effect can look right and still drop the frame rate. Sam judges smoothness on the TV, and the TV's graphics chip is weak (`RESEARCH.md` section 4).
5. When Sam says it is right, write the final values into source (`app/src/theme/global.css` or the component), build, commit, and push for a dev build. Then clear the live block. The injected CSS is never the record.
