#!/bin/bash

set -o pipefail

bin=$(npm bin)
mocha_args='--reporter spec -t 10000 test'

if [ "$1" == "cov" ]; then
  "$bin/istanbul" cover --root . -x node_modules -x test --dir ./reports \
    "$bin/_mocha" -- $mocha_args | bunyan
else
  "$bin/_mocha" $mocha_args | bunyan
fi
