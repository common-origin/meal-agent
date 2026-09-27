#!/usr/bin/env bash
# Set fields on a meal-agent issue in the Meal Agent project board
# (https://github.com/users/common-origin/projects/2), adding the issue to the
# project first if it isn't there yet.
#
# Usage:
#   scripts/project-item.sh <issue-number> Field=Value [Field=Value ...]
#
# Examples:
#   scripts/project-item.sh 78 Status="In progress"
#   scripts/project-item.sh 78 Status="In review"
#   scripts/project-item.sh 98 Status=Backlog Priority=P2 Category=Bug Size=S
#
# Works for any single-select field (Status, Priority, Category, Size). Field
# and option names are looked up at run time, so this keeps working if options
# are renamed or re-created in the project UI. Cycle (an iteration field) is
# set during weekly planning, not by this script.
#
# Needs a gh token with the `project` scope: `gh auth refresh -s project`.
set -euo pipefail

OWNER="common-origin"
REPO="meal-agent"
PROJECT_NUMBER=2

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

[[ $# -ge 2 ]] || usage
issue="$1"
shift
[[ "$issue" =~ ^[0-9]+$ ]] || { echo "error: issue number must be numeric, got '$issue'" >&2; exit 1; }

project_id=$(gh project view "$PROJECT_NUMBER" --owner "$OWNER" --format json --jq '.id')
fields_json=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json)

item_id=$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" \
  --url "https://github.com/$OWNER/$REPO/issues/$issue" --format json --jq '.id')

for pair in "$@"; do
  [[ "$pair" == *=* ]] || { echo "error: expected Field=Value, got '$pair'" >&2; exit 1; }
  field="${pair%%=*}"
  value="${pair#*=}"

  field_id=$(jq -r --arg f "$field" '.fields[] | select(.name == $f and .options != null) | .id' <<<"$fields_json")
  if [[ -z "$field_id" ]]; then
    echo "error: no single-select field named '$field'. Available:" >&2
    jq -r '.fields[] | select(.options != null) | "  " + .name' <<<"$fields_json" >&2
    exit 1
  fi

  option_id=$(jq -r --arg f "$field" --arg v "$value" \
    '.fields[] | select(.name == $f) | .options[] | select(.name == $v) | .id' <<<"$fields_json")
  if [[ -z "$option_id" ]]; then
    echo "error: '$value' isn't an option of $field. Options:" >&2
    jq -r --arg f "$field" '.fields[] | select(.name == $f) | .options[] | "  " + .name' <<<"$fields_json" >&2
    exit 1
  fi

  gh project item-edit --id "$item_id" --project-id "$project_id" \
    --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null
  echo "#$issue: $field → $value"
done
