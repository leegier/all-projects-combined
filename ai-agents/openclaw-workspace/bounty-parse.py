#!/usr/bin/env python
# parse github bounty search results
import json

def parse_bounties(bounties):
    # todo: implement parsing logic here
    pass

with open('bounties.json', 'r') as f:
    bounties = json.load(f)
for bounty in bounties['items']:
    print(bounty['title'])
