import json, urllib.request, os

tok = os.environ['TOKEN']
pid = 'prj_aU7hn4ih4LDA4ON8xcd1SAtFB0QC'
env = {}
for line in open('.env.local'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"')
print('keys:', list(env.keys()))
for k, v in env.items():
    body = json.dumps({
        "key": k,
        "value": v,
        "type": "encrypted" if 'SERVICE' in k or 'SECRET' in k else "plain",
        "target": ["preview", "production", "development"],
    }).encode()
    req = urllib.request.Request(
        f"https://api.vercel.com/v10/projects/{pid}/env?upsert=true",
        data=body,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req)
        print(k, '->', r.status)
    except urllib.error.HTTPError as e:
        print(k, '->', e.code, e.read()[:200])
