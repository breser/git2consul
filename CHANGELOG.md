v0.12.5

* Configuration file can be directly seeded from within git2consul without calling untils/config_seeder.js

v0.12.4

* Flags can be optionally passed as environment variables

v0.12.3

* Fixes a bug where a repo could stop updating if `source_root` was used, really this time.

v0.12.2

* Fixes a bug where a repo could stop updating if `source_root` was used.

v0.12.1

* The location of git2consul configuration within the Consul KV store can now be adjusted using the `-c` or `--config_key` command line switches.
