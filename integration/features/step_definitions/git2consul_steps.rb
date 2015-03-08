require 'rspec'
require 'net/http'
require 'uri'
require 'open3'

RSpec.configure {|c| c.fail_fast = true}

def run_command(cmd)
  Open3.popen3(cmd) do |stdin, stdout, stderr, thread|
    stdout.read
  end
end

def write_file(path, body)
  File.open(path, 'w') { |file| file.write(body) }
end

def commit_file(file, content, message)
  write_file(file, content)
  system("git add #{file}")
  system("git commit -a -m \"#{message}\"")
end

Given /The git integration repo is initialized/ do
  FileUtils.rm_rf 'integration_test_repo'
  Dir.mkdir 'integration_test_repo'
  Dir.chdir 'integration_test_repo' do
    system("git init")
    http = Net::HTTP.new("consulserver1", 8500)
    # Make sure to purge any existing git2consul results from the KV
    http.request(Net::HTTP::Delete.new("/v1/kv/integration?recurse")).code
    system("curl http://consulserver1:8500/v1/kv/integration?recurse&pretty=true")
    commit_file("readme.md", "stubby", "stub commit to master")
    ['dev','test','prod'].each { |env|
      system("git checkout -b #{env}")
      commit_file("readme.md", "#{env} readme", "Initial commit to #{env}")
      system("git checkout master")
    }
  end
end

Given /The (.*) box is online/ do |server|
  system("vagrant up #{server}")
  system("vagrant provision #{server}") if ENV.has_key? 'VAGRANT_REPROVISION'

  # Stop a running git2consul process and delete the existing cache dir
  puts run_command("vagrant ssh -c \"sudo service git2consul stop ; sudo rm -rf /tmp/git_cache\" #{server}")
end

Then /The (.*) box has a git2consul config/ do |server|
  req = Net::HTTP::Put.new('/v1/kv/git2consul/config', initheader = { 'Content-Type' => 'application/json'})
  req.body = File.open("config.json", "rb").read
  response = Net::HTTP.new(server, 8500).start {|http| http.request(req) }
end

Then /The (.*) box is running git2consul/ do |box_name|
  run_command("vagrant ssh -c \"sudo service git2consul start\" #{box_name}")
  sleep 1
  out = run_command("vagrant ssh -c \"service git2consul status\" #{box_name}")
  expect(out).to include("running")
end

Then /The (.*) box has 2 known peers/ do |server|
  out = run_command("vagrant ssh -c \"consul info\" #{server}")
  expect(out).to include("num_peers = 2")
end
