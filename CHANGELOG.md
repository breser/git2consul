v0.12.14 (UNRELEASED)
* Use --config-key as the option flag. --config_key still exists for backwards compatibility [GH-141]
* Only ignore embedded JSON/YAML/properties file extensions [GH-123]

v0.12.13
* `ignore_repo_name` option to ignore repository name as part of the KV path [GH-113]
* Improve logging on ref changes to include repository name. [GH-111]
* `max_sockets` will set the limit on the number of open http sockets. [GH-109]
* `expand_file_diff` will perform updates only on necessary files that contain deltas. [GH-103]

v0.12.12
* Add support for YAML on `expand_keys` [GH-95]
* Fix test fix for `ignore_file_extension` [GH-93]
*  `ignore_file_extension` option added to ignore file extensions on the KV side. [GH-84]
* `support_tags` now have more flexible regex rules. [GH-64]

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
