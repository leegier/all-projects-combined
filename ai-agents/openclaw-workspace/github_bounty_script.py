import json
from requests import get

def extract_bounties(response):
    bounties = response['items']
    for bounty in bounties:
        print(f'{bounty['title']} - {bounty['url']}')

def main():
    url = 'https://api.github.com/search/issues'
    params = {'q': 'repo:anthropic/claude-dev', 'state': 'open'}
    response = get(url, params=params).json()
    extract_bounties(response)

if __name__ == '__main__':
    main()