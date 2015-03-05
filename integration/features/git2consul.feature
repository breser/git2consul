@git2consul

Feature: Ensure that proper infrastructure for the tests is setup
  Vagrant server boxes should be properly spun up and running

  Scenario: Consul cluster is running
    Then The /consulserver[1-3]{1}/ box is running
