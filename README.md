# PluginDeck Port Manager

Port Manager is a community plugin for [PluginDeck](https://github.com/bailuochen/PluginDeck). It displays local TCP listening ports in a plugin-owned interface and can send `SIGTERM` to the processes listening on a selected port.

## Install from Git

PluginDeck 0.5.0 or newer is required.

1. Open Plugin Marketplace in PluginDeck.
2. Choose `Import Plugin > Git Repository`.
3. Enter `https://github.com/bailuochen/PluginDeck-PortManager.git`.
4. Review the `process.read` and `shell` permissions, then import the plugin.

## Development

The package root contains `plugin.json`. The plugin-owned workspace is in `ui/`, while `bin/port-manager` starts the JXA backend in `lib/port-manager.js`. The backend uses only tools included with macOS: `lsof`, `kill`, and `osascript`.

Run the end-to-end backend tests:

```bash
./tests/test-plugin.sh
```

The termination test starts a temporary local listener, invokes the plugin through JSON-RPC, and verifies that the listener exits.

## Security

The terminate action validates the port as an integer from 1 to 65535 and never interpolates it into a shell command. PluginDeck requires host-level confirmation before invoking the action. Processes owned by another user may be visible but cannot be terminated without the relevant macOS permission.

## License

MIT
