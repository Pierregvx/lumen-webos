#!/bin/sh
# Keeps the TV's clock right. On the previous TV a cold boot left a factory time zone and a clock hours out, with network time refused; whether
# this TV does the same is an open question (PLAN Phase 2). If it does not, delete this script and its line in watch.sh.
# If the clock is more than a minute off, sets it from the Date header of an HTTPS request (certificate checked). Run by watch.sh.
# TZ_NAME: leave empty to keep the TV's own time zone, or set a zone (for example Europe/London) to force it after each boot.
TZ_NAME=""
if [ -n "$TZ_NAME" ] && [ -f "/usr/share/zoneinfo/$TZ_NAME" ]; then
  [ "$(readlink /var/luna/preferences/localtime)" = "/usr/share/zoneinfo/$TZ_NAME" ] || ln -sf "/usr/share/zoneinfo/$TZ_NAME" /var/luna/preferences/localtime
fi
epoch=$(python3 - <<'PY' 2>/dev/null
import urllib.request, email.utils, calendar
for u in ('https://www.google.com', 'https://www.cloudflare.com', 'https://example.com'):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, method='HEAD'), timeout=8)
        print(calendar.timegm(email.utils.parsedate(r.headers['Date']))); break
    except Exception:
        pass
PY
)
[ -n "$epoch" ] || exit 0
now=$(date -u +%s)
diff=$((epoch - now)); [ "$diff" -lt 0 ] && diff=$((0 - diff))
[ "$diff" -gt 60 ] && luna-send -n 1 luna://com.webos.service.systemservice/time/setSystemTime "{\"utc\":$epoch}" </dev/null >/dev/null 2>&1
exit 0
