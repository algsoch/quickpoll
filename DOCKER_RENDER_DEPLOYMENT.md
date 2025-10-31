# Deploy QuickPoll on Render with Docker Images

## ✅ Docker Images Ready!

Your Docker images are built and pushed to Docker Hub:

- **Backend**: `algsoch/quickpoll-backend:latest`
- **Frontend**: `algsoch/quickpoll-frontend:latest`

## 🚀 Deploy to Render - 3 Easy Steps

### Option 1: Blueprint Deployment (Recommended - Automatic!)

1. **Go to Render**: https://render.com
2. **Sign up/Login** with GitHub
3. **Create Blueprint**:
   - Click "New +" → "Blueprint"
   - Select repository: `algsoch/quickpoll`
   - Render detects `render.yaml`
   - Click "Apply" or "Create Services"
   - ✨ Done! Both services deploy automatically

### Option 2: Manual Docker Deployment

#### Deploy Backend:

1. **New Web Service**:
   - Click "New +" → "Web Service"
   - Choose "Deploy from Docker registry"
   - Image URL: `docker.io/algsoch/quickpoll-backend:latest`
   
2. **Configure**:
   - Name: `quickpoll-api`
   - Region: Oregon (or your choice)
   - Plan: Free
   - Health Check Path: `/health`

3. **Environment Variables**:
   ```
   DATABASE_URL=postgresql+asyncpg://vickypoll:Iit7065@vickykumar.postgres.database.azure.com:5432/postgres?ssl=require
   GEMINI_API_KEY=AIzaSyDLvgK7RnT6do4sdgJ8-fqcBPxpBxJSqyc
   SECRET_KEY=(click "Generate" button)
   ALGORITHM=HS256
   ENVIRONMENT=production
   PORT=10000
   ```

4. **Create Service** → Wait for deployment (~2-3 min)

#### Deploy Frontend:

1. **New Web Service**:
   - Click "New +" → "Web Service"
   - Choose "Deploy from Docker registry"
   - Image URL: `docker.io/algsoch/quickpoll-frontend:latest`
   
2. **Configure**:
   - Name: `quickpoll-frontend`
   - Region: Oregon
   - Plan: Free
   - Port: 80 (Nginx default)

3. **Create Service** → Wait for deployment (~1-2 min)

## 🔧 Post-Deployment Configuration

After both services are deployed, you'll get URLs like:
- Backend: `https://quickpoll-api.onrender.com`
- Frontend: `https://quickpoll-frontend.onrender.com`

### Update Backend CORS:

1. Go to backend service on Render
2. Environment tab
3. Add/Update `ALLOWED_ORIGINS`:
   ```
   https://quickpoll-frontend.onrender.com
   ```
4. Save (auto-redeploys)

### Update Frontend API URL:

Edit `frontend/app.js` line 5:
```javascript
: 'https://quickpoll-api.onrender.com';  // Your actual backend URL
```

Then push to GitHub:
```bash
git add frontend/app.js
git commit -m "Update API URL for Render"
git push origin main
```

Render will auto-rebuild the Docker image and redeploy!

## 📦 Your Docker Images

Both images are on Docker Hub and can be used anywhere:

### Backend Image: `algsoch/quickpoll-backend:latest`
- Based on: Python 3.11-slim
- Includes: FastAPI + Gunicorn + Uvicorn workers
- Port: Uses $PORT from environment (10000 on Render)
- Health Check: /health endpoint
- Database: Azure PostgreSQL

### Frontend Image: `algsoch/quickpoll-frontend:latest`
- Based on: Nginx Alpine
- Includes: HTML, CSS, JS (v64 with tag system)
- Port: 80
- Nginx configuration included
- Optimized with caching and compression

## 🔄 Update Images

### Update Backend:

```bash
# 1. Make code changes
# 2. Rebuild image
docker build -f Dockerfile.backend -t algsoch/quickpoll-backend:latest --target production .

# 3. Push to Docker Hub
docker push algsoch/quickpoll-backend:latest

# 4. Redeploy on Render
# Go to Render Dashboard → quickpoll-api → Manual Deploy → Deploy latest image
```

### Update Frontend:

```bash
# 1. Make code changes in frontend/
# 2. Rebuild image
docker build -f Dockerfile.frontend -t algsoch/quickpoll-frontend:latest .

# 3. Push to Docker Hub
docker push algsoch/quickpoll-frontend:latest

# 4. Redeploy on Render
# Go to Render Dashboard → quickpoll-frontend → Manual Deploy → Deploy latest image
```

## 🧪 Test Deployment

1. **Health Check**: https://quickpoll-api.onrender.com/health
2. **API Docs**: https://quickpoll-api.onrender.com/docs
3. **Frontend**: https://quickpoll-frontend.onrender.com
4. **Create Poll**: Register → Create poll with tags → Share
5. **Verify**: Tags work in shared URLs!

## 💡 Advantages of Docker Deployment

✅ **Consistent Environment**: Same image runs everywhere
✅ **Fast Deployments**: Just pull and run
✅ **Easy Rollbacks**: Keep old image versions
✅ **Portable**: Use same images on any platform
✅ **No Build Time**: Images pre-built, just deploy

## ⚠️ Free Tier Notes

- Services spin down after 15min inactivity
- First request after sleep: ~30-60 seconds
- Keep-alive: Use UptimeRobot to ping every 14min
- Bandwidth: 100GB/month

## 🎉 That's It!

Your QuickPoll app is now deployed with Docker images on Render:

✅ Backend Docker image: FastAPI + PostgreSQL
✅ Frontend Docker image: Nginx + Static files
✅ Tag system with share feature
✅ Auto-deployments from Docker Hub
✅ Free SSL certificates

**Your Apps:**
- Backend: https://quickpoll-api.onrender.com
- Frontend: https://quickpoll-frontend.onrender.com

Start creating polls! 🚀
