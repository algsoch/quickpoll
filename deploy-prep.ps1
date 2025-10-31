# QuickPoll Deployment Preparation Script (PowerShell)
# Run this before deploying to Docker, Azure, or Render

$ErrorActionPreference = "Stop"

Write-Host "🚀 QuickPoll Deployment Preparation" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

function Write-Success {
    param($Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Error ".env file not found!"
    if (Test-Path .env.example) {
        Write-Host "Creating .env from .env.example..."
        Copy-Item .env.example .env
        Write-Warning "Please edit .env file with your production values"
        exit 1
    } else {
        Write-Error ".env.example not found!"
        exit 1
    }
} else {
    Write-Success ".env file found"
}

# Check required environment variables
$envContent = Get-Content .env -Raw
$requiredVars = @("DATABASE_URL", "SECRET_KEY", "GEMINI_API_KEY")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not ($envContent -match "^$var=.+$" -and -not $envContent -match "^$var=your-")) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Error "Missing or invalid environment variables:"
    foreach ($var in $missingVars) {
        Write-Host "  - $var"
    }
    Write-Host ""
    Write-Warning "Please update your .env file before deploying"
    exit 1
}

Write-Success "All required environment variables are set"

# Check if Docker is installed
try {
    $dockerVersion = docker --version
    Write-Success "Docker is installed: $dockerVersion"
} catch {
    Write-Warning "Docker is not installed. Install from: https://docker.com"
}

# Check if Docker Compose is installed
try {
    $composeVersion = docker-compose --version
    Write-Success "Docker Compose is installed: $composeVersion"
} catch {
    Write-Warning "Docker Compose is not installed"
}

# Check Python version
try {
    $pythonVersion = python --version
    Write-Success "Python installed: $pythonVersion"
} catch {
    Write-Error "Python 3 is not installed"
    exit 1
}

# Check if git is initialized
if (Test-Path .git) {
    Write-Success "Git repository initialized"
    
    # Check for uncommitted changes
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Warning "You have uncommitted changes:"
        git status -s
        $commit = Read-Host "Do you want to commit these changes? (y/n)"
        if ($commit -eq 'y' -or $commit -eq 'Y') {
            git add .
            $commitMsg = Read-Host "Enter commit message"
            git commit -m $commitMsg
            Write-Success "Changes committed"
        }
    } else {
        Write-Success "No uncommitted changes"
    }
} else {
    Write-Warning "Not a git repository. Initialize with: git init"
}

Write-Host ""
Write-Host "📋 Deployment Checklist:" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Frontend API URL check
$appJsContent = Get-Content frontend/app.js -Raw
if ($appJsContent -match "https://app.algsoch.tech") {
    Write-Warning "Update API_BASE_URL in frontend/app.js with your production domain"
    Write-Host "   Current: https://app.algsoch.tech" -ForegroundColor Gray
    Write-Host "   Location: frontend/app.js line 5" -ForegroundColor Gray
}

# Security checks
if ($envContent -match "your-super-secret-key") {
    Write-Error "Default SECRET_KEY detected! Generate a secure key"
    Write-Host "   Run: python -c `"import secrets; print(secrets.token_urlsafe(32))`"" -ForegroundColor Gray
}

if ($envContent -match "SecureAdminPassword123!") {
    Write-Warning "Default ADMIN_PASSWORD detected! Use a strong password"
}

# Database migration check
Write-Host ""
$runMigrations = Read-Host "Do you want to run database migrations? (y/n)"
if ($runMigrations -eq 'y' -or $runMigrations -eq 'Y') {
    Write-Success "Running migrations..."
    try {
        alembic upgrade head
        Write-Success "Migrations completed"
    } catch {
        Write-Error "Migration failed: $_"
    }
}

Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. For Docker Deployment:" -ForegroundColor Yellow
Write-Host "   docker-compose up --build" -ForegroundColor Gray
Write-Host ""
Write-Host "2. For Azure Deployment:" -ForegroundColor Yellow
Write-Host "   See DEPLOYMENT_GUIDE.md - Azure section" -ForegroundColor Gray
Write-Host ""
Write-Host "3. For Render Deployment:" -ForegroundColor Yellow
Write-Host "   - Push to GitHub" -ForegroundColor Gray
Write-Host "   - Connect repository in Render dashboard" -ForegroundColor Gray
Write-Host "   - Configure environment variables" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test deployment:" -ForegroundColor Yellow
Write-Host "   Invoke-RestMethod -Uri https://your-domain.com/health" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Full deployment guide: DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

Write-Success "Deployment preparation complete!"
