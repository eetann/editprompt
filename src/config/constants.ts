export const TEMP_FILE_PREFIX = ".editprompt-";
export const TEMP_FILE_EXTENSION = ".md";
export const DEFAULT_EDITOR = "vim";

// tmux sends each command to its server as a single imsg frame capped at
// 16KB (16384 bytes). Use half of that limit as the body chunk size to leave
// room for the `tmux send-keys -t '...' -- '...'` wrapper and the single-quote
// escaping expansion. Long content is split into chunks of this size and sent
// with successive send-keys calls to avoid the "command too long" error.
const TMUX_IMSG_LIMIT_BYTES = 16 * 1024;
export const TMUX_SEND_CHUNK_BYTES = TMUX_IMSG_LIMIT_BYTES / 2;

// wezterm's send-text passes content as a shell argument, which is bounded by
// ARG_MAX (typically 256KB+) rather than imsg, so it has more headroom. Reuse
// the same chunk size for simplicity and consistency.
export const WEZTERM_SEND_CHUNK_BYTES = TMUX_SEND_CHUNK_BYTES;

// Herdr v0.7.5's src/api/server.rs defines MAX_INITIAL_REQUEST_BYTES as 1MB
// for the initial newline-delimited JSON request.
// A control character can expand from one byte to six bytes when JSON-encoded,
// so use one eighth of that limit for text and leave room for the request
// envelope.
const HERDR_REQUEST_LIMIT_BYTES = 1024 * 1024;
export const HERDR_SEND_CHUNK_BYTES = HERDR_REQUEST_LIMIT_BYTES / 8;

// The niwaterm CLI's `tab send-keys` receives content as a shell argument
// (like wezterm's send-text), so it is bounded by ARG_MAX rather than a
// fixed-size socket frame. Reuse the wezterm chunk size for the same reason.
export const NIWATERM_SEND_CHUNK_BYTES = WEZTERM_SEND_CHUNK_BYTES;
