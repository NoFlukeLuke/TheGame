#!/bin/bash
cd "$(dirname "$0")"
HT=12
R=100

run() { node runner.js "$1" "$R" "$2" "$HT" >> "sweep_$1.jsonl" 2>>"sweep_$1.err"; }

case "$1" in
classic)
  run classic '{"base":1200,"roundTo":500,"segments":[[99,35]]}'
  run classic '{"base":1500,"roundTo":500,"segments":[[99,30]]}'
  run classic '{"base":1500,"roundTo":500,"segments":[[99,40]]}'
  run classic '{"base":2000,"roundTo":500,"segments":[[99,45]]}'
  run classic '{"base":1500,"roundTo":500,"segments":[[6,30],[12,40],[18,50],[99,60]]}'
  run classic '{"base":1500,"roundTo":500,"segments":[[12,35],[99,55]]}'
  ;;
schedule)
  run schedule '{"base":1200,"roundTo":500,"segments":[[99,35]],"bossMult":14.76}'
  run schedule '{"base":1200,"roundTo":500,"segments":[[99,18]],"bossMult":14.76}'
  run schedule '{"base":1500,"roundTo":500,"segments":[[99,15]],"bossMult":14.76}'
  run schedule '{"base":1500,"roundTo":500,"segments":[[99,20]],"bossMult":14.76}'
  run schedule '{"base":1500,"roundTo":500,"segments":[[11,14],[22,18],[33,22],[99,26]],"bossMult":14.76}'
  ;;
survival)
  run survival '{"base":900,"roundTo":50,"segments":[[99,35]]}'
  run survival '{"base":900,"roundTo":50,"segments":[[99,40]]}'
  run survival '{"base":1100,"roundTo":50,"segments":[[99,40]]}'
  run survival '{"base":900,"roundTo":50,"segments":[[5,35],[10,45],[99,55]]}'
  run survival '{"base":900,"roundTo":50,"segments":[[99,30]]}'
  ;;
esac
echo "DONE $1"
