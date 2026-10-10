.PHONY: install generate build lint playlist-lint validate deploy status check-url serve stop

REPO ?= huakwan/iptv
BRANCH ?= main
URL ?= https://huakwan.github.io/iptv/countries/th.m3u
PORT ?= 8080
SERVE_DIR ?= .gh-pages

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

serve:
	@mkdir -p $(SERVE_DIR)/tv
	cp -R web/tv/. $(SERVE_DIR)/tv/
	@perl -0pe 's#<head>#<head>\n    <base href="./tv/" />#; s/__APP_VERSION__/dev/g' web/tv/index.html > $(SERVE_DIR)/index.html
	@echo "Serving http://localhost:$(PORT)/ (Ctrl+C to stop)"
	python3 -m http.server $(PORT) --directory $(SERVE_DIR)

stop:
	@pids=$$(lsof -ti tcp:$(PORT)); \
	if [ -n "$$pids" ]; then kill $$pids && echo "Stopped server on :$(PORT)"; \
	else echo "No server running on :$(PORT)"; fi
