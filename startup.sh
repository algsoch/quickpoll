#!/bin/bash
cd /home/site/wwwroot
gunicorn --bind=0.0.0.0:8080 --workers=4 --worker-class=uvicorn.workers.UvicornWorker --timeout=120 backend.main:app
