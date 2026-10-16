import json
from github_search_bounties import search

def parse_bounty(bounty):
    # TO DO: implement bounty parsing logic here
    pass

def main():
    query = 'repo:anthropic/anthropos repo:modelcontextprotocol/model-context-protocol repo:claude-dev/claude-dev is:open is:issue is:pr is:pull request' 
    results = search(query)
    with open('bounty-log.md', 'a') as f:
        for result in results['items']:
            bounty = result
            parse_bounty(bounty)
            f.write(f"* {result['title']} - {result['url']}
")
if __name__ == '__main__':
    main()
