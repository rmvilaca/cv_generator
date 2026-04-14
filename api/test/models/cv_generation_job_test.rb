require "test_helper"

class CvGenerationJobTest < ActiveSupport::TestCase
  def setup
    @user    = User.create!(email: "cvjob@test.com", password: "password123")
    UserProfile.create!(user: @user, full_name: "Jane Doe")
    @posting = JobPosting.create!(
      user: @user, raw_text: "Rails job",
      analysis: { "company_name" => "Acme", "job_title" => "Dev",
                  "skills" => [], "job" => [], "tech" => [] },
      analysis_status: "completed"
    )
    @generation = CvGeneration.create!(user: @user, job_posting: @posting)
  end

  test "marks generation completed with content on success" do
    cv_content = { "summary" => "Great engineer", "experience" => [], "skills" => [], "education" => [] }
    stub_service = ->(**_kwargs) {
      Object.new.tap { |s| s.define_singleton_method(:call) { cv_content } }
    }

    CvGenerationService.stub(:new, stub_service) do
      CvGenerationJob.new.perform(@generation.id)
    end

    @generation.reload
    assert_equal "completed",      @generation.status
    assert_equal "Great engineer", @generation.content["summary"]
  end

  test "marks generation failed on error" do
    stub_service = ->(**_kwargs) {
      Object.new.tap { |s|
        s.define_singleton_method(:call) { raise CvGenerationService::Error, "OpenAI failed" }
      }
    }

    CvGenerationService.stub(:new, stub_service) do
      CvGenerationJob.new.perform(@generation.id)
    end

    assert_equal "failed", @generation.reload.status
  end
end
