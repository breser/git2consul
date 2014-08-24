#### git2consul 

git2consul takes one or many git repositories and mirrors them into [Consul](http://www.consul.io/) KVs.  The goal is for organizations of any size to use git as the backing store, audit trail, and access control mechanism for configuration changes and Consul as the delivery mechanism.

##### Installation

`npm install git2consul`

##### Requirements / Caveats

* git2consul does most of its Git work by shelling out to git.  Git must be installed and on your path.
* git2consul does the rest of its work by calling Consul's REST API.  A Consul agent must be running on localhost.
* git2consul has only been tested on Unix.

##### Configuration

git2consul expects to be run on the same node as a Consul agent.  git2consul expects its own configuration to be stored as a JSON object in '/git2consul/config' in your Consul KV.  The utility `utils/config_seeder.js` will take a JSON file and place it in the correct location for you.

###### Configuration Format

    {
      "version": "1.0",
      "logging" : [{
        "transport" : "Logstash",
        "config" : {
          "port" : "5140",
          "host": "ryans-mbp.ryanbreen.com",
          "meta": {
            "source": "git2consul"
          },
          "level": "verbose"
        }
      },{
        "transport" : "Console",
        "config" : {
          "colorize": true,
          "level": "debug"
        }
      }],
      "repos" : [{
        "name" : "vp_config",
        "local_store": "/tmp/git_cache",
        "url" : "ssh://stash.vistaprint.net/team_configuration_data.git",
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
        "local_store": "/tmp/git_cache",
        "url" : "git@github.com:ryanbreen/git2consul_data.git",
        "branches" : [ "master" ],
        "hooks": [{
          "type" : "github",
          "port" : "5151",
          "url" : "/gitpoke"
        }]
      }]
    }

The above example illustrates a 2 repo git2consul setup: one repo lives in an on-premises Git solution and the other is hosted at github.  The hooks array under each repository defines how git2consul will be notified of changes.  git2consul supports [Atlassian Stash](https://confluence.atlassian.com/display/STASH/POST+service+webhook+for+Stash) and [GitHub](https://developer.github.com/v3/repos/hooks/) webhooks as well as a basic polling model.

The above example also logs to the console as well as to [Logstash](http://logstash.net/).  Logging is handled via [Winston](https://github.com/flatiron/winston), and any value for the `transport` field can be used as long as `require('winston').transports[transport]` is not `undefined`.  The `config` element of a logging transport is passed to the constructor of that transport, so you should have full control in setting up all supported Winston transports.

##### How it works

git2consul uses the name and branches of configured repos to namespace the created KVs.  The goal is to allow multiple teams to use the same Consul agents and KV store to migrate configuration data around a network without needing to worry about data conflicts.  In the above example, a settings file stored at `foo_service/settings.json` in the `development` branch of the repo `vp_config` would be persisted in Consul as `vp_config/development/foo_service/settings.json`.

If you are using a more [Twelve-Factor](http://12factor.net/) approach, where you wish to configure your applications via environment variables, you would store these settings as files in Git whose name is the key and whose body is the value.  For example, we could create the file `foo_service/log_level` with the body `trace` in the `development` branch of the `foo_service` repo and git2consul will create the KV `vp_config/development/foo_service/log_level` with the value `trace`.

As changes are detected in the specified Git repos, git2consul determines which files have been added, updated, or deleted and replicates those changes to the KV.  Because only changed branches and files are analyzed, git2consul should have a very slim profile on hosting systems.

##### Clients

A client system should query Consul for the subset of the KV containing the data relevant to its operation.  To extend the above example, our `foo_service` on the development network might subscribe to the KV root `vp_config/development/foo_service` and emit any changes to disk (via something like [fsconsul](https://github.com/ryanbreen/fsconsul)) or environment variables (via something like [envconsul](https://github.com/hashicorp/envconsul)).

##### Future plans

When Consul 0.4 ships, git2consul will be updated to support the ACL system.  To preserve data integrity, only systems running git2consul should be given write access to the configuration KV store.

##### License

Apache 2.0
