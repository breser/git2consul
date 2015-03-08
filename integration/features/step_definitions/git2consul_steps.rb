require 'git'
require 'net/http'
require 'open3'
require 'rspec'
require 'uri'

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
  #system("git add #{file}")
  @git.add file
  @git.commit message
  #system("git commit -m \"#{message}\"")
end

def configure_git2consul(server, body)
  req = Net::HTTP::Put.new('/v1/kv/git2consul/config', initheader = { 'Content-Type' => 'application/json'})
  req.body = body
  response = Net::HTTP.new(server, 8500).start {|http| http.request(req) }
end

Given /The git integration repo is initialized/ do
  FileUtils.rm_rf 'integration_test_repo'
  Dir.mkdir 'integration_test_repo'
  Dir.chdir 'integration_test_repo' do
    #system("git init")
    @git = Git.init
    http = Net::HTTP.new("consulserver1", 8500)
    # Make sure to purge any existing git2consul results from the KV
    http.request(Net::HTTP::Delete.new("/v1/kv/integration?recurse")).code
    commit_file("readme.md", "stubby", "stub commit to master")
    ['dev','test','prod'].each { |env|
      #system("git checkout -b #{env}")
      @git.branch(env).checkout
      commit_file("readme.md", "#{env} readme", "Initial commit to #{env}")
      #system("git checkout master")
      @git.checkout 'master'
    }
  end
end

Given /The (.*) box is online/ do |server|
  Dir.chdir '../' do
    system("vagrant up #{server}")
    system("vagrant provision #{server}") if ENV.has_key? 'VAGRANT_REPROVISION'

    # Stop a running git2consul process and delete the existing cache dir
    run_command("vagrant ssh -c \"sudo service git2consul stop ; sudo rm -rf /tmp/git_cache\" #{server}")
  end
end

Then /The (.*) box has a git2consul config/ do |server|
  configure_git2consul(server, File.open("config.json", "rb").read)
end

Then /The (.*) box is running git2consul/ do |box_name|
  Dir.chdir '../' do
    run_command("vagrant ssh -c \"sudo service git2consul start\" #{box_name}")
    sleep 1
    out = run_command("vagrant ssh -c \"service git2consul status\" #{box_name}")
    expect(out).to include("running")
  end
end

Then /The (.*) box has 2 known peers/ do |server|
  Dir.chdir '../' do
    out = run_command("vagrant ssh -c \"consul info\" #{server}")
    expect(out).to include("num_peers = 2")
  end
end

git2consul_processes = {}

Given /We know git2consul service status for (.*)$/ do |box_name|
  Dir.chdir '../' do
    git2consul_processes[box_name] = run_command("vagrant ssh -c \"service git2consul status\" #{box_name}").strip
  end
end

Given /A configuration change to git2consul/ do
  configure_git2consul('consulserver1', File.open("config.json", "rb").read.gsub(/frob/, 'frobbed'))
  # Give the change time to propagate
  sleep 1
end

Then /The (.*) box should restart the git2consul service/ do |box_name|  
  Dir.chdir '../' do
    out = run_command("vagrant ssh -c \"service git2consul status\" #{box_name}").strip
    expect(out).not_to eq(git2consul_processes[box_name])
  end
end
