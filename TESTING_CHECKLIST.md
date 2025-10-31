# QuickPoll Testing Checklist

## Pre-Testing Setup

### Environment Setup
- [ ] Python 3.11+ installed and verified (`python --version`)
- [ ] Virtual environment created (`python -m venv venv`)
- [ ] Virtual environment activated
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file configured with valid DATABASE_URL
- [ ] Database connection verified

### Database Setup
- [ ] PostgreSQL server running (or using Docker)
- [ ] Database created (or using Azure PostgreSQL)
- [ ] Alembic migrations executed (`alembic upgrade head`)
- [ ] Tables created successfully

## Unit Testing

### Run All Tests
```bash
# Basic test run
pytest

# With verbose output
pytest -v

# With coverage report
pytest --cov=backend --cov-report=html

# Run specific test file
pytest tests/test_users.py
pytest tests/test_polls.py
pytest tests/test_models.py
pytest tests/test_main.py
```

### Expected Results
- [ ] All 26 tests pass
- [ ] No database errors
- [ ] Coverage > 90% (target)
- [ ] No deprecation warnings

### Test Breakdown
- [ ] **User Tests** (6 tests)
  - [ ] User registration
  - [ ] Duplicate username/email handling
  - [ ] User login
  - [ ] Invalid login handling
  - [ ] Get current user
  - [ ] Unauthorized access handling

- [ ] **Poll Tests** (10 tests)
  - [ ] Create poll
  - [ ] List polls
  - [ ] Get poll by ID
  - [ ] Update poll (owner)
  - [ ] Delete poll (owner)
  - [ ] Vote on poll
  - [ ] Prevent duplicate votes
  - [ ] Like poll
  - [ ] Get poll results
  - [ ] Filter active polls

- [ ] **Model Tests** (6 tests)
  - [ ] User model creation
  - [ ] Poll model creation
  - [ ] Poll options relationship
  - [ ] Vote model creation
  - [ ] Like model creation
  - [ ] Cascade deletes

- [ ] **Main Tests** (4 tests)
  - [ ] Health check endpoint
  - [ ] OpenAPI docs
  - [ ] Redoc documentation
  - [ ] Database connection check

## Integration Testing

### Manual API Testing

#### 1. Health Check
```bash
curl http://localhost:8000/health
```
- [ ] Returns status: "healthy"
- [ ] Returns database: "healthy"

#### 2. User Registration
```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test1234"
  }'
```
- [ ] Returns 201 status code
- [ ] Returns user object with ID
- [ ] Password is not in response

#### 3. User Login
```bash
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test1234"
  }'
```
- [ ] Returns 200 status code
- [ ] Returns access_token
- [ ] Token is valid JWT

#### 4. Create Poll (Authenticated)
```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:8000/api/polls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Poll",
    "description": "This is a test poll",
    "options": [
      {"text": "Option A", "order": 0},
      {"text": "Option B", "order": 1}
    ]
  }'
```
- [ ] Returns 201 status code
- [ ] Returns poll object with ID
- [ ] Options are created

#### 5. Vote on Poll
```bash
curl -X POST http://localhost:8000/api/polls/1/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "option_id": 1
  }'
```
- [ ] Returns 201 status code
- [ ] Vote is recorded
- [ ] Second vote fails (409 conflict)

#### 6. Get Poll Results
```bash
curl http://localhost:8000/api/polls/1/results
```
- [ ] Returns results with vote counts
- [ ] Percentages are calculated correctly
- [ ] Total votes match

## Frontend Testing

### Manual UI Testing

#### Setup
- [ ] Open `frontend/index.html` in browser
- [ ] Or access via nginx (Docker): http://localhost:3000

#### User Registration
- [ ] Click "Sign Up" button
- [ ] Fill registration form
- [ ] Submit form
- [ ] Success message appears
- [ ] Modal closes

#### User Login
- [ ] Click "Sign In" button
- [ ] Enter credentials
- [ ] Submit form
- [ ] Token stored in localStorage
- [ ] UI updates to show logged-in state

#### Poll Creation
- [ ] Click "Create Poll" button
- [ ] Fill in title and description
- [ ] Add 2-3 options
- [ ] Submit form
- [ ] New poll appears in list
- [ ] Modal closes

#### Poll Voting
- [ ] Click on a poll
- [ ] Select an option
- [ ] Click "Vote" button
- [ ] Vote confirmation shown
- [ ] Chart updates with new vote
- [ ] Cannot vote again

#### Poll Results
- [ ] View poll results
- [ ] Chart displays correctly
- [ ] Percentages add up to 100%
- [ ] Vote counts are accurate

#### Real-time Updates
- [ ] Open same poll in two browser windows
- [ ] Vote in one window
- [ ] Verify chart updates in both windows
- [ ] WebSocket connection stable

#### Responsive Design
- [ ] Resize browser to mobile size
- [ ] All elements are visible
- [ ] Modals work properly
- [ ] Charts are readable

