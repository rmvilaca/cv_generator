require "test_helper"

class JobAnalysisServiceTest < ActiveSupport::TestCase
  MOCK_ANALYSIS = {
    "company_name" => "Acme Corp",
    "job_title"    => "Senior Rails Engineer",
    "skills" => [
      { "Ruby on Rails" => [ "5+ years experience", "API design" ] },
      { "PostgreSQL"    => [ "Query optimisation" ] },
      { "Docker"        => [ "Containerisation" ] },
      { "Redis"         => [ "Caching strategies" ] },
      { "Git"           => [ "Version control" ] }
    ],
    "job" => [
      { "Backend Development" => [ "REST APIs" ] },
      { "Team Leadership"     => [ "Mentoring" ] },
      { "System Design"       => [ "Microservices" ] },
      { "Testing"             => [ "TDD, RSpec" ] },
      { "CI/CD"               => [ "GitHub Actions" ] }
    ],
    "tech" => [
      { "Rails 8"        => [ "Latest features" ] },
      { "React"          => [ "Frontend integration" ] },
      { "AWS"            => [ "Cloud deployment" ] },
      { "Sidekiq"        => [ "Background jobs" ] },
      { "Elasticsearch"  => [ "Full-text search" ] }
    ]
  }.freeze

  MOCK_RESPONSE = {
    "choices" => [ { "message" => { "content" => JSON.generate(MOCK_ANALYSIS) } } ]
  }.freeze

  test "returns parsed analysis from OpenAI" do
    stub_client = ->(_access_token:) {
      Object.new.tap { |c| c.define_singleton_method(:chat) { |**_| MOCK_RESPONSE } }
    }

    OpenAI::Client.stub(:new, stub_client) do
      result = JobAnalysisService.new("We are hiring a Rails engineer...").call
      assert_equal "Acme Corp",             result["company_name"]
      assert_equal "Senior Rails Engineer", result["job_title"]
      assert_equal 5, result["skills"].length
      assert_equal 5, result["job"].length
      assert_equal 5, result["tech"].length
    end
  end

  test "raises Error on OpenAI failure" do
    stub_client = ->(_access_token:) {
      Object.new.tap { |c| c.define_singleton_method(:chat) { |**_| raise OpenAI::Error, "rate limited" } }
    }

    OpenAI::Client.stub(:new, stub_client) do
      assert_raises(JobAnalysisService::Error) do
        JobAnalysisService.new("job text").call
      end
    end
  end
end
