# -*- mode: ruby -*-
# vi: set ft=ruby :

system("wget -q -O integration/consul.zip https://releases.hashicorp.com/consul/0.5.0/consul_0.5.0_linux_amd64.zip") unless
  File.exists?("integration/consul.zip") || File.exists?("consul.zip")

@script = <<SCRIPT
# Install node and friends.
apt-get update
apt-get install -y build-essential git-core nodejs npm unzip

ln -sf /usr/bin/nodejs /usr/bin/node

# We want to use the local git2consul, not the npm git2consul, so that we can iterate on changes
#npm install --silent -g git2consul
mkdir -p /usr/local/lib/node_modules
ln -sf /vagrant /usr/local/lib/node_modules/git2consul

# Install consul.d config
mkdir -p /etc/consul.d
cat <<EOF >/etc/consul.d/config.json
{
  "bootstrap_expect": 3,
  "server": true,
  "data_dir": "/var/run/consul",
  "bind_addr": "ADDRESS",
  "client_addr": "0.0.0.0"
}
EOF

mkdir -p /var/run/consul

# Install Consul
cp /vagrant/integration/consul.zip /usr/local/bin/
cd /usr/local/bin/
unzip -qo consul.zip

# Create init script for consul
cat <<EOF >/etc/init/consul.conf
# Consul Agent (Upstart unit)
description "Consul Agent"
start on runlevel [2345]
stop on runlevel [!2345]
chdir /usr/local/bin

respawn
respawn limit 10 10
kill timeout 10

script
  export GOMAXPROCS=`nproc`
  exec consul agent -config-dir /etc/consul.d
end script
EOF

# Create init script for git2consul
cat <<EOF >/etc/init/git2consul.conf
# git2consul Agent (Upstart unit)
description "git2consul service"
start on runlevel [2345]
stop on runlevel [!2345]
chdir /usr/local/lib/node_modules

respawn
respawn limit 10 10
kill timeout 10

script
  exec node git2consul
end script
EOF

# Start consul
service consul restart

sleep 1

consul join consulserver1 consulserver2 consulserver3
SCRIPT


required_plugins = %w( vagrant-hostmanager )
required_plugins.each do |plugin|
  system "vagrant plugin install #{plugin}" unless Vagrant.has_plugin? plugin
end

Vagrant.configure(2) do |config|

  config.hostmanager.enabled = true
  config.hostmanager.manage_host = true

  config.vm.provision :hostmanager

  3.downto(1) do |i|
    config.vm.define "consulserver#{i}" do |server|
      server.vm.box = "ubuntu/trusty64"
      server.vm.hostname = "consulserver#{i}"

      server.hostmanager.aliases = "consulserver#{i}.localdomain consulserver#{i}"

      server.vm.network "private_network", ip: "192.168.201.#{1+i}"

      server.vm.provision "shell", inline: @script.gsub(/ADDRESS/, "192.168.201.#{1+i}")
    end
  end
end
