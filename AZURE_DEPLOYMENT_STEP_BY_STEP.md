# Azure Deployment - Complete Step-by-Step Guide

## 📋 Your Application Architecture

You have **TWO parts** to deploy:

1. **Backend API** (FastAPI) - Port 8080
   - Location: `backend/` folder
   - Needs: PostgreSQL database (you already have Azure PostgreSQL)
   - Deploy to: Azure Container Instances or Azure App Service

2. **Frontend** (HTML/CSS/JS) - Port 8000
   - Location: `frontend/` folder
   - Static files only
   - Deploy to: Azure Static Web Apps or Azure Blob Storage

## ✅ Share Feature - Automatic Cloud Compatibility

**Good news!** Your share feature will work automatically on Azure:

```javascript
// From app.js line 2867
const pollUrl = `${window.location.origin}${window.location.pathname}?poll=${pollId}`;
```

**This is cloud-ready because:**
- ✅ Uses `window.location.origin` (automatically gets your Azure domain)
- ✅ No hardcoded URLs
- ✅ Works on localhost AND production
- ✅ Tags are included in poll data (stored in database)

**Example URLs:**
- **Local:** `http://localhost:8000/?poll=123`
- **Azure:** `https://quickpoll.azurestaticapps.net/?poll=123`
- **Custom domain:** `https://yourdomain.com/?poll=123`

**No code changes needed!** ✨

---

## 🚀 Azure Deployment Options

### Option A: Container Instances (Recommended - Simpler)
- Backend → Azure Container Instances
- Frontend → Azure Static Web Apps
- **Cost:** ~$15-30/month
- **Setup time:** 30 minutes

### Option B: App Service (More features)
- Backend → Azure App Service (Linux + Docker)
- Frontend → Azure Static Web Apps
- **Cost:** ~$13-50/month
- **Setup time:** 45 minutes

---

## 📝 Pre-Deployment Steps

### 1. Verify Your Database Connection

You already have Azure PostgreSQL configured in `.env`:
```
DATABASE_URL=postgresql+asyncpg://vickypoll:Iit7065%40@vickykumar.postgres.database.azure.com:5432/postgres?ssl=require
```

This will work! ✅

### 2. Install Azure CLI

```powershell
# Download and install from:
# https://aka.ms/installazurecliwindows

# Or use winget:
winget install -e --id Microsoft.AzureCLI

# Verify installation
az --version
```

### 3. Login to Azure

```powershell
az login
```

This will open your browser to login.

### 4. Set Your Subscription

```powershell
# List subscriptions
az account list --output table

# Set active subscription (use your subscription ID)
az account set --subscription "YOUR-SUBSCRIPTION-ID"
```

---

## 🐳 OPTION A: Container Instances (Recommended)

This is **simpler** and perfect for getting started quickly.

### Step 1: Create Resource Group

```powershell
# Create resource group in East US (or your preferred region)
az group create --name quickpoll-rg --location eastus
```

### Step 2: Create Azure Container Registry

```powershell
# Create container registry (choose a unique name)
az acr create --resource-group quickpoll-rg --name quickpollregistry --sku Basic

# Login to registry
az acr login --name quickpollregistry
```

### Step 3: Build and Push Backend Image

```powershell
# Navigate to your project
cd C:\Users\npdim\OneDrive\Pictures\quickpoll

# Build and push to Azure Container Registry
az acr build --registry quickpollregistry --image quickpoll-backend:latest --file Dockerfile .
```

This will:
- Build your Docker image in Azure
- Push it to Azure Container Registry
- Takes about 3-5 minutes

### Step 4: Deploy Backend Container

