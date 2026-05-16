#!/bin/bash
# End-to-end timing + quality probe for the screening + extraction pipeline.
# Submits a real research question, streams SSE with elapsed timestamps,
# then dumps the final report's screening decisions and extraction table.
set -e
BASE="http://localhost:3000"
Q="${1:-Does cognitive behavioral therapy reduce depression symptoms in adults?}"

echo "Q: $Q"
ID=$(curl -s -X POST "$BASE/api/reports" -H 'content-type: application/json' \
  -d "{\"question\":$(python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$Q"),\"corpus\":\"s2\"}" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
echo "run id: $ID"
echo "--- stream (elapsed s | event) ---"

START=$(date +%s)
curl -sN --max-time 240 "$BASE/api/reports/$ID/stream" | while IFS= read -r line; do
  case "$line" in
    data:*)
      EL=$(( $(date +%s) - START ))
      printf '%3ds | %s\n' "$EL" "$(echo "${line#data: }" | python3 -c "
import json,sys
try:
    e=json.load(sys.stdin)
    t=e.get('type','?')
    extra=''
    if t=='criterion': extra=' :: '+str(e.get('criterion',e.get('text','')))[:140]
    elif t=='columns': extra=' :: '+str(e.get('columns',''))
    elif t in ('stage.start','stage.done','stage.error'): extra=' :: '+str(e.get('stage',''))
    elif t=='progress': extra=' :: '+str(e.get('stage',''))+' '+str(e.get('done',''))+'/'+str(e.get('total',''))
    elif t=='complete': extra=' :: DONE'
    print(t+extra)
except Exception as ex:
    print('parse-err')
")"
      case "$line" in *'"type": "complete"'*|*'"type":"complete"'*) pkill -P $$ curl 2>/dev/null; break;; esac
      ;;
  esac
done

echo "--- final report: screening + extraction ---"
curl -s "$BASE/api/reports/$ID" | python3 -c "
import json,sys
r=json.load(sys.stdin)
print('status:', r.get('status'))
papers=r.get('papers') or []
dec={}
for p in papers:
    d=(p.get('screening') or {}).get('decision','?')
    dec[d]=dec.get(d,0)+1
print('papers:', len(papers), 'decisions:', dec)
ex=r.get('extraction') or {}
print('columns:', ex.get('columns'))
rows=ex.get('rows') or []
print('extracted rows:', len(rows))
if rows:
    r0=rows[0]
    print('sample paper:', (r0.get('paper') or {}).get('title','')[:90])
    for c in (r0.get('cells') or [])[:4]:
        print('  cell:', str(c.get('value',c))[:160])
print('tldr:', (r.get('tldr') or '')[:300])
"
