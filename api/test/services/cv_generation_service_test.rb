require "test_helper"

class CvGenerationServiceTest < ActiveSupport::TestCase
  MOCK_CV = {
    "summary"    => "Experienced Rails engineer with 5 years building APIs.",
    "experience" => [
      {
        "company" => "Acme Corp",
        "title"   => "Senior Engineer",
        "period"  => "Jan 2020 – Present",
        "bullets" => [ "Built payment API processing $1M/month" ]
      }
    ],
    "skills"    => { "Languages" => [ "Ruby on Rails", "PostgreSQL" ], "Tools" => [ "Docker" ] },
    "education" => [ { "institution" => "MIT", "degree" => "BSc CS", "year" => "2019" } ]
  }.freeze

  MOCK_RESPONSE = {
    "choices" => [ { "message" => { "content" => JSON.generate(MOCK_CV) } } ]
  }.freeze

  def setup
    @user = User.create!(email: "cvs@test.com", password: "password123")
    @profile = UserProfile.create!(user: @user, full_name: "Jane Doe",
                                   summary: "Rails engineer", skills: [ "Ruby", "Rails" ])
    @profile.work_experiences.create!(company: "Acme Corp", title: "Senior Engineer",
                                      start_date: "Jan 2020", bullet_points: [ "Built APIs" ])
    @profile.education_entries.create!(institution: "MIT", degree: "BSc CS", start_year: "2015", end_year: "2019")
    @posting = JobPosting.create!(
      user: @user, raw_text: "Hiring Rails dev. Must know Ruby, Docker.",
      analysis: {
        "company_name" => "Acme", "job_title" => "Rails Engineer",
        "skills" => [ { "Ruby on Rails" => [ "Expert level" ] } ],
        "job"    => [ { "API Development" => [ "REST APIs" ] } ],
        "tech"   => [ { "Docker" => [ "Containerisation" ] } ]
      },
      analysis_status: "completed"
    )
  end

  test "returns structured CV content from OpenAI" do
    stub_client = ->(access_token:) {
      Object.new.tap { |c| c.define_singleton_method(:chat) { |**_| MOCK_RESPONSE } }
    }

    OpenAI::Client.stub(:new, stub_client) do
      result = CvGenerationService.new(user: @user, job_posting: @posting).call
      assert_equal "Experienced Rails engineer with 5 years building APIs.", result["summary"]
      assert_equal 1, result["experience"].length
      assert_equal [ "Ruby on Rails", "PostgreSQL" ], result["skills"]["Languages"]
      assert_equal [ "Docker" ], result["skills"]["Tools"]
    end
  end

  test "raises Error when analysis not ready" do
    @posting.update!(analysis_status: "pending", analysis: nil)
    assert_raises(CvGenerationService::Error) do
      CvGenerationService.new(user: @user, job_posting: @posting).call
    end
  end

  test "raises Error when user has no profile" do
    user_no_profile = User.create!(email: "noprof@test.com", password: "password123")
    assert_raises(CvGenerationService::Error) do
      CvGenerationService.new(user: user_no_profile, job_posting: @posting).call
    end
  end
end