```powershell
# Get registry credentials
$ACR_USERNAME = az acr credential show --name quickpollregistry --query username --output tsv
$ACR_PASSWORD = az acr credential show --name quickpollregistry --query "passwords[0].value" --output tsv

# Create container instance
az container create `
  --resource-group quickpoll-rg `
  --name quickpoll-backend `
  --image quickpollregistry.azurecr.io/quickpoll-backend:latest `
  --dns-name-label quickpoll-api-unique123 `
  --ports 8080 `
  --cpu 1 `
  --memory 1.5 `
  --registry-login-server quickpollregistry.azurecr.io `
  --registry-username $ACR_USERNAME `
  --registry-password $ACR_PASSWORD `
  --environment-variables `
    ENVIRONMENT=production `
    PORT=8080 `
    ALLOWED_ORIGINS=https://quickpoll-frontend.azurestaticapps.net `
  --secure-environment-variables `
    DATABASE_URL="postgresql+asyncpg://vickypoll:Iit7065%40@vickykumar.postgres.database.azure.com:5432/postgres?ssl=require" `
    SECRET_KEY="YOUR-NEW-SECRET-KEY-MIN-32-CHARS" `
    GEMINI_API_KEY="AIzaSyDLvgK7RnT6do4sdgJ8-fqcBPxpBxJSqyc" `
    ADMIN_PASSWORD="YourSecureAdminPassword123!"
```

**Important:** 
- Replace `quickpoll-api-unique123` with your unique name
- Generate new SECRET_KEY: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- Replace `YOUR-NEW-SECRET-KEY-MIN-32-CHARS` with generated key

### Step 5: Get Backend URL

```powershell
# Get the backend URL
az container show --resource-group quickpoll-rg --name quickpoll-backend --query "ipAddress.fqdn" --output tsv
```

You'll get something like: `quickpoll-api-unique123.eastus.azurecontainer.io`

Your backend API will be: `https://quickpoll-api-unique123.eastus.azurecontainer.io`

### Step 6: Test Backend

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://quickpoll-api-unique123.eastus.azurecontainer.io/health"

# Should return: {"status":"healthy"}
```

### Step 7: Update Frontend API URL

Edit `frontend/app.js` line 5:

```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://quickpoll-api-unique123.eastus.azurecontainer.io';  // ← Your actual URL
```

**Commit the change:**
```powershell
git add frontend/app.js
git commit -m "Update API URL for Azure deployment"
git push origin main
```

### Step 8: Deploy Frontend to Azure Static Web Apps

#### Option 8A: Using Azure Portal (Easier)

1. Go to https://portal.azure.com
2. Click "Create a resource"
3. Search for "Static Web App"
4. Click "Create"
5. Fill in:
   - **Subscription:** Your subscription
   - **Resource Group:** quickpoll-rg
   - **Name:** quickpoll-frontend
   - **Region:** East US 2
   - **Deployment source:** GitHub
   - **Sign in with GitHub** → Authorize
   - **Organization:** Your GitHub username
   - **Repository:** quickpoll (or your repo name)
   - **Branch:** main
   - **App location:** `/frontend`
   - **API location:** (leave empty)
   - **Output location:** (leave empty)
6. Click "Review + Create"
7. Click "Create"

Azure will:
- Create the Static Web App
- Set up GitHub Actions
- Deploy automatically
- Give you a URL like: `https://quickpoll-frontend.azurestaticapps.net`

#### Option 8B: Using Azure CLI

```powershell
# Install Static Web Apps CLI extension
az extension add --name staticwebapp

# Create Static Web App (requires GitHub token)
az staticwebapp create `
  --name quickpoll-frontend `
  --resource-group quickpoll-rg `
  --source https://github.com/yourusername/quickpoll `
  --location eastus2 `
  --branch main `
  --app-location "/frontend" `
  --login-with-github
```

### Step 9: Update CORS in Backend

After frontend deploys, update backend CORS:

```powershell
# Get frontend URL
az staticwebapp show --name quickpoll-frontend --resource-group quickpoll-rg --query "defaultHostname" --output tsv

# Update container with new CORS
az container delete --resource-group quickpoll-rg --name quickpoll-backend --yes

# Recreate with updated CORS (replace YOUR-FRONTEND-URL)
az container create `
  --resource-group quickpoll-rg `
  --name quickpoll-backend `
  --image quickpollregistry.azurecr.io/quickpoll-backend:latest `
  --dns-name-label quickpoll-api-unique123 `
  --ports 8080 `
  --cpu 1 `
  --memory 1.5 `
  --registry-login-server quickpollregistry.azurecr.io `
  --registry-username $ACR_USERNAME `
  --registry-password $ACR_PASSWORD `
  --environment-variables `
    ENVIRONMENT=production `
    PORT=8080 `
    ALLOWED_ORIGINS=https://YOUR-FRONTEND-URL.azurestaticapps.net `
  --secure-environment-variables `
    DATABASE_URL="postgresql+asyncpg://vickypoll:Iit7065%40@vickykumar.postgres.database.azure.com:5432/postgres?ssl=require" `
    SECRET_KEY="YOUR-SECRET-KEY" `
    GEMINI_API_KEY="AIzaSyDLvgK7RnT6do4sdgJ8-fqcBPxpBxJSqyc" `
    ADMIN_PASSWORD="YourSecureAdminPassword123!"
