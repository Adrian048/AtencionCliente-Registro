"""CI guard for exported n8n workflows.

Fails if a workflow:
  - is not valid JSON or has connections pointing to missing nodes,
  - references stored credentials by id (instance-specific, must be re-linked on import),
  - contains anything that looks like an inline secret,
  - is saved as active (it must be activated deliberately after review).
"""

import json
import re
import sys
from pathlib import Path

SECRET_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9_-]{10,}"),  # Anthropic
    re.compile(r"sk-[A-Za-z0-9]{20,}"),  # OpenAI
    re.compile(r"postgres(?:ql)?://[^:\s]+:[^@\s]+@"),  # DSN with password
    re.compile(r"(?i)\"(?:password|api[_-]?key|token|secret)\"\s*:\s*\"[^\"]+\""),
]


def check(path: Path) -> list[str]:
    errors: list[str] = []
    raw = path.read_text(encoding="utf-8")
    try:
        workflow = json.loads(raw)
    except json.JSONDecodeError as e:
        return [f"invalid JSON: {e}"]

    names = {node["name"] for node in workflow.get("nodes", [])}
    for source, outputs in workflow.get("connections", {}).items():
        if source not in names:
            errors.append(f"connection from unknown node '{source}'")
        for branches in outputs.values():
            for branch in branches:
                for target in branch:
                    if target["node"] not in names:
                        errors.append(f"connection to unknown node '{target['node']}'")

    for node in workflow.get("nodes", []):
        for cred_type, cred in (node.get("credentials") or {}).items():
            if isinstance(cred, dict) and cred.get("id"):
                errors.append(f"node '{node['name']}' references credential id ({cred_type})")

    for pattern in SECRET_PATTERNS:
        if pattern.search(raw):
            errors.append(f"possible secret matching {pattern.pattern!r}")

    if workflow.get("active"):
        errors.append("workflow is exported as active")
    return errors


def main() -> int:
    paths = [Path(p) for p in sys.argv[1:]] or sorted(Path("n8n/workflows").glob("*.json"))
    failed = False
    for path in paths:
        errors = check(path)
        status = "OK" if not errors else "FAIL"
        print(f"{status} {path}")
        for error in errors:
            print(f"   - {error}")
        failed |= bool(errors)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
