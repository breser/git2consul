#!/bin/bash

set -o pipefail

./node_modules/.bin/_mocha --reporter spec -t 10000 test | bunyan
