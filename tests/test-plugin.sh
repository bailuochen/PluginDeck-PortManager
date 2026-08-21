#!/bin/zsh

set -eu

plugin_root="${0:A:h:h}"
plugin="$plugin_root/bin/port-manager"
request_id="00000000-0000-0000-0000-000000000001"

list_response=$(print -r -- "{\"jsonrpc\":\"2.0\",\"id\":\"$request_id\",\"method\":\"ports.list\",\"params\":{\"pluginID\":\"dev.plugindeck.port-manager\",\"actionID\":\"list\",\"dataDirectory\":\"/tmp\",\"payload\":{}}}" | "$plugin")
print -r -- "$list_response" | /usr/bin/plutil -extract result.detail raw -o - - >/dev/null

test_port=""
for candidate in {43100..43120}; do
    if ! /usr/sbin/lsof -nP -a -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
        test_port="$candidate"
        break
    fi
done
[[ -n "$test_port" ]] || { print -u2 "No test port available"; exit 1; }

/usr/bin/nc -l 127.0.0.1 "$test_port" >/dev/null 2>&1 &
listener_pid=$!
cleanup() {
    /bin/kill -TERM "$listener_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in {1..20}; do
    /usr/sbin/lsof -nP -a -iTCP:"$test_port" -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.1
done

terminate_response=$(print -r -- "{\"jsonrpc\":\"2.0\",\"id\":\"$request_id\",\"method\":\"ports.terminate\",\"params\":{\"pluginID\":\"dev.plugindeck.port-manager\",\"actionID\":\"terminate\",\"dataDirectory\":\"/tmp\",\"payload\":{\"port\":\"$test_port\"}}}" | "$plugin")
message=$(print -r -- "$terminate_response" | /usr/bin/plutil -extract result.message raw -o - -)
[[ "$message" == *"$test_port"* ]]

sleep 0.2
if /bin/kill -0 "$listener_pid" >/dev/null 2>&1; then
    print -u2 "Listener process was not terminated"
    exit 1
fi

print "Port Manager tests passed"
