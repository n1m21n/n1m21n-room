#!/bin/bash
# render one act on 3 workers (scenes dealt round-robin), then mux it with the song: tools/mv/render-act.sh I
set -e; A=$1; cd "$(dirname "$0")/../.."
IDS=$(python3 -c "import sys; sys.path.insert(0,'tools/mv'); from scenes import S; print(' '.join(s[0] for s in S if s[0].split('-')[0]=='$A'))")
W=(); i=0; for id in $IDS; do W[$((i%3))]+="${W[$((i%3))]:+,}$id"; i=$((i+1)); done
for w in "${W[@]}"; do node tools/mv/film.mjs "$w" --nomux --into act-$A & done; wait
node tools/mv/film.mjs $A --mux
