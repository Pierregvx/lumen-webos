#!/bin/sh
# Stops every running copy of the Home-button watcher (matching the exact command line, so it never kills the shell that runs this).
for p in /proc/[0-9]*; do
  c=$(tr "\0" " " 2>/dev/null < $p/cmdline)
  case "$c" in "/bin/sh /var/lib/homehook/watch.sh"*|"sh /var/lib/homehook/watch.sh"*) kill ${p#/proc/} 2>/dev/null;; esac
done
