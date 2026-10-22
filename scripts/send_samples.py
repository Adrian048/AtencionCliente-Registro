"""Send the sample requests in samples/consultas.json to the n8n webhook.

Usage:
    python scripts/send_samples.py [--url http://127.0.0.1:9000/webhook/soporte]

The webhook key is read from secrets/webhook_api_key (or $WEBHOOK_API_KEY).

Only the standard library is used, so it runs without installing anything.
Requests are spaced out to stay under the nginx rate limit (5/min, burst 3).
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SAMPLES = Path(__file__).resolve().parent.parent / "samples" / "consultas.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:9000/webhook/soporte")
    parser.add_argument("--delay", type=float, default=12.0, help="seconds between requests")
    args = parser.parse_args()

    if not args.url.startswith(("http://localhost", "http://127.0.0.1", "https://")):
        sys.exit("Refusing to send over plain http to a non-local host.")

    key_file = SAMPLES.parent.parent / "secrets" / "webhook_api_key"
    api_key = os.environ.get("WEBHOOK_API_KEY") or (
        key_file.read_text(encoding="utf-8").strip() if key_file.exists() else ""
    )
    if not api_key:
        sys.exit("Missing webhook key: run scripts/generate_secrets.py first.")

    samples = json.loads(SAMPLES.read_text(encoding="utf-8"))
    for i, sample in enumerate(samples, start=1):
        request = urllib.request.Request(  # noqa: S310 - scheme checked above
            args.url,
            data=json.dumps(sample).encode(),
            headers={"Content-Type": "application/json", "X-Api-Key": api_key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
                print(f"[{i}/{len(samples)}] {response.status} {response.read().decode()}")
        except urllib.error.HTTPError as e:
            print(f"[{i}/{len(samples)}] {e.code} {e.read().decode()}")
            if e.code in (401, 403, 404):
                # Setup problem (workflow not active / wrong key): retrying won't help.
                hint = {
                    404: "Is the workflow published/active in n8n?",
                    401: "Check the webhook Header Auth credential (X-Api-Key) in n8n.",
                    403: "Check the webhook Header Auth credential (X-Api-Key) in n8n.",
                }[e.code]
                sys.exit(f"Stopping: {hint}")
        if i < len(samples):
            time.sleep(args.delay)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
