#!/bin/sh
# Runs at container start (nginx image entrypoint hook).
# Turns the webhook key Docker secret into an nginx include, so the public contact
# form can reach n8n without the key ever being sent to the browser.
# The file lives in /tmp (tmpfs, in memory) and is readable only by the nginx user.
set -eu

secret=/run/secrets/webhook_api_key
target=/tmp/webhook-key.conf

if [ ! -s "$secret" ]; then
    echo "40-webhook-key.sh: missing $secret, refusing to start" >&2
    exit 1
fi

key=$(tr -d '\r\n' < "$secret")
case "$key" in
    *[!A-Za-z0-9_-]*)
        # token_urlsafe output only; anything else could break the nginx config
        echo "40-webhook-key.sh: unexpected characters in webhook key" >&2
        exit 1
        ;;
esac

umask 077
printf 'proxy_set_header X-Api-Key "%s";\n' "$key" > "$target"
