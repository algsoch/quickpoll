# Render Deployment Guide - QuickPoll

## 🚀 Quick Deployment Steps

### Step 1: Sign Up / Login to Render
1. Go to https://render.com
2. Sign up with GitHub account (or login if you have an account)
3. Authorize Render to access your GitHub repositories

### Step 2: Deploy Backend (API)

1. **From Render Dashboard**:
   - Click "New +" button → Select "Blueprint"
   - Connect your GitHub repository: `algsoch/quickpoll`
   - Render will automatically detect `render.yaml`
   - Click "Apply" to create all services

2. **Alternative - Manual Deployment**:
   - Click "New +" → "Web Service"
   - Connect repository: `algsoch/quickpoll`
   - Configure:
     - **Name**: quickpoll-api
     - **Region**: Oregon (or closest to you)
     - **Branch**: main
     - **Root Directory**: leave empty
     - **Environment**: Docker
     - **Dockerfile Path**: ./Dockerfile
     - **Docker Build Context**: .
     - **Plan**: Free

3. **Environment Variables** (will be auto-configured from render.yaml):
   ```
   DATABASE_URL=postgresql+asyncpg://vickypoll:Iit7065@vickykumar.postgres.database.azure.com:5432/postgres?ssl=require
   SECRET_KEY=(auto-generated)
   GEMINI_API_KEY=AIzaSyDLvgK7RnT6do4sdgJ8-fqcBPxpBxJSqyc
   ALGORITHM=HS256
   ENVIRONMENT=production
   ALLOWED_ORIGINS=https://quickpoll-frontend.onrender.com
   ```

4. **Click "Create Web Service"** (if manual) or wait for Blueprint deployment

### Step 3: Deploy Frontend (Static Site)

The frontend will be automatically deployed if you used Blueprint. Otherwise:

1. Click "New +" → "Static Site"
2. Connect repository: `algsoch/quickpoll`
3. Configure:
   - **Name**: quickpoll-frontend
   - **Branch**: main
   - **Root Directory**: leave empty
   - **Build Command**: `echo "No build needed"`
   - **Publish Directory**: `frontend`

4. Click "Create Static Site"

### Step 4: Update Frontend API URL

After backend is deployed, you'll get a URL like:
- Backend: `https://quickpoll-api.onrender.com`

Update the ALLOWED_ORIGINS in backend:
1. Go to your backend service on Render
2. Click "Environment"
3. Update `ALLOWED_ORIGINS` to include frontend URL:
   ```
   https://quickpoll-frontend.onrender.com
   ```
4. Save changes (service will auto-redeploy)

### Step 5: Update Frontend to Use Backend URL

The frontend is already configured to auto-detect production, but verify:

**frontend/app.js** (line 3-5):
```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8080' 
    : 'https://quickpoll-api.onrender.com';  // Your Render backend URL
```

If you need to update:
1. Edit `frontend/app.js` line 5
2. Replace with your actual Render backend URL
3. Commit and push:
   ```bash
   git add frontend/app.js
   git commit -m "Update API URL for Render"
   git push origin main
   ```
4. Render will auto-redeploy

## 📋 Post-Deployment Checklist

