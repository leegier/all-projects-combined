import requests
url = 'https://api.gumroad.com/v2/products/12345/templates'
headers = {'Authorization': 'Bearer YOUR_GUMROAD_API_KEY'}
response = requests.post(url, headers=headers, files={'files': open('template_preview.png', 'rb')})
print(response.json())