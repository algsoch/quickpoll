# Quick CI Status Checker
# Usage: .\check-ci.ps1

Write-Host "🔍 Checking GitHub Actions status..." -ForegroundColor Cyan
Write-Host ""

# Show recent runs
Write-Host "📊 Recent Workflow Runs:" -ForegroundColor Yellow
gh run list --limit 5

Write-Host ""
Write-Host "💡 Useful commands:" -ForegroundColor Green
Write-Host "  gh run list              - List all runs"
Write-Host "  gh run watch             - Watch latest run"
Write-Host "  gh run view --log        - View latest run logs"
Write-Host "  gh run view <id> --log   - View specific run logs"
