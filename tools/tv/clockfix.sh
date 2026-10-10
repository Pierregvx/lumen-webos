#!/bin/sh
# Keeps this TV's clock right. After a cold boot it falls back to a factory time zone (GMT-3:30) and a clock that is hours out, with network time refused.
# Sets the time zone to India and, if the clock is more than a minute off, sets it from the Date header of an ordinary web server. Run by watch.sh.
TZF=/usr/share/zoneinfo/Asia/Kolkata
[ "$(readlink /var/luna/preferences/localtime)" = "$TZF" ] || ln -sf "$TZF" /var/luna/preferences/localtime
epoch=$(python3 - <<'PY' 2>/dev/null
import urllib.request, email.utils, calendar
for u in ('http://www.google.com', 'http://www.cloudflare.com', 'http://example.com'):
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