```

---

## 🔧 OPTION B: App Service (Alternative)

If you want more features like custom domains, scaling, etc.

### Step 1-2: Same as Option A (Resource Group + Container Registry)

### Step 3: Build and Push (Same as Option A)

### Step 4: Create App Service Plan

```powershell
az appservice plan create `
  --name quickpoll-plan `
  --resource-group quickpoll-rg `
  --is-linux `
  --sku B1
```

### Step 5: Create Web App

```powershell
az webapp create `
  --resource-group quickpoll-rg `
  --plan quickpoll-plan `
  --name quickpoll-api-app `
  --deployment-container-image-name quickpollregistry.azurecr.io/quickpoll-backend:latest
```

### Step 6: Configure Web App

```powershell
# Set environment variables
az webapp config appsettings set `
  --name quickpoll-api-app `
  --resource-group quickpoll-rg `
  --settings `
    ENVIRONMENT=production `
    PORT=8080 `
    WEBSITES_PORT=8080 `
    ALLOWED_ORIGINS=https://quickpoll-frontend.azurestaticapps.net `
    DATABASE_URL="postgresql+asyncpg://vickypoll:Iit7065%40@vickykumar.postgres.database.azure.com:5432/postgres?ssl=require" `
    SECRET_KEY="YOUR-SECRET-KEY" `
    GEMINI_API_KEY="AIzaSyDLvgK7RnT6do4sdgJ8-fqcBPxpBxJSqyc" `
    ADMIN_PASSWORD="YourSecureAdminPassword123!"

# Enable container logging
az webapp log config `
  --name quickpoll-api-app `
  --resource-group quickpoll-rg `
  --docker-container-logging filesystem

# Enable always on
az webapp config set `
  --name quickpoll-api-app `
  --resource-group quickpoll-rg `
  --always-on true

# Enable HTTPS only
az webapp update `
  --name quickpoll-api-app `
  --resource-group quickpoll-rg `
  --https-only true
```

Your backend URL will be: `https://quickpoll-api-app.azurewebsites.net`

### Step 7-9: Same as Option A (Frontend deployment)

---

## ✅ Post-Deployment Testing

### 1. Test Backend Health

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://YOUR-BACKEND-URL/health"

# Should return: {"status":"healthy"}
```

### 2. Test API Documentation

Open in browser: `https://YOUR-BACKEND-URL/docs`

You should see Swagger UI

### 3. Test Frontend

1. Open `https://YOUR-FRONTEND-URL.azurestaticapps.net`
2. Register a new account
3. Create a poll with tags
4. Verify tags show as chips
5. Click "🔗 Share" button
6. **Test share feature:**
   - Copy the share URL
   - Open in incognito/private window
   - Poll should load automatically
   - URL format: `https://YOUR-FRONTEND-URL/?poll=123`

### 4. Test Tag Sharing Specifically

1. Create poll with tags: "azure", "deployment", "cloud"
2. Tags should appear as purple chips
3. Click share button
4. The share URL includes poll ID
5. Poll data (including tags) loads from database
6. **Everything works automatically!** ✅

---

## 🔍 Monitoring and Logs

### View Backend Logs (Container Instances)

```powershell
# View logs
az container logs --resource-group quickpoll-rg --name quickpoll-backend

# Follow logs (live)
az container logs --resource-group quickpoll-rg --name quickpoll-backend --follow
```

### View Backend Logs (App Service)

