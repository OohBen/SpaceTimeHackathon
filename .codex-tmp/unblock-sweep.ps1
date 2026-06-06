$ErrorActionPreference = 'Stop'

$issuesJson = gh issue list --state open --label blocked --limit 200 --json number,body
$issues = $issuesJson | ConvertFrom-Json
$stateCache = @{}
$unblocked = @()
$kept = @()

foreach ($issue in $issues) {
  $body = [string]$issue.body
  $match = [regex]::Match($body, '(?ms)^## Blocked By\s*(.*?)(?:^\s*##\s|\z)')
  if (-not $match.Success) {
    $kept += [pscustomobject]@{ number = $issue.number; reason = 'no-blocked-by-section' }
    continue
  }

  $blockers = @([regex]::Matches($match.Groups[1].Value, '#(\d+)') | ForEach-Object { [int]$_.Groups[1].Value } | Sort-Object -Unique)
  if ($blockers.Count -eq 0) {
    $kept += [pscustomobject]@{ number = $issue.number; reason = 'no-blocker-numbers' }
    continue
  }

  $openBlockers = @()
  foreach ($blocker in $blockers) {
    if (-not $stateCache.ContainsKey($blocker)) {
      $stateJson = gh issue view $blocker --json state
      $stateCache[$blocker] = (($stateJson | ConvertFrom-Json).state)
    }
    if ($stateCache[$blocker] -ne 'CLOSED') {
      $openBlockers += $blocker
    }
  }

  if ($openBlockers.Count -eq 0) {
    gh issue edit $issue.number --remove-label blocked | Out-Null
    $blockerText = (($blockers | ForEach-Object { "#$_" }) -join ', ')
    gh issue comment $issue.number --body "agent: unblocked - blockers closed ($blockerText); task can proceed." | Out-Null
    $unblocked += [pscustomobject]@{ number = $issue.number; blockers = $blockers }
  } else {
    $kept += [pscustomobject]@{ number = $issue.number; openBlockers = $openBlockers }
  }
}

[pscustomobject]@{
  scanned = $issues.Count
  unblocked = $unblocked
  keptBlocked = $kept.Count
} | ConvertTo-Json -Depth 5
