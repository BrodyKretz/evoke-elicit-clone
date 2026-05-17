#!/bin/bash
# Live check: /api/lab/review and /api/lab/extract return well-formed output.
set -e
BASE="http://localhost:3000"

echo "== /api/lab/review =="
curl -s -X POST "$BASE/api/lab/review" -H 'content-type: application/json' \
  -d '{"query":"cognitive behavioral therapy for adult depression","corpus":"core","limit":6}' \
  | python3 -c "
import json,sys
r=json.load(sys.stdin)
assert 'error' not in r, r
papers=r.get('papers') or []
scr=r.get('screening') or []
assert len(papers)>0, 'no papers'
assert len(scr)>0, 'no screening results'
valid={'include','maybe','exclude'}
for s in scr:
    d=s.get('decision'); assert d in valid, f'bad decision {d}'
    assert (s.get('rationale') or '').strip(), 'empty rationale'
print(f'OK: {len(papers)} papers, {len(scr)} screened, criterion={bool(r.get(\"criterion\"))}')
"

echo '== /api/lab/extract =='
PAPERS=$(curl -s -X POST "$BASE/api/lab/review" -H 'content-type: application/json' \
  -d '{"query":"cognitive behavioral therapy for adult depression","corpus":"core","limit":3}' \
  | python3 -c "import json,sys;print(json.dumps(json.load(sys.stdin).get('papers',[])[:3]))")
curl -s -X POST "$BASE/api/lab/extract" -H 'content-type: application/json' \
  --data-binary "{\"question\":\"Does CBT reduce depression in adults?\",\"papers\":$PAPERS}" \
  | python3 -c "
import json,sys
r=json.load(sys.stdin)
assert 'error' not in r, r
cols=r.get('columns') or []
rows=r.get('rows') or []
assert len(cols)>0, 'no columns'
assert len(rows)>0, 'no rows'
for row in rows:
    assert len(row.get('cells') or [])==len(cols), f'cell/col mismatch'
print(f'OK: {len(cols)} columns, {len(rows)} rows, cells aligned')
"
echo 'ALL LAB ENDPOINT CHECKS PASSED'
