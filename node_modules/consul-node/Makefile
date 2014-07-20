
LIB ?= $(shell find lib -name '*.js')
TEST ?= $(shell find test -name '*.test.js')
REPORTER ?= dot
UI ?= bdd

install: package.json
	@npm install --silent

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--async-only \
		--bail \
		--check-leaks \
		$(TEST)

clean:
	rm -rf node_modules

.PHONY: install test
