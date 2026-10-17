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

Only landscape photos are used (a portrait phone photo would be cropped to a strip). Recent and All also skip pictures with no camera
make in their EXIF, which drops screenshots and saved images. Recently shown photos (the last 40) are not repeated.

## How it works

- Immich sends no CORS headers outside its dev mode, so a TV web app cannot call its API directly. Every API call goes through curl on the
  TV (`immichRequest` in `app/src/lib/root.ts`, which only accepts a plain address, a plain key and five fixed paths).
- The photo itself is loaded as an ordinary image from `/api/assets/<id>/thumbnail?size=preview&apiKey=...` (about 1440 px on the long
  side), which needs no CORS. It is never sent through images.weserv.nl or anywhere else off the home network.
- The blurred copies the glass and the lower rows show are made on the TV from Immich's small thumbnail, once per photo.
- The next photo is chosen 8 s after the current one is up and its blur goes into the boot record, so a cold start paints that blur at once
  and the photo fades in over it, as for the cloud wallpapers.
- The key is kept in the app's localStorage on the TV (to build the photo URL at start-up without a root call) and in
  `/var/lib/homehook/immich.json`. Use a read-only key.