- [ ] Backend deployed successfully (check https://YOUR-API.onrender.com/health)
- [ ] Frontend deployed successfully
- [ ] Update CORS in backend with frontend URL
- [ ] Update frontend API_BASE_URL if needed
- [ ] Test registration/login
- [ ] Create poll with tags
- [ ] Test share feature
- [ ] Verify tags work in shared URLs

## 🔗 Your URLs

After deployment, your URLs will be:
- **Backend API**: https://quickpoll-api.onrender.com
- **API Docs**: https://quickpoll-api.onrender.com/docs
- **Frontend**: https://quickpoll-frontend.onrender.com

## ⚙️ Render Configuration Details

### Backend (Docker)
- **Environment**: Docker container
- **Dockerfile**: Multi-stage production build
- **Port**: Auto-assigned by Render (via $PORT env var)
- **Workers**: 4 Gunicorn workers with Uvicorn
- **Health Check**: /health endpoint
- **Plan**: Free tier (spins down after 15min inactivity)

### Frontend (Static Site)
- **Type**: Static website
- **Source**: /frontend directory
- **No build process**: Serves HTML/CSS/JS directly
- **Headers**: Security headers configured
- **Plan**: Free tier

### Database
- **Using**: Your existing Azure PostgreSQL database
- **Connection**: SSL required
- **No additional setup needed**

## 🔄 Automatic Deployments

Render automatically deploys when you push to GitHub main branch:
1. Push code to GitHub
2. Render detects changes
3. Rebuilds and redeploys automatically
4. Zero downtime deployments

## ⚠️ Important Notes

### Free Tier Limitations
- **Backend spins down** after 15 minutes of inactivity
- First request after sleep takes ~30-60 seconds to wake up
- **50 GB bandwidth/month**
- **100 build hours/month**

### Wake-up Time
When backend is sleeping:
- First request: ~30-60 seconds (waking up)
- Subsequent requests: Fast (<100ms)

### Keep Backend Awake (Optional)
Use a free service like UptimeRobot to ping your backend every 14 minutes:
- URL to ping: `https://quickpoll-api.onrender.com/health`
- Interval: 14 minutes

## 🐛 Troubleshooting

### Backend 503 Error
- Wait 60 seconds for container to start
- Check Render logs: Dashboard → Service → Logs
- Verify environment variables are set

### Frontend can't connect to backend
1. Check backend is running: `https://quickpoll-api.onrender.com/health`
2. Verify CORS settings in backend
3. Check browser console for errors
4. Verify API_BASE_URL in frontend/app.js

### Database connection error
- Verify DATABASE_URL is correct
- Check Azure PostgreSQL firewall allows Render IPs
- May need to add Render IPs to Azure PostgreSQL allowed IPs

### Tags not working
- Tags should work automatically!
- Share feature uses `window.location.origin`
- No hardcoded URLs needed

## 📊 Monitoring

### View Logs
```bash
# From Render Dashboard
1. Click on your service
2. Click "Logs" tab
3. View real-time logs
```

### Metrics
- Dashboard shows CPU, Memory, Request metrics
- Free tier has basic metrics
- Upgrade to paid plan for advanced metrics

## 💰 Cost (Free Tier)

- **Backend Web Service**: FREE (with limitations)
- **Frontend Static Site**: FREE
- **Database**: Using your existing Azure PostgreSQL
- **Total Cost**: $0/month on Render

## 🔐 Security Recommendations

1. **Regenerate SECRET_KEY** in production:
   - Use Render's "Generate Value" for SECRET_KEY
   - Never commit secret keys to Git

2. **Update ADMIN_PASSWORD**:
   - Set strong admin password in environment variables
   - Don't use default passwords

3. **Enable HTTPS**:
   - Render provides free SSL certificates
   - Automatically configured

4. **CORS Configuration**:
   - Only allow your frontend domain
   - Don't use wildcard "*" in production

## 📚 Next Steps

1. **Custom Domain** (optional):
   - Add custom domain in Render settings
   - Update DNS records
   - Free SSL certificate included

2. **Monitoring**:
   - Set up uptime monitoring (UptimeRobot)
   - Configure email alerts

3. **Backups**:
   - Azure PostgreSQL handles database backups
   - Render has automatic backups for paid plans

4. **Scaling**:
   - Upgrade to paid plan for:
     - No spin-down
     - More resources
     - Custom regions
     - Advanced metrics

## 🎉 That's It!

Your QuickPoll app will be live on Render with:
✅ Docker-based backend with FastAPI
✅ Static frontend
✅ Azure PostgreSQL database
✅ Automatic deployments from GitHub
✅ Free SSL certificates
✅ Tag system with share functionality

Visit your app and start creating polls! 🚀

---

**Support**: If you encounter issues, check Render's documentation or logs first.
**Updates**: Push to GitHub main branch to auto-deploy changes.
