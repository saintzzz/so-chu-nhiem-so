"""Deploy project to Vercel via REST API file-upload flow (no CLI/git needed)."""
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.request

import certifi

TOKEN = os.environ["TOKEN"]
TEAM_ID = "team_Aa3XmBpCS6gqVNxTNLxwx43e"
PROJECT_ID = "prj_aU7hn4ih4LDA4ON8xcd1SAtFB0QC"
PROJECT_NAME = "so-chu-nhiem-so"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXCLUDE_DIRS = {
    "node_modules", ".next", ".git", ".vercel", ".playwright-mcp",
    ".idea", ".vscode", "out", "coverage",
}
EXCLUDE_FILES = {".env.local", ".env", "deploy-vercel.py", "set-env.py"}
CTX = ssl.create_default_context(cafile=certifi.where())


def api(method, path, body=None, headers=None, raw=False):
    h = {"Authorization": f"Bearer {TOKEN}"}
    if headers:
        h.update(headers)
    data = body
    if isinstance(body, (dict, list)):
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(
        f"https://api.vercel.com{path}", data=data, headers=h, method=method
    )
    try:
        r = urllib.request.urlopen(req, context=CTX)
        payload = r.read()
        return r.status, payload if raw else json.loads(payload or b"{}")
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload)
        except Exception:
            return e.code, payload


def collect_files():
    files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn in EXCLUDE_FILES or fn == ".DS_Store":
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            files.append((rel, full))
    return files


def main():
    files = collect_files()
    print(f"{len(files)} files to upload")
    entries = []
    failed = []
    for i, (rel, full) in enumerate(files):
        data = open(full, "rb").read()
        sha = hashlib.sha1(data).hexdigest()
        status, resp = api(
            "POST",
            "/v2/files",
            body=data,
            headers={
                "x-vercel-digest": sha,
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(data)),
            },
            raw=True,
        )
        if status not in (200, 201):
            failed.append((rel, status, resp[:200]))
        else:
            entries.append({"file": rel, "sha": sha, "size": len(data)})
        if (i + 1) % 25 == 0:
            print(f"  {i + 1}/{len(files)}")
    print(f"uploaded {len(entries)}, failed {len(failed)}")
    for f in failed[:10]:
        print("  FAIL", f)
    if failed:
        sys.exit(1)

    status, resp = api(
        "POST",
        "/v13/deployments?skipAutoDetectionConfirmation=1",
        body={
            "name": PROJECT_NAME,
            "project": PROJECT_ID,
            "files": entries,
            "projectSettings": {"framework": "nextjs"},
        },
    )
    print("deploy status:", status)
    if status >= 400:
        print(json.dumps(resp, indent=2)[:2000])
        sys.exit(1)
    dep_id = resp.get("id")
    url = resp.get("url")
    print("deployment id:", dep_id)
    print("url:", f"https://{url}")

    for _ in range(60):
        time.sleep(10)
        s, d = api("GET", f"/v13/deployments/{dep_id}")
        state = d.get("readyState") or d.get("status")
        print("state:", state)
        if state in ("READY", "ERROR", "CANCELED"):
            print("final:", state, "url:", f"https://{url}")
            if state != "READY":
                print(json.dumps(d, indent=2)[:1500])
            sys.exit(0 if state == "READY" else 2)
    print("timeout waiting; url:", f"https://{url}")


if __name__ == "__main__":
    main()
