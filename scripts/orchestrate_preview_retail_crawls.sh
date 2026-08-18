#!/usr/bin/env bash
set -u

BRANCH="${1:-price-preview-20260819}"
BATCH="${2:-80}"
TOTAL="${3:-994}"
LOG="${4:-data/full-retailer-orchestration.log}"
mkdir -p "$(dirname "$LOG")"

stores=(Snowys BCF Tentworld "Wild Earth" Anaconda)

log() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG"
}

run_batch() {
  local store="$1"
  local limit="$2"
  gh workflow run daily-public-store-prices.yml --ref "$BRANCH" -f limit="$limit" -f store="$store" >/tmp/campmate-dispatch.out 2>&1 || {
    log "dispatch failed store=$store limit=$limit"
    cat /tmp/campmate-dispatch.out >> "$LOG"
    return 1
  }
  sleep 8
  local run_id
  run_id=$(gh run list --workflow daily-public-store-prices.yml --branch "$BRANCH" --limit 5 --json databaseId,createdAt --jq 'sort_by(.createdAt) | .[-1].databaseId')
  log "started store=$store limit=$limit run=$run_id"
  while true; do
    local state
    state=$(gh run view "$run_id" --json status,conclusion --jq '[.status,.conclusion] | @tsv')
    log "state store=$store run=$run_id $state"
    case "$state" in
      completed$'\tsuccess')
        gh run view "$run_id" --log 2>/dev/null | grep -E 'Done\. scanned|matched|failed|Wrote|No public' | tail -20 >> "$LOG" || true
        return 0
        ;;
      completed$'\tcancelled'|completed$'\tfailure'|completed$'\ttimed_out'|completed$'\taction_required')
        gh run view "$run_id" --log 2>/dev/null | tail -80 >> "$LOG" || true
        return 1
        ;;
    esac
    sleep 30
  done
}

log "begin branch=$BRANCH batch=$BATCH total=$TOTAL"
for store in "${stores[@]}"; do
  remaining="$TOTAL"
  batch_no=0
  while (( remaining > 0 )); do
    limit="$BATCH"
    if (( remaining < limit )); then limit="$remaining"; fi
    batch_no=$((batch_no + 1))
    if ! run_batch "$store" "$limit"; then
      log "batch failed; continuing store=$store batch=$batch_no"
    fi
    remaining=$((remaining - limit))
  done
done
log "complete branch=$BRANCH"
