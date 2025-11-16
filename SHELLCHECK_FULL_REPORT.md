# ShellCheck Report - cam1-v2 Scripts
Generated: Sat Nov 15 21:36:31 UTC 2025
ShellCheck Version: version: 0.9.0

---

## shboot_

**Issues Found:** 8

```

In script/shboot_ line 28:
        local out="$(ip link show wlan0 2>/dev/null)"
              ^-^ SC2155 (warning): Declare and assign separately to avoid masking return values.


In script/shboot_ line 37:
readonly MAC="$(get_mac)"
         ^-^ SC2155 (warning): Declare and assign separately to avoid masking return values.


In script/shboot_ line 90:
    local cam_info="$(vcgencmd get_camera 2>/dev/null)"
          ^------^ SC2155 (warning): Declare and assign separately to avoid masking return values.


In script/shboot_ line 112:
    jpegoptim --strip-all test.jpg 2>/dev/null && \
                                               ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.


In script/shboot_ line 259:
    command -v iwconfig &>/dev/null && iwconfig wlan0 txpower 26 2>/dev/null || :
                                    ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.


In script/shboot_ line 260:
    command -v iw &>/dev/null && iw wlan0 set power_save off 2>/dev/null || :
                              ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.


In script/shboot_ line 323:
                        ( cd /tmp && [[ -x ./plugin_${plugin_name}.sh ]] && ./plugin_${plugin_name}.sh >/dev/null 2>&1 & )
                                                                                     ^------------^ SC2086 (info): Double quote to prevent globbing and word splitting.

Did you mean: 
                        ( cd /tmp && [[ -x ./plugin_${plugin_name}.sh ]] && ./plugin_"${plugin_name}".sh >/dev/null 2>&1 & )


In script/shboot_ line 345:
    local cam="NOT_DETECTED" start="$(date +%s)"
                             ^---^ SC2155 (warning): Declare and assign separately to avoid masking return values.

For more information:
  https://www.shellcheck.net/wiki/SC2155 -- Declare and assign separately to ...
  https://www.shellcheck.net/wiki/SC2015 -- Note that A && B || C is not if-t...
  https://www.shellcheck.net/wiki/SC2086 -- Double quote to prevent globbing ...
```

---

## shcleanup_

**Issues Found:** 2

```

In script/shcleanup_ line 12:
readonly VERSION="2.0.0"
         ^-----^ SC2034 (warning): VERSION appears unused. Verify use (or export if used externally).


In script/shcleanup_ line 124:
    local fields=($usage_line)
                  ^---------^ SC2206 (warning): Quote to prevent word splitting/globbing, or split robustly with mapfile or read -a.

For more information:
  https://www.shellcheck.net/wiki/SC2034 -- VERSION appears unused. Verify us...
  https://www.shellcheck.net/wiki/SC2206 -- Quote to prevent word splitting/g...
```

---

## shlive_

**Issues Found:** 3

```

In script/shlive_ line 35:
  [[ -f "$IMAGE_FILE" ]] && rm -f "$IMAGE_FILE" 2>/dev/null || true
                         ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.


In script/shlive_ line 159:
    echo "$(date +%s)" > "$HEARTBEAT_FILE" 2>/dev/null || true
         ^-----------^ SC2005 (style): Useless echo? Instead of 'echo $(cmd)', just use 'cmd'.


In script/shlive_ line 198:
        (( failure_count > 5 )) && sleep "$FAILURE_DELAY" || sleep "$CAPTURE_DELAY"
                                ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.

For more information:
  https://www.shellcheck.net/wiki/SC2015 -- Note that A && B || C is not if-t...
  https://www.shellcheck.net/wiki/SC2005 -- Useless echo? Instead of 'echo $(...
```

---

## shmain_

**Issues Found:** 1

```

In script/shmain_ line 188:
                    command -v jpegoptim &>/dev/null && jpegoptim --strip-all -q pic.jpg 2>/dev/null || :
                                                     ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.

For more information:
  https://www.shellcheck.net/wiki/SC2015 -- Note that A && B || C is not if-t...
```

---

## shmonitor_

**Issues Found:** 1

```

In script/shmonitor_ line 216:
            [[ "$prev" == "on" ]] && curl -sf --data "file=tmp/web_live.tmp&data=on" "$BASE_URL/storage.php" -m 2 &>/dev/null || true
                                  ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.

For more information:
  https://www.shellcheck.net/wiki/SC2015 -- Note that A && B || C is not if-t...
```

---

## shsync_

**Issues Found:** 1

```

In script/shsync_ line 40:
    [[ $signal_line =~ Signal\ level=(-?[0-9]+) ]] && level="${BASH_REMATCH[1]#-}" || { echo "Unknown"; return; }
                                                   ^-- SC2015 (info): Note that A && B || C is not if-then-else. C may run when A is true.

For more information:
  https://www.shellcheck.net/wiki/SC2015 -- Note that A && B || C is not if-t...
```

---

## shtunel2_

**Issues Found:** 0

```
```

---

## shtunel3_

**Issues Found:** 0

```
```

---

## shtunel4_

**Issues Found:** 1

```

In script/shtunel4_ line 49:
    local words=($version_output)
                 ^-------------^ SC2206 (warning): Quote to prevent word splitting/globbing, or split robustly with mapfile or read -a.

For more information:
  https://www.shellcheck.net/wiki/SC2206 -- Quote to prevent word splitting/g...
```

---

## shtunel_

**Issues Found:** 0

```
```

---

## Summary

**Total Scripts:** 10
**Total Issues:** 17
