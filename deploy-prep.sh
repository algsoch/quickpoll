#!/bin/bash
# QuickPoll Deployment Script
# This script prepares your application for deployment

set -e  # Exit on error

echo "🚀 QuickPoll Deployment Preparation"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if .env exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_warning "Please edit .env file with your production values"
        exit 1
    else
        print_error ".env.example not found!"
        exit 1
    fi
else
    print_success ".env file found"
fi

# Check required environment variables
required_vars=("DATABASE_URL" "SECRET_KEY" "GEMINI_API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=your-" .env || grep -q "^${var}=$" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing or invalid environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    print_warning "Please update your .env file before deploying"
    exit 1
fi

print_success "All required environment variables are set"

# Check if Docker is installed
if command -v docker &> /dev/null; then
    print_success "Docker is installed"
    docker --version
else
    print_warning "Docker is not installed. Install from: https://docker.com"
fi

# Check if Docker Compose is installed
if command -v docker-compose &> /dev/null; then
    print_success "Docker Compose is installed"
    docker-compose --version
else
    print_warning "Docker Compose is not installed"
fi

# Check Python version
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version)
    print_success "Python installed: $python_version"
else
    print_error "Python 3 is not installed"
    exit 1
fi

# Check if alembic is installed
if command -v alembic &> /dev/null; then
    print_success "Alembic is installed"
else
    print_warning "Alembic not found. Installing dependencies..."
    pip install -r requirements.txt
fi

# Check git status
if [ -d .git ]; then
    print_success "Git repository initialized"
    
    # Check for uncommitted changes
    if [[ -n $(git status -s) ]]; then
        print_warning "You have uncommitted changes"
        git status -s
        read -p "Do you want to commit these changes? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add .
            read -p "Enter commit message: " commit_msg
            git commit -m "$commit_msg"
            print_success "Changes committed"
        fi
    else
        print_success "No uncommitted changes"
    fi
else
    print_warning "Not a git repository. Initialize with: git init"
fi

echo ""
echo "📋 Deployment Checklist:"
echo "========================"

# Frontend API URL check
if grep -q "https://app.algsoch.tech" frontend/app.js; then
    print_warning "Update API_BASE_URL in frontend/app.js with your production domain"
    echo "   Current: https://app.algsoch.tech"
    echo "   Location: frontend/app.js line 5"
fi

# Security checks
if grep -q "your-super-secret-key" .env; then
    print_error "Default SECRET_KEY detected! Generate a secure key"
    echo "   Run: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
fi

if grep -q "SecureAdminPassword123!" .env; then
    print_warning "Default ADMIN_PASSWORD detected! Use a strong password"
fi

# Database migration check
echo ""
read -p "Do you want to run database migrations? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Running migrations..."
    alembic upgrade head
    print_success "Migrations completed"
fi

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo ""
echo "1. For Docker Deployment:"
echo "   docker-compose up --build"
echo ""
echo "2. For Azure Deployment:"
echo "   See DEPLOYMENT_GUIDE.md - Azure section"
echo ""
echo "3. For Render Deployment:"
echo "   - Push to GitHub"
echo "   - Connect repository in Render dashboard"
echo "   - Configure environment variables"
echo ""
echo "4. Test deployment:"
echo "   curl https://your-domain.com/health"
echo ""
echo "📖 Full deployment guide: DEPLOYMENT_GUIDE.md"
echo ""

print_success "Deployment preparation complete!"
