param(
    [string]$Repo = "OohBen/SpaceTimeHackathon",
    [switch]$ApplyLabelRepairs
)

$ErrorActionPreference = "Stop"

$stateLabels = @("needs-human-review", "ai-approved", "in-progress", "review-ready", "in-review")
$issueStateCache = @{}

function Invoke-Gh {
    param([string[]]$Arguments)

    $output = & gh @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw (($output | Out-String).Trim())
    }

    return $output
}

function Invoke-GhJson {
    param([string[]]$Arguments)

    $output = Invoke-Gh -Arguments $Arguments
    return (($output | Out-String) | ConvertFrom-Json)
}

function Get-LabelNames {
    param([object]$Issue)
    return @($Issue.labels | ForEach-Object { [string]$_.name })
}

function Get-SectionIssueNumbers {
    param(
        [object]$Body,
        [string]$Heading
    )

    $text = ""
    if ($null -ne $Body) {
        $text = [string]$Body
    }

    $pattern = "(?is)##\s*" + [regex]::Escape($Heading) + "\s*(.*?)(?:\r?\n##\s|\z)"
    $match = [regex]::Match($text, $pattern)
    if (-not $match.Success) {
        return @()
    }

    return @([regex]::Matches($match.Groups[1].Value, "#(\d+)") | ForEach-Object {
        [int]$_.Groups[1].Value
    })
}

function Get-IssueState {
    param(
        [int]$Number,
        [hashtable]$OpenIssueByNumber,
        [string]$RepoName
    )

    if ($issueStateCache.ContainsKey($Number)) {
        return $issueStateCache[$Number]
    }

    if ($OpenIssueByNumber.ContainsKey($Number)) {
        $issueStateCache[$Number] = "open"
        return "open"
    }

    try {
        $issue = Invoke-GhJson -Arguments @("api", "repos/$RepoName/issues/$Number")
        $issueStateCache[$Number] = [string]$issue.state
        return [string]$issue.state
    }
    catch {
        $issueStateCache[$Number] = "unknown"
        return "unknown"
    }
}

function Invoke-LabelRepair {
    param(
        [string]$RepoName,
        [int]$Number,
        [string]$Action
    )

    if ($Action -eq "add-blocked") {
        Invoke-Gh -Arguments @("api", "-X", "POST", "repos/$RepoName/issues/$Number/labels", "-f", "labels[]=blocked") | Out-Null
        return
    }

    if ($Action -eq "remove-blocked") {
        Invoke-Gh -Arguments @("api", "-X", "DELETE", "repos/$RepoName/issues/$Number/labels/blocked") | Out-Null
        return
    }
}

$pages = Invoke-GhJson -Arguments @("api", "--paginate", "--slurp", "repos/$Repo/issues?state=open&per_page=100")
$openIssues = @($pages | ForEach-Object { $_ } | Where-Object { -not $_.pull_request })

$openIssueByNumber = @{}
foreach ($issue in $openIssues) {
    $openIssueByNumber[[int]$issue.number] = $issue
}

$blocksByIssue = @{}
$blockedByByIssue = @{}
foreach ($issue in $openIssues) {
    $number = [int]$issue.number
    $blocksByIssue[$number] = @(Get-SectionIssueNumbers -Body $issue.body -Heading "Blocks")
    $blockedByByIssue[$number] = @(Get-SectionIssueNumbers -Body $issue.body -Heading "Blocked By")
}

$claimableTasks = @()
$labelRepairs = @()
$stateLabelViolations = @()
$projectAiApproved = @()
$dependencyLinkGaps = @()

foreach ($issue in $openIssues) {
    $labels = Get-LabelNames -Issue $issue
    $labelStates = @($labels | Where-Object { $stateLabels -contains $_ })
    $blockedBy = @($blockedByByIssue[[int]$issue.number])
    $dependencyStates = @($blockedBy | ForEach-Object {
        [pscustomobject]@{
            issue = $_
            state = Get-IssueState -Number $_ -OpenIssueByNumber $openIssueByNumber -RepoName $Repo
        }
    })
    $openDependencies = @($dependencyStates | Where-Object { $_.state -ne "closed" })
    $hasBlockedLabel = $labels -contains "blocked"
    $isContainer = ($labels -contains "project") -or ($labels -contains "epic")
    $isVerify = ([string]$issue.title -match "(?i)\bverify\b")
    $assigneeCount = @($issue.assignees).Count

    if ($labelStates.Count -gt 1) {
        $stateLabelViolations += [pscustomobject]@{
            issue = [int]$issue.number
            title = [string]$issue.title
            labels = $labelStates
        }
    }

    if (($labels -contains "project") -and ($labels -contains "ai-approved")) {
        $projectAiApproved += [pscustomobject]@{
            issue = [int]$issue.number
            title = [string]$issue.title
        }
    }

    if ($openDependencies.Count -gt 0 -and -not $hasBlockedLabel) {
        $labelRepairs += [pscustomobject]@{
            issue = [int]$issue.number
            title = [string]$issue.title
            action = "add-blocked"
            openDependencies = @($openDependencies | ForEach-Object { "#" + $_.issue + "=" + $_.state })
        }
    }

    if ($openDependencies.Count -eq 0 -and $hasBlockedLabel) {
        $labelRepairs += [pscustomobject]@{
            issue = [int]$issue.number
            title = [string]$issue.title
            action = "remove-blocked"
            openDependencies = @()
        }
    }

    if (
        ($labels -contains "ai-approved") -and
        $labelStates.Count -eq 1 -and
        -not $hasBlockedLabel -and
        -not $isContainer -and
        -not $isVerify -and
        $assigneeCount -eq 0 -and
        $openDependencies.Count -eq 0
    ) {
        $claimableTasks += [pscustomobject]@{
            issue = [int]$issue.number
            title = [string]$issue.title
            blockedBy = @($dependencyStates | ForEach-Object { "#" + $_.issue + "=" + $_.state })
        }
    }
}

foreach ($issue in $openIssues) {
    $sourceNumber = [int]$issue.number
    foreach ($targetNumber in @($blocksByIssue[$sourceNumber])) {
        if (-not $openIssueByNumber.ContainsKey($targetNumber)) {
            continue
        }

        if (@($blockedByByIssue[$targetNumber]) -notcontains $sourceNumber) {
            $dependencyLinkGaps += [pscustomobject]@{
                issue = $targetNumber
                title = [string]$openIssueByNumber[$targetNumber].title
                missingBlockedBy = "#" + $sourceNumber
                sourceIssue = $sourceNumber
                sourceTitle = [string]$issue.title
            }
        }
    }
}

if ($ApplyLabelRepairs) {
    foreach ($repair in $labelRepairs) {
        Invoke-LabelRepair -RepoName $Repo -Number $repair.issue -Action $repair.action
    }
}

[pscustomobject]@{
    repo = $Repo
    scannedOpenIssues = $openIssues.Count
    pages = @($pages).Count
    applyLabelRepairs = [bool]$ApplyLabelRepairs
    claimableTasks = $claimableTasks
    labelRepairs = $labelRepairs
    dependencyLinkGaps = $dependencyLinkGaps
    stateLabelViolations = $stateLabelViolations
    projectAiApproved = $projectAiApproved
} | ConvertTo-Json -Depth 8
