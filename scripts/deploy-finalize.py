"""Create deployment from already-uploaded file SHAs and poll until ready."""
import json
import os
import ssl
import sys
import time
import urllib.request

import certifi

TOKEN = os.environ["TOKEN"]
PROJECT_ID = "prj_aU7hn4ih4LDA4ON8xcd1SAtFB0QC"
CTX = ssl.create_default_context(cafile=certifi.where())


def api(method, path, body=None):
    h = {"Authorization": f"Bearer {TOKEN}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(
        f"https://api.vercel.com{path}", data=data, headers=h, method=method
    )
    try:
        r = urllib.request.urlopen(req, context=CTX)
        return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


entries = json.load(open("/tmp/vercel-files.json"))
status, resp = api(
    "POST",
    "/v13/deployments?skipAutoDetectionConfirmation=1",
    {
        "name": "so-chu-nhiem-so",
        "project": PROJECT_ID,
        "files": entries,
        "projectSettings": {"framework": "nextjs"},
    },
)
print("deploy status:", status)
if status >= 400:
    print(json.dumps(resp, indent=2)[:2000])
    sys.exit(1)
dep_id = resp["id"]
url = resp["url"]
print("deployment:", dep_id)
print("url:", f"https://{url}")

for _ in range(90):
    time.sleep(10)
    s, d = api("GET", f"/v13/deployments/{dep_id}")
    state = d.get("readyState")
    print("state:", state, flush=True)
    if state in ("READY", "ERROR", "CANCELED"):
        print("final:", state, "|", f"https://{url}")
        print("err:", d.get("errorCode"), d.get("errorMessage"))
        sys.exit(0 if state == "READY" else 2)
print("timeout; url:", f"https://{url}")
