# Azure App Service Configuration

# App Settings (set via Azure Portal or CLI)
# az webapp config appsettings set --name <app-name> --resource-group <resource-group> --settings @appsettings.json

# Example appsettings.json structure:
{
  "DATABASE_URL": "postgresql+asyncpg://user:password@host.postgres.database.azure.com:5432/dbname?sslmode=require",
  "SECRET_KEY": "your-production-secret-key-minimum-32-characters-long",
  "ALGORITHM": "HS256",
  "ACCESS_TOKEN_EXPIRE_MINUTES": "30",
  "ENVIRONMENT": "production",
  "ALLOWED_ORIGINS": "https://yourapp.azurestaticapps.net,https://yourdomain.com",
  "HOST": "0.0.0.0",
  "PORT": "8000",
  "ADMIN_USERNAME": "admin",
  "ADMIN_PASSWORD": "secure-admin-password",
  "RATE_LIMIT_PER_MINUTE": "60",
  "WEBSITES_PORT": "8000",
  "WEBSITES_ENABLE_APP_SERVICE_STORAGE": "false",
  "DOCKER_ENABLE_CI": "true"
}

# Startup Command for Azure App Service:
# gunicorn backend.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --access-logfile - --error-logfile -

# Azure CLI Deployment Commands:

# 1. Create Resource Group
# az group create --name quickpoll-rg --location eastus

# 2. Create Azure Container Registry
# az acr create --resource-group quickpoll-rg --name quickpollacr --sku Basic

# 3. Build and push image to ACR
# az acr build --registry quickpollacr --image quickpoll:latest --file Dockerfile .

# 4. Create App Service Plan
# az appservice plan create --name quickpoll-plan --resource-group quickpoll-rg --is-linux --sku B1

# 5. Create Web App
# az webapp create --resource-group quickpoll-rg --plan quickpoll-plan --name quickpoll-api --deployment-container-image-name quickpollacr.azurecr.io/quickpoll:latest

# 6. Configure Web App
# az webapp config appsettings set --name quickpoll-api --resource-group quickpoll-rg --settings @appsettings.json

# 7. Enable HTTPS only
# az webapp update --name quickpoll-api --resource-group quickpoll-rg --https-only true

# 8. Enable Always On
# az webapp config set --name quickpoll-api --resource-group quickpoll-rg --always-on true

# 9. Set container registry credentials
# az webapp config container set --name quickpoll-api --resource-group quickpoll-rg --docker-custom-image-name quickpollacr.azurecr.io/quickpoll:latest --docker-registry-server-url https://quickpollacr.azurecr.io

# For Azure Static Web Apps (Frontend):

# 1. Create Static Web App
# az staticwebapp create --name quickpoll-frontend --resource-group quickpoll-rg --source https://github.com/yourusername/quickpoll --location eastus2 --branch main --app-location "/frontend" --login-with-github

# 2. Configure API backend
# Update staticwebapp.config.json to point to your backend API
