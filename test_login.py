import requests
import json

# Test login
url = "https://quickpoll-api-xgc3.onrender.com/api/users/login"
data = {
    "username": "algsoch1",
    "password": "Iit7065@"
}

print(f"Testing login for user: {data['username']}")
print(f"URL: {url}")
print(f"Data: {json.dumps(data, indent=2)}")
print("\n" + "="*60 + "\n")

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    if response.ok:
        print("\n✅ LOGIN SUCCESSFUL!")
        token = response.json().get('access_token')
        print(f"Token: {token[:50]}...")
    else:
        print(f"\n❌ LOGIN FAILED!")
except Exception as e:
    print(f"❌ ERROR: {e}")
