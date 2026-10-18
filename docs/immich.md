# Immich photos as the wallpaper

Settings > Wallpaper > Photos shows your own photos from an Immich server on the home network.

## Set up (once, over ssh to the TV)

1. In Immich: Account Settings > API Keys > New API Key. Give it only these permissions: `album.read`, `asset.read`, `asset.view`,
   `memory.read`. It can then read photos and nothing else.
2. On the TV:

   ```sh
   cat > /var/lib/homehook/immich.json <<'JSON'
   {"url": "http://192.168.1.10:2283", "key": "PASTE-THE-KEY-HERE"}
   JSON
   chmod 600 /var/lib/homehook/immich.json
   ```

   `url` is the server's address as you would open it in a browser on the home network: scheme, host and port, no path.
3. Open Settings > Wallpaper > Photos. If it still says "Set up Immich", the file could not be read or the address is not in that form.

## Sources

- **Recent**: random photos taken in the last 90 days.
- **On this day**: Immich's memories for today (photos from this date in past years); Recent when there are none.
- **Favourites**: random from the photos marked as favourites.
- **All my photos**: random from everything.
- **Your albums**: each album with photos in it is listed by name.

Landscape photos fill the screen. Portrait photos show in pairs, side by side, so they are not cropped to a strip. The two photos in a pair
come from different days, so a pair is not two shots of the same moment. A portrait with no partner from another day in the batch is
skipped. Square photos are skipped, since they lose too much in either layout. Recent and All also skip pictures with no camera make in
their EXIF, which drops screenshots and saved images. The next picture comes from other days than the one before it (both days,
for a pair), so two pictures in a row are not from the same day. Lumen searches again for one before it gives this up. Recently shown photos (the last 40) are not repeated, counted per photo, so a
portrait does not come back soon in a new pair.

## How it works

- Immich sends no CORS headers outside its dev mode, so a TV web app cannot call its API directly. Every API call goes through curl on the
  TV (`immichRequest` in `app/src/lib/root.ts`, which only accepts a plain address, a plain key and five fixed paths).
- The photo itself is loaded as an ordinary image from `/api/assets/<id>/thumbnail?size=preview&apiKey=...` (about 1440 px on the long
  side), which needs no CORS. It is never sent through images.weserv.nl or anywhere else off the home network.
- The blurred copies the glass and the lower rows show are made on the TV from Immich's small thumbnail, once per photo. For a pair, both
  thumbnails are blurred side by side, as the pair shows.
- The next photo is chosen 8 s after the current one is up and its blur goes into the boot record, so a cold start paints that blur at once
  and the photo fades in over it, as for the cloud wallpapers.
- The key is kept in the app's localStorage on the TV (to build the photo URL at start-up without a root call) and in
  `/var/lib/homehook/immich.json`. Use a read-only key.

## Screensaver

Settings > Options > Screensaver: pick a Photos source instead of "LG's own". When the TV's screensaver starts, `watch.sh` opens Lumen on
its ambient screen instead: your photos full-screen, a 1.6 s crossfade every 30 seconds (Settings > Options > Time on each photo: 10 s to 5 min), each photo zooming in very slowly, and the clock,
date and weather bottom left. Any key returns to the home screen.

- Settings > Screensaver > Start on the home screen after (30 seconds to 5 minutes): when the home screen is left alone that long, Lumen
  opens the photos itself, so LG's screensaver never shows first. Control Center > Art mode does the same at once. The TV's own
  screensaver timer still covers other apps.
- Needs the updated `tools/tv/watch.sh` on the TV (it looks for `/var/lib/homehook/ambient-screensaver`, which the setting creates).
- LG's screensaver keeps starting after its timer while the ambient screen is up (nothing is pressed); `watch.sh` sees
  `/tmp/lumen-ambient-on` and only ends it.
- With the video wallpaper on and Lumen in front, the video wallpaper wins, as before.
- Like Lumen Gallery's screensaver, it takes the screen from whatever app was in front (a paused Plex film, for example).