## Load Testing

### Setup Locust
```bash
pip install locust
```

### Run Load Tests
```bash
locust -f locustfile.py --host=http://localhost:8000
```

#### Load Test Checklist
- [ ] Access Locust UI at http://localhost:8089
- [ ] Set number of users (e.g., 100)
- [ ] Set spawn rate (e.g., 10 users/sec)
- [ ] Start load test
- [ ] Monitor success rate
- [ ] Check response times
- [ ] Verify no errors at normal load

### Expected Performance
- [ ] 95th percentile response time < 200ms
- [ ] Success rate > 99%
- [ ] No database connection errors
- [ ] System handles 100+ concurrent users

## Docker Testing

### Build and Run
```bash
# Build Docker image
docker build -t quickpoll .

# Run with Docker Compose
docker-compose up
```

#### Docker Checklist
- [ ] Docker image builds successfully
- [ ] No build errors or warnings
- [ ] Backend container starts
- [ ] Database container starts
- [ ] Frontend container starts
- [ ] Health check passes
- [ ] All services can communicate

#### Access Points
- [ ] Frontend at http://localhost:3000
- [ ] Backend API at http://localhost:8000
- [ ] API docs at http://localhost:8000/docs
- [ ] Database accessible on port 5432

## Security Testing

### Authentication
- [ ] Access protected endpoints without token → 401
- [ ] Access with invalid token → 401
- [ ] Access with expired token → 401
- [ ] Access with valid token → 200

### Authorization
- [ ] Non-owner cannot edit poll → 403
- [ ] Non-owner cannot delete poll → 403
- [ ] Owner can edit own poll → 200
- [ ] Owner can delete own poll → 204

### Input Validation
- [ ] Invalid email format rejected
- [ ] Weak password rejected
- [ ] Empty poll title rejected
- [ ] Duplicate option text rejected
- [ ] SQL injection attempts blocked

### Rate Limiting
```bash
# Send 100 requests rapidly
for i in {1..100}; do curl http://localhost:8000/api/polls; done
```
- [ ] Rate limit triggered (429 status)
- [ ] Error message returned
- [ ] Service remains stable

## Monitoring and Observability

### Metrics Endpoint
```bash
curl http://localhost:8000/metrics
```
- [ ] Returns Prometheus format
- [ ] Request count metrics present
- [ ] Request duration metrics present
- [ ] All endpoints tracked

### Admin Statistics
```bash
curl http://localhost:8000/admin/stats \
  -u admin:your_admin_password
```
- [ ] Returns user count
- [ ] Returns poll count
- [ ] Returns vote count
- [ ] Returns like count

## Production Readiness

### Configuration
- [ ] SECRET_KEY is strong (32+ chars)
- [ ] DATABASE_URL uses SSL (`sslmode=require`)
- [ ] CORS origins properly configured
- [ ] Admin credentials changed from defaults

### Error Handling
- [ ] Database connection failure handled gracefully
- [ ] Invalid input returns proper error messages
- [ ] 500 errors logged appropriately
- [ ] User-friendly error messages

### Logging
- [ ] Application starts successfully
- [ ] Database connection logged
- [ ] Errors are logged
- [ ] Request logs are clear

## Deployment Testing

### Azure Deployment (if applicable)
- [ ] App Service created
- [ ] Environment variables configured
- [ ] Application deployed
- [ ] Health check passes
- [ ] API accessible
- [ ] Database connected

### Render Deployment (if applicable)
- [ ] Blueprint file validated
- [ ] Services created
- [ ] Environment variables set
- [ ] Deployment successful
- [ ] Application accessible

## Final Checklist

### Code Quality
- [ ] Run `black backend/ tests/` (code formatting)
- [ ] Run `flake8 backend/` (linting)
- [ ] Run `bandit -r backend/` (security scan)
- [ ] All checks pass

### Documentation
- [ ] README.md is complete
- [ ] API.md is accurate
- [ ] QUICKSTART.md is tested
- [ ] All examples work

### Git Repository
- [ ] `.gitignore` excludes sensitive files
- [ ] No `.env` file in repository
- [ ] No `__pycache__` in repository
- [ ] Clean commit history

### Cleanup
- [ ] Remove test data from database
- [ ] Update .env.sample if needed
- [ ] Remove any debug code
- [ ] Check for TODO comments

## Sign-off

Testing completed by: ________________  
Date: ________________  
Environment: ________________  

### Summary
- Total Tests Run: ______
- Tests Passed: ______
- Tests Failed: ______
- Code Coverage: ______%
- Performance: ______

### Issues Found
1. ________________
2. ________________
3. ________________

### Recommendations
1. ________________
2. ________________
3. ________________

---

**Status**: [ ] Ready for Production / [ ] Needs Work  
**Approved by**: ________________  
**Date**: ________________
