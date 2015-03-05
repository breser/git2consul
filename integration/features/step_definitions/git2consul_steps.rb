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

Given /The (.*) box is running/ do |servers|
  system("vagrant up #{servers} --parallel --provision")
end

Then /The (.*) service is running on (.*) (.*) box/ do |service, box_name, os|
  out = run_command("vagrant ssh -c \"service #{service} status\" #{box_name}")
  expect(out).to include("running")
end

Then /The (.*) server has (.*) known peers/ do |server, num_peers|
  out = run_command("vagrant ssh -c \"consul info\" #{server}")
  expect(out).to include("num_peers = #{num_peers}")
end

Then /The box (.*) \((.*)\) has the file (.*)/ do |server, os, file|
  out = run_command("vagrant ssh -c 'ls #{file}' #{server}")
  expect(out).to include(file)
end