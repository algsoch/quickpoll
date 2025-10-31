# Locust load testing script for QuickPoll
# Run with: locust -f locustfile.py --host=http://localhost:8000

from locust import HttpUser, task, between
import random


class QuickPollUser(HttpUser):
    """Simulate QuickPoll user behavior"""
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    
    def on_start(self):
        """Called when a user starts - register and login"""
        # Register a new user
        username = f"loadtest_user_{random.randint(1, 100000)}"
        self.username = username
        self.password = "LoadTest123"
        
        response = self.client.post("/api/users/register", json={
            "username": username,
            "email": f"{username}@example.com",
            "password": self.password
        })
        
        if response.status_code == 201:
            # Login to get token
            login_response = self.client.post("/api/users/login", json={
                "username": self.username,
                "password": self.password
            })
            
            if login_response.status_code == 200:
                self.token = login_response.json()["access_token"]
                self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def list_polls(self):
        """List all polls - most common action"""
        self.client.get("/api/polls")
    
    @task(2)
    def view_poll(self):
        """View a specific poll"""
        # Get list of polls first
        response = self.client.get("/api/polls")
        if response.status_code == 200:
            polls = response.json()
            if polls:
                poll_id = random.choice(polls)["id"]
                self.client.get(f"/api/polls/{poll_id}", headers=getattr(self, "headers", {}))
    
    @task(1)
    def create_poll(self):
        """Create a new poll"""
        if hasattr(self, "headers"):
            self.client.post("/api/polls", headers=self.headers, json={
                "title": f"Load Test Poll {random.randint(1, 10000)}",
                "description": "This is a load test poll",
                "options": [
                    {"text": "Option A", "order": 0},
                    {"text": "Option B", "order": 1},
                    {"text": "Option C", "order": 2}
                ]
            })
    
    @task(2)
    def vote_on_poll(self):
        """Vote on a poll"""
        if hasattr(self, "headers"):
            # Get list of polls
            response = self.client.get("/api/polls")
            if response.status_code == 200:
                polls = response.json()
                if polls:
                    poll = random.choice(polls)
                    poll_id = poll["id"]
                    
                    # Get poll details to get option IDs
                    detail_response = self.client.get(f"/api/polls/{poll_id}", headers=self.headers)
                    if detail_response.status_code == 200:
                        poll_detail = detail_response.json()
                        if poll_detail.get("options") and not poll_detail.get("user_has_voted"):
                            option_id = random.choice(poll_detail["options"])["id"]
                            self.client.post(
                                f"/api/polls/{poll_id}/vote",
                                headers=self.headers,
                                json={"option_id": option_id}
                            )
    
    @task(1)
    def like_poll(self):
        """Like a poll"""
        if hasattr(self, "headers"):
            response = self.client.get("/api/polls")
            if response.status_code == 200:
                polls = response.json()
                if polls:
                    poll_id = random.choice(polls)["id"]
                    self.client.post(f"/api/polls/{poll_id}/like", headers=self.headers)
    
    @task(1)
    def get_poll_results(self):
        """Get poll results"""
        response = self.client.get("/api/polls")
        if response.status_code == 200:
            polls = response.json()
            if polls:
                poll_id = random.choice(polls)["id"]
                self.client.get(f"/api/polls/{poll_id}/results")
    
    @task(1)
    def health_check(self):
        """Check application health"""
        self.client.get("/health")
