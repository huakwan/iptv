.PHONY: install generate build lint playlist-lint validate deploy status check-url

REPO ?= huakwan/iptv
BRANCH ?= main
URL ?= https://huakwan.github.io/iptv/countries/th.m3u

install:
	npm install

generate:
	npm run playlist:generate

build:
	npm run playlist:build

lint:
	npm run lint

playlist-lint:
	npm run playlist:lint

validate:
	npm run playlist:validate

deploy:
	gh workflow run update.yml --repo $(REPO)
	gh run watch --repo $(REPO) --exit-status

status:
	gh run list --repo $(REPO) --limit 5

check-url:
	curl -sS -m 15 -o /dev/null -w '%{http_code}\n' "$(URL)"
