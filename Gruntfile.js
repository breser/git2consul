module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    debian_package: {
      default_options: {
        options: {
          maintainer: {
            "name": "Ryan Breen",
            "email": "rbreen@cimpress.com"
          },
          short_description: "Mirrors the contents of a git repository into Consul KVs.",
          long_description: "git2consul takes one or many git repositories and mirrors them" +
          " into Consul KVs. The goal is for organizations of any size to use git as the backing store," +
          " audit trail, and access control mechanism for configuration changes and Consul as the delivery mechanism.",
          target_architecture: "all",
          category: "misc",
          custom_template: "custom_template/",
          preinst: {
            src: 'debian_package/preinst'
          },
          postinst: {
            src: 'debian_package/postinst'
          },
          dependencies: "nodejs, git"
        },
        files: [
          {
            expand: true,
            src: [
              'lib/**',
              'utils/**',
              'node_modules/**'
            ],
            dest: '/usr/share/git2consul/'
          },
          {
            src: 'debian_package/git2consul.service',
            dest: '/usr/lib/systemd/system/'
          },
          {
            src: 'debian_package/default_config.json',
            dest: '/etc/git2consul/config.json'
          }
        ]
      }
    }
  });
  grunt.loadNpmTasks('grunt-debian-package');
};