```powershell
# Stream logs
az webapp log tail --name quickpoll-api-app --resource-group quickpoll-rg

# Download logs
az webapp log download --name quickpoll-api-app --resource-group quickpoll-rg
```

### View Frontend Logs

In Azure Portal:
1. Go to your Static Web App
2. Click "Functions" → "Logging"
3. Or check GitHub Actions for deployment logs

---

## 🔄 Updating Your Application

### Update Backend

```powershell
# Rebuild and push new image
az acr build --registry quickpollregistry --image quickpoll-backend:latest --file Dockerfile .

# For Container Instances - delete and recreate
az container delete --resource-group quickpoll-rg --name quickpoll-backend --yes
# Then run create command again (from Step 4)

# For App Service - restart
az webapp restart --name quickpoll-api-app --resource-group quickpoll-rg
```

### Update Frontend

Just push to GitHub:
```powershell
git add .
git commit -m "Update frontend"
git push origin main
```

Azure Static Web Apps auto-deploys!

---

## 💰 Cost Estimation

### Option A (Container Instances):
- **Container Instance (B1):** ~$15/month
- **Container Registry (Basic):** ~$5/month
- **Static Web App (Free tier):** $0
- **Database:** You already have it
- **Total:** ~$20/month

### Option B (App Service):
- **App Service (B1):** ~$13/month
- **Container Registry:** ~$5/month
- **Static Web App (Free):** $0
- **Database:** You already have it
- **Total:** ~$18/month

---

## 🆘 Troubleshooting

### Issue: CORS errors in browser

**Solution:**
```powershell
# Update ALLOWED_ORIGINS in backend
# Recreate container with correct frontend URL
```

### Issue: Backend won't start

**Check logs:**
```powershell
az container logs --resource-group quickpoll-rg --name quickpoll-backend
```

**Common causes:**
- Wrong DATABASE_URL format
- Missing environment variables
- Port mismatch

### Issue: Share URLs not working

**Solution:**
- Share URLs work automatically! The code uses `window.location.origin`
- If not working, check:
  1. Backend API is accessible
  2. Database has poll data
  3. CORS is configured correctly
  4. No browser console errors

### Issue: Tags not showing

**Solution:**
- Clear browser cache (Ctrl+Shift+Delete)
- Verify version v64 is deployed
- Check if backend returns tags in API response:
  ```powershell
  Invoke-RestMethod -Uri "https://YOUR-BACKEND-URL/api/polls/1"
  ```

---

## 📋 Complete Deployment Checklist

- [ ] Azure CLI installed and logged in
- [ ] Resource group created
- [ ] Container registry created
- [ ] Backend image built and pushed
- [ ] Backend container/app service deployed
- [ ] Backend health check passes
- [ ] Frontend API URL updated in app.js
- [ ] Changes committed to GitHub
- [ ] Frontend static web app created
- [ ] Frontend deployment successful
- [ ] Backend CORS updated with frontend URL
- [ ] Can register/login on frontend
- [ ] Can create polls with tags
- [ ] Tags display as chips
- [ ] Share button works
- [ ] Share URLs load polls correctly
- [ ] Tags included in shared polls

---

## 🎯 Summary: Your Two-Part Deployment

### Backend (FastAPI API)
**Where:** Azure Container Instances or App Service
**URL:** `https://quickpoll-api-unique123.eastus.azurecontainer.io`
**What it does:**
- Handles all API requests
- Connects to your PostgreSQL database
- Returns poll data including tags

### Frontend (Static HTML/CSS/JS)
**Where:** Azure Static Web Apps
**URL:** `https://quickpoll-frontend.azurestaticapps.net`
**What it does:**
- Serves HTML/CSS/JS files
- Calls backend API
- Displays polls and tags

### Share Feature
**Status:** ✅ **Works automatically on Azure!**
**How:**
```javascript
// Automatically uses Azure domain
const pollUrl = `${window.location.origin}/?poll=${pollId}`;
```

**No code changes needed!** Your share feature will work perfectly on Azure.

---

**Ready to deploy?** Start with **Option A (Container Instances)** - it's simpler!

Questions? Check `DEPLOYMENT_GUIDE.md` for more details or troubleshooting section above.
