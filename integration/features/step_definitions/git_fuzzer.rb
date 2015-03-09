require 'git'
require 'net/http'
require 'pathname'
require 'securerandom'

class GitFuzzer

  attr_reader :files
  attr_reader :git

  def initialize()

    @files = Hash.new

    FileUtils.rm_rf 'integration_test_repo'
    Dir.mkdir 'integration_test_repo'
    Dir.chdir 'integration_test_repo' do
      @git = Git.init
      http = Net::HTTP.new("consulserver1", 8500)
      # Make sure to purge any existing git2consul results from the KV
      http.request(Net::HTTP::Delete.new("/v1/kv/integration?recurse")).code
      self.add_file(nil, "readme.md", "stubby")
      @git.commit("stub commit to master")
      ['dev','test','prod'].each { |env|
        @files[env] = Hash.new

        @git.branch(env).checkout
        self.add_file(env, "readme.md", "#{env} readme")
        @git.commit("Initial commit to #{env}")
        @git.checkout 'master'
      }
    end

  end

  def fuzz(num_commits = 20, num_adds = 5, num_mods = 3, num_deletes = 1)

    Dir.chdir 'integration_test_repo' do

      # Make between 1 and num_commits commits.  Note that downto is inclusive, so the fewest
      # commits we'll make is 1 (assuming num_commits is greater than 0)
      rand(1..num_commits).downto(1) { |commit|

        # We want to switch between branches while we are fuzzing, so checkout each environment's
        # branch for each commit
        ['dev','test','prod'].each { |env|
          @git.checkout env

          puts "Creating commit #{commit} in #{env}" if ENV['CUCUMBER_LOGGING']

          env_files = @files[env]

          if env_files.size > 1
            # We don't want to potentially delete more files than are currently saved
            max = [num_deletes, env_files.size].min

            rand(0..max).downto(1) {
              file = env_files.keys[rand(0..env_files.size-1)]
              puts "Deleting file #{file}" if ENV['CUCUMBER_LOGGING']
              env_files.delete file
              self.remove_file file
            }

            # We don't want to potentially modify more files than are currently saved
            max = [num_mods, env_files.size].min
            rand(0..max).downto(1) {
              file = env_files.keys[rand(0..env_files.size-1)]
              puts "Modifying file #{file}" if ENV['CUCUMBER_LOGGING']
              self.add_file(env, file, self.random_string)
            }
          end

          rand(1..num_adds).downto(1) {
            new_path = self.random_path
            puts "Adding file #{new_path}" if ENV['CUCUMBER_LOGGING']
            self.add_file(env, new_path, self.random_string)
          }

          # Now bundle all of those changes into a commit and signal
          @git.commit("Commit #{commit} in branch #{env}")

          # Signal a random git2consul server that there's been an update
          host = "consulserver#{rand(1..3)}"
          hash = @git.object('HEAD').sha
          puts "Signalling for #{host} to update git2consul to #{hash}" if ENV['CUCUMBER_LOGGING']
          req = Net::HTTP::Put.new('/gitpoke', initheader = { 'Content-Type' => 'application/json'})
          req.body = "{ \"refChanges\": [{\"refId\": \"refs/heads/#{env}\", \"toHash\": \"#{hash}\"}] }"
          response = Net::HTTP.new(host).start {|http| http.request(req) }

          @git.checkout 'master'
        }

      }

    end
  end

  def random_string
    SecureRandom.hex 5
  end

  def random_path(max_depth=4)
    path = ""
    rand(1..max_depth).downto(0) {
      path += self.random_string + '/'
    }
    path[0..-2]
  end

  def remove_file(file)
    @git.remove file
  end

  def add_file(env, file, content)
    write_file(file, content)
    @files[env][file] = content unless env == nil
    @git.add file
  end

  def write_file(path, body)
    pn = Pathname.new(path)
    FileUtils.mkdir_p pn.dirname
    File.open(path, 'w') { |file| file.write(body) }
  end

end
