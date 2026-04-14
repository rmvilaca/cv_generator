require "test_helper"

class JobAnalysisJobTest < ActiveSupport::TestCase
  def setup
    @user    = User.create!(email: "jaj@test.com", password: "password123")
    @posting = JobPosting.create!(user: @user, raw_text: "Hiring Rails dev at Acme Corp")
  end

  test "marks posting completed with analysis on success" do
    analysis = {
      "company_name" => "Acme Corp", "job_title" => "Rails Dev",
      "skills" => [], "job" => [], "tech" => []
    }
    stub_service = ->(_text) { Object.new.tap { |s| s.define_singleton_method(:call) { analysis } } }

    JobAnalysisService.stub(:new, stub_service) do
      JobAnalysisJob.new.perform(@posting.id)
    end

    @posting.reload
    assert_equal "completed",  @posting.analysis_status
    assert_equal "Acme Corp",  @posting.company_name
    assert_equal "Rails Dev",  @posting.job_title
    assert_equal "Acme Corp",  @posting.analysis["company_name"]
  end

  test "marks posting failed on service error" do
    stub_service = ->(_text) {
      Object.new.tap { |s|
        s.define_singleton_method(:call) { raise JobAnalysisService::Error, "API error" }
      }
    }

    JobAnalysisService.stub(:new, stub_service) do
      JobAnalysisJob.new.perform(@posting.id)
    end

    assert_equal "failed", @posting.reload.analysis_status
  end
end
