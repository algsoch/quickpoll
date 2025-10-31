# QuickPoll Deployment Guide

Complete guide for deploying QuickPoll to Docker, Azure, and Render with tag sharing functionality.

## 📋 Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env` and fill in production values
- [ ] Generate a secure SECRET_KEY (minimum 32 characters)
- [ ] Configure DATABASE_URL for production database
- [ ] Set GEMINI_API_KEY for AI features
- [ ] Update ALLOWED_ORIGINS with production domains
- [ ] Configure Google OAuth credentials (if using)
- [ ] Set strong ADMIN_PASSWORD

### 2. Frontend Configuration
Update `frontend/app.js` line 5 with your production API URL:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://your-api-domain.com';  // ← Update this
```

### 3. Database Migration
Ensure all migrations are applied:
```bash
alembic upgrade head
```

### 4. Tag Sharing Feature Verification
The tag system (v64) includes:
- ✅ Visual tag chips with add/remove functionality
- ✅ Tags stored as JSON in database
- ✅ Share URLs include tags in query parameters
- ✅ Tags work across all deployment platforms

---

## 🐳 Docker Deployment

### Local Development with Docker Compose

1. **Build and start services:**
```bash
docker-compose up --build
```

2. **Access the application:**
- Frontend: http://localhost:8000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

3. **Run database migrations:**
```bash
docker-compose exec backend alembic upgrade head
```

4. **View logs:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

5. **Stop services:**
```bash
docker-compose down
```

### Production Docker Build

1. **Build production image:**
```bash
docker build --target production -t quickpoll:latest .
```

2. **Run production container:**
```bash
docker run -d \
  --name quickpoll-api \
  -p 8080:8080 \
  -e DATABASE_URL="your-production-db-url" \
  -e SECRET_KEY="your-secret-key" \
  -e GEMINI_API_KEY="your-gemini-key" \
  -e ALLOWED_ORIGINS="https://yourdomain.com" \
  -e ENVIRONMENT=production \
  quickpoll:latest
```

3. **Push to Docker Hub (optional):**
```bash
docker tag quickpoll:latest yourusername/quickpoll:latest
docker push yourusername/quickpoll:latest
```

---

## ☁️ Azure Deployment

### Option 1: Azure Container Instances

1. **Create resource group:**
```bash
az group create --name quickpoll-rg --location eastus
```

2. **Create Azure Container Registry:**
```bash
az acr create --resource-group quickpoll-rg --name quickpollacr --sku Basic
az acr login --name quickpollacr
```

3. **Build and push to ACR:**
```bash
az acr build --registry quickpollacr --image quickpoll:latest --file Dockerfile .
```

4. **Deploy Container Instance:**
```bash
az container create \
  --resource-group quickpoll-rg \
  --name quickpoll-api \
  --image quickpollacr.azurecr.io/quickpoll:latest \
  --dns-name-label quickpoll-api \
  --ports 8080 \
  --environment-variables \
    ENVIRONMENT=production \
    ALLOWED_ORIGINS=https://yourdomain.com \
  --secure-environment-variables \
    DATABASE_URL=your-db-url \
    SECRET_KEY=your-secret-key \
    GEMINI_API_KEY=your-gemini-key
```

### Option 2: Azure App Service

1. **Create App Service Plan:**
```bash
az appservice plan create \
  --name quickpoll-plan \
  --resource-group quickpoll-rg \
  --is-linux \
  --sku B1
```

2. **Create Web App:**
```bash
az webapp create \
  --resource-group quickpoll-rg \
  --plan quickpoll-plan \
  --name quickpoll-api \
  --deployment-container-image-name quickpollacr.azurecr.io/quickpoll:latest
```

3. **Configure environment variables:**
```bash
az webapp config appsettings set \
  --name quickpoll-api \
  --resource-group quickpoll-rg \
  --settings \
    DATABASE_URL="your-db-url" \
    SECRET_KEY="your-secret-key" \
    GEMINI_API_KEY="your-gemini-key" \
    ENVIRONMENT=production \
    ALLOWED_ORIGINS="https://yourdomain.com" \
    WEBSITES_PORT=8080 \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
```

4. **Enable continuous deployment:**
```bash
az webapp deployment container config \
  --name quickpoll-api \
  --resource-group quickpoll-rg \
  --enable-cd true
```

### Azure Static Web Apps (Frontend)

1. **Deploy frontend:**
```bash
az staticwebapp create \
  --name quickpoll-frontend \
  --resource-group quickpoll-rg \
  --source https://github.com/yourusername/quickpoll \
  --location eastus2 \
  --branch main \
  --app-location "/frontend" \
  --login-with-github
```

2. **Update API URL in frontend:**
Update `frontend/app.js` with your Azure API URL:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://quickpoll-api.azurecontainer.io';
```

---

## 🚀 Render Deployment

### Backend API

1. **Create new Web Service on Render:**
   - Go to https://render.com/
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name:** quickpoll-api
     - **Environment:** Docker
     - **Region:** Choose closest to your users
     - **Branch:** main
     - **Dockerfile Path:** ./Dockerfile
     - **Docker Build Context:** .

2. **Set environment variables:**
```
DATABASE_URL=your-postgres-url
SECRET_KEY=your-secret-key-min-32-chars
GEMINI_API_KEY=your-gemini-api-key
ENVIRONMENT=production
ALLOWED_ORIGINS=https://quickpoll-frontend.onrender.com,https://yourdomain.com
PORT=10000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
RATE_LIMIT_PER_MINUTE=60
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://quickpoll-api.onrender.com/api/users/auth/google/callback
```

3. **Advanced settings:**
   - **Health Check Path:** /health
   - **Auto-Deploy:** Yes

