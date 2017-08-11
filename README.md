# git2consul

[![Build Status](https://travis-ci.org/breser/git2consul.svg?branch=master)](https://travis-ci.org/breser/git2consul)
[![Coverage Status](https://img.shields.io/coveralls/breser/git2consul.svg)](https://coveralls.io/r/breser/git2consul?branch=master)

[![Join the chat at https://gitter.im/Cimpress-MCP/git2consul](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/Cimpress-MCP/git2consul?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Google Groups](https://img.shields.io/badge/google--group-git2consul-green.svg)](https://groups.google.com/group/git2consul-tool/)

git2consul takes one or many git repositories and mirrors them into [Consul](http://www.consul.io/) KVs.  The goal is for organizations of any size to use git as the backing store, audit trail, and access control mechanism for configuration changes and Consul as the delivery mechanism.

#### Installation

`npm install -g git2consul`

#### Docker

The docker image for git2consul is available at [Cimpress-MCP/docker-git2consul](https://github.com/Cimpress-MCP/docker-git2consul)

#### Requirements / Caveats

* git2consul does most of its Git work by shelling out to git.  Git must be installed and on your path.
* git2consul prefers ssh://... git URIs for authenticating to sensitive repos. http://... is accepted for publicly readable repos.
* git2consul does the rest of its work by calling Consul's REST API.
* git2consul requires write access to the KV store of its Consul agent.
* git2consul has only been tested on Unix.

#### Quick Start Guide

Let's start off with a simple example to show you how it works.  You can use this as a starting point and then tailor it to your use-case.

I've created a [simple repo with a few sample configuration files of different types](https://github.com/ryanbreen/git2consul_data/tree/dev).  Of course, I could have used thousands of files with arbitrarily nested directories, but this is a quick start guide.

The most minimalistic viable git2consul configuration mirrors a single git repo into the KV store with a given prefix.  Here's how that would look mirroring the dev branch at `https://github.com/ryanbreen/git2consul_data.git` into the Consul K/V store with prefix `sample_configuration`:



```bash
cat <<EOF > /tmp/git2consul.json
{
  "version": "1.0",
  "repos" : [{
    "name" : "sample_configuration",
    "url" : "https://github.com/ryanbreen/git2consul_data.git",
    "branches" : ["dev"],
    "hooks": [{
      "type" : "polling",
      "interval" : "1"
    }]
  }]
}
EOF
```

Start git2consul:

```
git2consul --config-file /tmp/git2consul.json
```

or for remote Consul endpoint:

```
git2consul --endpoint remote.consul.host --port 80 --config-file /tmp/git2consul.json
```

git2consul will now poll the "dev" branch of the "git2consul_data.git" repo once per minute.  On first run, it will mirror the 3 files into your Consul K/V with keys:

```
/sample_configuration/dev/sample.conf
/sample_configuration/dev/sample.json
/sample_configuration/dev/sample.yaml
```

The Values of those Keys are the contents of the respective files.  Changing the contents of that git branch will change the corresponding KVs within 1 minute.

Once you are happy with your configuration, you can run git2consul as a daemon either in a `screen` session or via an init script of whatever type is appropriate on your platform.

#### Configuration

git2consul expects to be run on the same node as a Consul agent.  git2consul expects its own configuration to be stored as a JSON object in '/git2consul/config' in your Consul KV.  The utility `utils/config_seeder.js` will take a JSON file and set `/git2consul/config` to contain its contents.

##### Configuration Format

```javascript
{
  "version": "1.0",
  "local_store": "/var/lib/git2consul_cache",
  "logger" : {
    "name" : "git2consul",
    "streams" : [{
      "level": "trace",
      "stream": "process.stdout"
    },
    {
      "level": "debug",
      "type": "rotating-file",
      "path": "/var/log/git2consul/git2consul.log"
    }]
  },
  "repos" : [{
    "name" : "vp_config",
    "url" : "ssh://stash.mydomain.com/team_configuration_data.git",
    "include_branch_name" : false,
    "source_root": "path/in/git/repo",
    "mountpoint": "nested/root/for/keys",
    "branches" : ["development", "staging", "production"],
    "hooks": [{
      "type" : "stash",
      "port" : "5050",
      "url" : "/gitpoke"
    },
    {
      "type" : "polling",
      "interval" : "1"
    }]
  },{
    "name" : "github_data",
    "expand_keys" : true,
    "url" : "git@github.com:ryanbreen/git2consul_data.git",
    "branches" : [ "master" ],
    "hooks": [{
      "type" : "github",
      "port" : "5151",
      "url" : "/gitpoke"
    }]
  }]
}
```

The above example illustrates a 2 repo git2consul setup: one repo lives in an on-premises Git solution and the other is hosted at Github.  The hooks array under each repository defines how git2consul will be notified of changes.  git2consul supports [Atlassian Stash](https://confluence.atlassian.com/display/STASH/POST+service+webhook+for+Stash), [Atlassian Bitbucket](https://confluence.atlassian.com/display/BITBUCKET/POST+hook+management), [GitHub](https://developer.github.com/v3/repos/hooks/), and [Gitlab](https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md) webhooks as well as a basic polling model.

Note that multiple webhooks can share the same port.  The only constraint is that webhooks for different repos do not share the same port and path.

The above example also logs to stdout as well as to file.  Logging is handled via [Bunyan](https://github.com/trentm/node-bunyan).  The value of the `logger` property is passed to the Bunyan `createLogger()` method, so any configuration supported by vanilla Bunyan will work out of the box in git2consul.

#### How it works

git2consul uses the name and branches of configured repos to namespace the created KVs.  The goal is to allow multiple teams to use the same Consul agents and KV store to migrate configuration data around a network without needing to worry about data conflicts.  In the above example, a settings file stored at `foo_service/settings.json` in the `development` branch of the repo `vp_config` would be persisted in Consul as `vp_config/development/foo_service/settings.json`.

If you are using a more [Twelve-Factor](http://12factor.net/) approach, where you wish to configure your applications via environment variables, you would store these settings as files in Git whose name is the key and whose body is the value.  For example, we could create the file `foo_service/log_level` with the body `trace` in the `development` branch of the `vp_config` repo and git2consul will create the KV `vp_config/development/foo_service/log_level` with the value `trace`.

As changes are detected in the specified Git repos, git2consul determines which files have been added, updated, or deleted and replicates those changes to the KV.  Because only changed branches and files are analyzed, git2consul should have a very slim profile on hosting systems.

#### Environment variables

There are environment variable equivalents for the parameters that git2consul accept

* `CONSUL_ENDPOINT` maps to `-e` or `--endpoint`
* `CONSUL_PORT` maps to `-p` or `--port`
* `CONSUL_SECURE` maps to `-s` or `--secure`
* `TOKEN` maps to `-t` or `--token`


#### Alternative Modes of Operation

##### Alternate Config Locations

By default, git2consul looks for its configuration at the Consul Key `git2consul/config`.  You can override this with a `-c` of `--config-key` command line switch, like so:

```sh
git2consul -c git2consul/alternative_config
```

##### No Daemon

If there are no webhooks or polling watchers configured, git2consul will terminate as soon as all tracked repos and branches have been synced with Consul.  If you would like to force git2consul not to attach any webhooks or polling watchers, you can either pass the command-line switch `-n` or include the field `"no_daemon": true` at the top level of your config JSON.

##### Halt-on-change

If you would like git2consul to shutdown every time its configuration changes, you can enable halt-on-change with the command-line switch `-h` or inclusion of the field `"halt_on_change": true` at the top level of your config JSON.  If this switch is enabled, git2consul will wait for changes in the config (which is itself stored in Consul) and gracefully halt when a change is detected.  It is expected that your git2consul process is configured to run as a service, so restarting git2consul is the responsibility of your service manager.

#### Http maxSockets

Since version [v0.12.0](http://blog.nodejs.org/2015/02/06/node-v0-12-0-stable/) of NodeJs, maxSockets is set to Infinity. This result in a lot of http connections being created
when writing k/v to Consul, especially if you have a lot of branches / tags.

In order to avoid hammering Consul with too many requests, you can specify the maximum amount of sockets that can be created by using the `max_sockets` option.

Example :

```javascript
{
  "version": "1.0",
  "max_sockets": 1,
  "repos": [
   ...
  ],
  ...
}
```

Will allow Node to only maintain one socket at a time.

##### expand_keys

There are a couple of general behaviors in regards to `expand_keys`:

* By default, the entire existing tree of keys represented by the file will be deleted and then rebuilt on any change to the file.

* Setting `"expand_keys_diff": true` will apply a diff between the contents of the file and the existing keys and only add/update/delete the necessary keys.

###### JSON

If you would like git2consul to treat JSON documents in your repo as fully formed subtrees, you can enable expand_keys mode via inclusion of the field `"expand_keys": true` at the top level of the repo's configuration.  If this mode is enabled, git2consul will treat any valid JSON file (that is, any file with extension ".json" that parses to an object) as if it contains a subtree of Consul KVs.  For example, if you have the file `root.json` in repo `expando_keys` with the following contents:

```javascript
{
  'first_level' : {
    'second_level' : {
      'third_level' : {
        'you get the picture' : 'right?'
      }
    }
  }
}
```

git2consul in expand_keys mode will generate the following KV:

```
/expando_keys/root.json/first_level/second_level/third_level/you%20get%20the%20picture
```

The value in that KV pair will be `right?`.

A few notes on how this behaves:

* Any arrays in your JSON file are ignored.  Only objects and primitives are transformed into keys.

* Expanded keys are URI-encoded.  The spaces in "you get the picture" are thus converted into `%20`.

* Any non-JSON files, including files with the extension ".json" that contain invalid JSON, are stored in your KV as if expand_keys mode was not enabled.

###### YAML

Similarly to JSON, git2consul can treat YAML documents in your repo as fully formed subtrees.

```yaml
---
# file: example.yaml or example.yml
first_level:
  second_level:
    third_level:
      my_key: my_value
```

git2consul in expand_keys mode will generate the following KV:

```
/expando_keys/example.yaml/first_level/second_level/third_level/my_key
or
/expando_keys/example.yml/first_level/second_level/third_level/my_key
```

The value in that KV pair will be `my_value`.


###### .properties

Similarly to JSON, git2consul can also treat [Java .properties](http://docs.oracle.com/javase/7/docs/api/java/util/Properties.html#load%28java.io.Reader%29) as a simple k/v format.

This is useful for teams willing to keep using legacy .properties files or don't want to use consul locally.

Additionally, it has support for local variable :

```
bar=bar
foo=${bar}
```

Note:
- the tokens **#** and **!** are parsed as comment tokens.
- the tokens **=**, **whitespace** and **:** are parsed as separator tokens.

Example, if you have a file `simple.properties` :

`bar=foo`

git2consul will generate

```
/expand_keys/simple.properties/bar
```

returning `foo`

You can combine .properties files with the [common_properties option](#common_properties-default-undefined), if you need a way to inject shared/common properties into other files.

#### Options

##### include_branch_name (default: true)

`include_branch_name` is a repo-level option instructing git2consul to use the branch name as part of the key prefix.  Setting this option to false will omit the branch name.

##### mountpoint (default: undefined)

A `mountpoint` is a repo-level option instructing git2consul to prepend a string to the key name.  By default, git2consul creates keys at the root of the KV store with the repo name being a top-level key. By setting a mountpoint, you define a prefix of arbitrary depth that will serve as the root for your key names. When building the key name, git2consul will concatenate mountpoint, repo name, branch name (assuming `include_branch_name` is true), and the path of the file in your git repo.

*Note*: mountpoints can neither begin or end in with the character '/'.  git2consul will reject your repo config if that's the case.

##### source_root (default: undefined)

A `source_root` is a repo-level option instructing git2consul to navigate to a subdirectory in the git repo before mapping files to KVs.  By default, git2consul mirrors the entire repo into Consul KVs.

If you have a repo configured with the source_root `config/for/this/datacenter`, the file `config/for/this/datacenter/web/config.json` would be mapped to the KV as `/web/config.json`.

##### support_tags (default: undefined)

A `support_tags` is a repo-level option instructing git2consul to treat tags as if they were branches. Tags will be dynamically polled by the hook as "branches that don't change".

This is useful if you want to version your property changes. It allows to create this kind of structure in consul :

    sample-config
       v1 -> first version
       v2 -> second version
       v3 -> third version
       master -> master branch aka latest version


usage example :

```javascript
{
  "version": "1.0",
  "repos" : [{
    "name" : "sample_configuration",
    "url" : "https://github.com/ryanbreen/git2consul_data.git",
    "support_tags" : true,
    "branches" : ["dev"],
    "hooks": [{
      "type" : "polling",
      "interval" : "1"
    }]
  }]
}
```

This feature will only work with **annotated tags**. `man git-tag` for more information about annotated tags

##### common_properties (default: undefined)

a `common_properties` is a repo-level option instructing git2consul to inject common/shared properties as variables into other .properties files.
This option is active only if you use the [expand_keys mode with properties](#properties).

Usage example :

```javascript
{
  "version": "1.0",
  "repos" : [{
    "name" : "sample_configuration",
    "url" : "https://github.com/ryanbreen/git2consul_data.git",
    "expand_keys": true,
    "common_properties" : "common.properties",
    "branches" : ["dev"],
    "hooks": [{
      "type" : "polling",
      "interval" : "1"
    }]
  }]
}
```

If you have a file `common.properties` :

`foo=bar`

and `simple.properties` :

`foo=${foo}`

git2consul will generate

```
/expand_keys/simple.properties/foo
```

returning `bar`.

Note :

- If a variable is missing or unset, git2consul will store the file as a flat file without considering it as a k/v format.
- If the path to common_properties is incorrect or corrupted, git2consul will ignore it and won't inject any properties.

##### ignore_repo_name (default: false)

`ignore_repo_name` is a repo-level option that, when set to true the repository name would be omitted from the prefix.

##### ignore_file_extension (default: false)

an `ignore_file_extension` is a repo-level option lets file names be ignored by consul while creating sub folder.

Usage example :

```javascript
{
  "version": "1.0",
  "repos" : [{
    "name" : "sample_configuration",
    "url" : "https://github.com/ryanbreen/git2consul_data.git",
    "ignore_file_extension" : true,
    "branches" : ["dev"],
    "hooks": [{
      "type" : "polling",
      "interval" : "1"
    }]
  }]
}
```

Let say that you have a file called `user-service-dev.properties` in your repo. This file will be saved on consul as `user-service-dev`.


#### Debian packaging

If you don't have grunt `sudo npm install -g grunt-cli`.

git2consul can be packaged in .deb file. Simply run

 ```
 npm install
 grunt debian_package
 ```


This task uses the [grunt-debian-package](https://www.npmjs.com/package/grunt-debian-package) and depends on two debian tools :

```
sudo apt-get install devscripts
sudo apt-get install debhelper
```

- The git2consul files will be installed in `/usr/share/git2consul/`
- a new git2consul user will be created under `/var/lib/git2consul`
- A new `git2consul.service` will be installed in `/usr/lib/systemd/system/`
- The config file will be installed in `/etc/git2consul/config.json`

Usage example :

- Update the `/etc/git2consul/config.json` to use your own configuration
- `systemctl restart git2consul` to load the new config
- `systemctl status git2consul` to check that the service is running properly.


The logs are stored in syslog by default, to check the logs just do `journalctl -u git2consul`

The service assumes that consul is running on the machine with the default port(8500).

The generated debian depends on `nodejs` and `git`.

If you want to use a custom configuration you can find the debian config in the `Gruntfile.js` file and the `debian_package` directory.

Tested only on jessie.

#### Clients

A client system should query Consul for the subset of the KV containing the data relevant to its operation.  To extend the above example, our `foo_service` on the development network might subscribe to the KV root `vp_config/development/foo_service` and emit any changes to disk (via something like [fsconsul](https://github.com/ryanbreen/fsconsul)) or environment variables (via something like [envconsul](https://github.com/hashicorp/envconsul)).

#### Tokens

If you are using tokens for ACLs, you can pass a token to git2consul by specifying the `TOKEN` environment variable.  git2consul requires read/write access to your KV.  The purpose of git2consul is to treat git as the single source of truth for KVs, so it typically makes the most sense to give all other users a read-only token to the KV.

#### License

Apache 2.0
