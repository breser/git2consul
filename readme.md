#### git2consul 

gi2consul takes one or many git repositories and mirrors them into [Consul](http://www.consul.io/) KVs.  The goal is for organizations of any size to use git as the backing store, audit trail, and access control mechanism for configuration changes and Consul as the delivery mechanism.

##### Configuration

git2consul expects to be run on the same node as a Consul agent.  git2consul expects its own configuration to be stored as a JSON object in '/git2consul/config' in your Consul KV.  The utility `utils/config_seeder.js` will take a JSON file and place it in the correct location for you.

###### Configuration Format

    {
      "version": "1.0",
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

The above example illustrates a 2 repo git2consul setup, where one repo lives in an on-premises git solution and the other is hosted at github.  The hooks arrays under each repository defines how git2consul will be notified of changes.  git2consul supports [Atlassian Stash](https://confluence.atlassian.com/display/STASH/POST+service+webhook+for+Stash) and [GitHub](https://developer.github.com/v3/repos/hooks/) webhooks as well as a basic polling model.

###### How it works

git2consul uses the name and branches of configured repos to namespace the created KVs.  The goal is to allow multiple teams to use the same Consul agents and KV store to migrate configuration data around a network without needing to worry about data conflicts.  In the above example, a settings file file stored at `foo_service/settings.json` in the `development` branch of the repo `vp_config` would be persisted in Consul as `vp_config/development/foo_service/settings.json`.

If you are using a more [Twelve-Factor](http://12factor.net/) approach, where you wish to configure your applications via environment variables, you would store these settings as files in git whose name is the key and whose body is the value.  For example, we could create the file `foo_service/log_level` with the body `trace` in the `development` branch of the `foo_service` repo and git2consul will create the KV `vp_config/development/foo_service/log_level` with the value `trace`.

As changes are detected in the specified git repos, git2consul determines which files have been added, updated, or deleted and replicates those changes to the KV.  Because only changed branches and files are analyzed, git2consul should be low latency and low impact on hosting systems.

###### Clients

A client system should query Consul for the subset of the KV containing the data relevant to its operation.  To extend the above example, our `foo_service` on the development network might subscribe to the KV root `vp_config/development/foo_service` and emit any changes to disk (via something like [fsconsul](https://github.com/ryanbreen/fsconsul)) or environment variables (via something like [envconsul](https://github.com/hashicorp/envconsul)).

###### Future plans

When Consul 4.0 ships, git2consul will be updated to support the ACL system.  To preserve data integrity, only systems running git2consul should be given write access to the configuration KV store.