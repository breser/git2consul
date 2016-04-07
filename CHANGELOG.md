v0.12.11

* Allow git2consul global package installation with `npm install -g git2consul`. [GH-72]

v0.12.10

* Ensure that `config_reader.read()` runs after `config_seeder.set()`. [GH-69]

v0.12.9

* Use `global.token` on `config_reader.js`. [GH-67]

v0.12.8

* Patch bug where `config_seeder.js` and `config_reader.js `were required before variable were set. [GH-66]

v0.12.7

* Fix invalid reference `error` on `index.js` when calling `config_seeder.set()`. [GH-62]

v0.12.6

* Rename --seed-file flag to the more appropriate --config-file. [GH-61]

v0.12.5

* Enforce boolean value on `global.secure`. [GH-60]
* Configuration file can be directly seeded from within git2consul without calling `utils/config_seeder.js`. [GH-59]

v0.12.4

* Flags can be optionally passed as environment variables. [GH-57]

v0.12.3

* Fixes a bug where a repo could stop updating if `source_root` was used, really this time.

v0.12.2

* Fixes a bug where a repo could stop updating if `source_root` was used.

v0.12.1

* The location of git2consul configuration within the Consul KV store can now be adjusted using the `-c` or `--config_key` command line switches.
