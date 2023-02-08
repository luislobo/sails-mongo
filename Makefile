
MOCHA_OPTS= --check-leaks --timeout 30000
REPORTER = dot

test: test-unit test-integration

test-integration:
	echo 'Running integration tests...'
	@NODE_ENV=test node --trace-warnings test/integration/runner.js

test-unit:
	echo 'Running unit tests...'
	@NODE_ENV=test node --trace-warnings ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--globals "Promise" \
		$(MOCHA_OPTS) \
		test/unit/**

test-load:
	echo 'Running load tests...'
	@NODE_ENV=test node --trace-warnings ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--globals "Promise" \
		$(MOCHA_OPTS) \
		test/load/**