### Frontend (Static Site)

1. **Create new Static Site on Render:**
   - Click "New +" → "Static Site"
   - Connect your GitHub repository
   - Configure:
     - **Name:** quickpoll-frontend
     - **Branch:** main
     - **Publish Directory:** ./frontend

2. **Update API URL:**
Before deploying, update `frontend/app.js`:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://quickpoll-api.onrender.com';
```

3. **Configure Headers (optional):**
Add `render.yaml` in root (already included):
```yaml
services:
  - type: web
    name: quickpoll-frontend
    env: static
    buildCommand: echo "Static site"
    staticPublishPath: ./frontend
```

### PostgreSQL Database on Render

1. **Create PostgreSQL instance:**
   - Click "New +" → "PostgreSQL"
   - **Name:** quickpoll-db
   - **Plan:** Choose based on your needs (Free tier available)

2. **Copy connection string:**
   - Format: `postgresql://user:password@host/database`
   - Convert to asyncpg format:
   ```
   postgresql+asyncpg://user:password@host/database
   ```

3. **Add to environment variables** in your Web Service

---

## 🔗 Tag Sharing Verification

The tag system works on all platforms. Test it:

1. **Create a poll with tags:**
   - Use the visual tag input to add tags like "python", "webdev", "tutorial"
   - Tags appear as purple chips below the input

2. **Share the poll:**
   - Click share button
   - URL format: `https://yourdomain.com/?poll=123&tags=python,webdev,tutorial`

3. **Verify on shared link:**
   - Tags should be visible in poll detail view
   - Tags are searchable via search functionality
   - Tags work across all deployment platforms (Docker/Azure/Render)

### Tag System Technical Details:
- **Storage:** Tags stored as JSON array in PostgreSQL
- **Backend:** FastAPI serializes with `json.dumps()`/`json.loads()`
- **Frontend:** TagInput class manages visual chips
- **Sharing:** Tags included in URL query parameters
- **Search:** Tags are indexed and searchable
- **Limit:** Maximum 10 tags per poll
- **Validation:** Duplicates prevented, empty tags filtered

---

## 🧪 Testing Deployment

### Health Check
```bash
curl https://your-api-domain.com/health
```

Expected response:
```json
{"status": "healthy"}
```

### API Documentation
Visit: `https://your-api-domain.com/docs`

### Test Tag Functionality
1. Create poll with tags via UI
2. Check database: Tags stored as JSON array
3. View poll detail: Tags displayed as chips
4. Share poll: URL includes tags
5. Search by tag: Results filtered correctly

### Common Issues

**Issue:** CORS errors in browser console
**Solution:** Add frontend domain to `ALLOWED_ORIGINS`

**Issue:** Database connection fails
**Solution:** Verify `DATABASE_URL` format includes `+asyncpg` and `?ssl=require` for cloud DBs

**Issue:** Tags not showing
**Solution:** Clear browser cache, verify version v64 is deployed

**Issue:** 502 Bad Gateway
**Solution:** Check health endpoint, verify PORT env var matches container port

**Issue:** OAuth redirect fails
**Solution:** Update `GOOGLE_REDIRECT_URI` with production URL

---

## 📊 Monitoring & Logs

### Docker Logs
```bash
docker logs quickpoll-api -f
```

### Azure Logs
```bash
az webapp log tail --name quickpoll-api --resource-group quickpoll-rg
```

### Render Logs
- View in Render Dashboard → Your Service → Logs

---

## 🔄 Continuous Deployment

### GitHub Actions (Automated)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and push to Docker Hub
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker build -t ${{ secrets.DOCKER_USERNAME }}/quickpoll:latest .
          docker push ${{ secrets.DOCKER_USERNAME }}/quickpoll:latest
```

Add secrets in GitHub: Settings → Secrets → Actions

---

## 🔐 Security Checklist

- [ ] Changed default SECRET_KEY
- [ ] Changed default ADMIN_PASSWORD
- [ ] Using HTTPS in production
- [ ] Environment variables secured (not in code)
- [ ] CORS origins restricted to your domains
- [ ] Database uses SSL connection
- [ ] Rate limiting enabled
- [ ] .env file in .gitignore
- [ ] Regular security updates applied

---

## 📝 Post-Deployment

1. **Update DNS** (if using custom domain)
2. **Configure SSL certificate** (Let's Encrypt/Cloudflare)
3. **Set up monitoring** (UptimeRobot, StatusCake)
4. **Enable backups** for database
5. **Test all features** including tag sharing
6. **Update documentation** with production URLs

---

## 🆘 Support & Troubleshooting

### Get Container Logs
```bash
# Docker
docker logs quickpoll-api

# Azure
az webapp log download --name quickpoll-api --resource-group quickpoll-rg

# Render
# Use dashboard web interface
```

### Database Migration Issues
```bash
# Check current migration version
alembic current

# Revert one migration
alembic downgrade -1

# Apply all migrations
alembic upgrade head
```

### Reset Database (DESTRUCTIVE)
```bash
# Docker
docker-compose down -v
docker-compose up -d db
docker-compose exec backend alembic upgrade head
```

---

## ✅ Deployment Success Criteria

- [ ] Backend API responds at `/health`
- [ ] Frontend loads without errors
- [ ] Users can register/login
- [ ] Polls can be created with tags
- [ ] Tags display as visual chips
- [ ] Share URLs work with tags
- [ ] Search by tags works
- [ ] Real-time updates work
- [ ] Notifications work
- [ ] OAuth login works (if enabled)
- [ ] All CRUD operations functional

---

**Current Version:** v64 (Interactive Tag Input with Visual Chips)

**Last Updated:** Ready for deployment with full tag sharing support across all platforms.
