#!/bin/zsh
# Rotate ANTHROPIC_API_KEY in .env.local, then immediately verify it
# authenticates. Prompts silently so the key never enters the terminal,
# shell history, or any transcript.

set -e
ENV_FILE="${0:A:h}/../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  print -u2 "✗ .env.local not found at $ENV_FILE"
  exit 1
fi

print -n "Paste the NEW ANTHROPIC_API_KEY, then press Enter: "
read -rs K
print ""

if [[ -z "$K" ]]; then
  print -u2 "✗ Nothing pasted — aborting, file unchanged."
  exit 1
fi

if [[ "$K" != sk-ant-* ]]; then
  print -u2 "✗ That doesn't look like an Anthropic key (expected to start with 'sk-ant-'). Aborting."
  exit 1
fi

OLD_TAIL=$(grep '^ANTHROPIC_API_KEY=' "$ENV_FILE" | tail -c 5)
NEW_TAIL=${K: -4}

# Rewrite the line without ever interpolating the key into a shell/sed
# expression (handles any special chars safely).
TMP=$(mktemp)
while IFS= read -r line; do
  if [[ "$line" == ANTHROPIC_API_KEY=* ]]; then
    print -r -- "ANTHROPIC_API_KEY=$K"
  else
    print -r -- "$line"
  fi
done < "$ENV_FILE" > "$TMP"
mv "$TMP" "$ENV_FILE"

if [[ "$OLD_TAIL" == "$NEW_TAIL" ]]; then
  print "⚠  New key ends the same as the old one ($NEW_TAIL) — did you actually create a new key?"
fi

print -n "Verifying against Anthropic API… "
CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages \
  -H "x-api-key: $K" -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}')
unset K

if [[ "$CODE" == "200" ]]; then
  print "HTTP 200 ✓  Key works and is saved to .env.local."
  exit 0
else
  print "HTTP $CODE ✗  Saved to .env.local, but it did NOT authenticate."
  print "   401 = wrong/revoked key. Create a fresh key at console.anthropic.com and run this again."
  exit 1
fi
