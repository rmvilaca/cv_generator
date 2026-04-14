require "test_helper"

class Api::CvGenerationsControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user    = User.create!(email: "cvctrl@test.com", password: "password123")
    UserProfile.create!(user: @user, full_name: "Jane Doe")
    @headers = auth_headers_for(@user)
    @posting = JobPosting.create!(
      user: @user, raw_text: "Rails job",
      analysis: { "company_name" => "Acme", "job_title" => "Dev",
                  "skills" => [], "job" => [], "tech" => [] },
      analysis_status: "completed"
    )
    ActiveJob::Base.queue_adapter = :test
  end

  test "POST uses free tier when under limit" do
    assert_equal 0, @user.free_generations_used

    assert_enqueued_with(job: CvGenerationJob) do
      post "/api/job_postings/#{@posting.id}/cv_generations",
           headers: @headers, as: :json
    end

    assert_response :created
    data = JSON.parse(response.body)
    assert_equal "pending", data["status"]
    assert_equal 0,         data["tokens_used"]
    assert_equal 1,         @user.reload.free_generations_used
  end

  test "POST deducts token when free tier exhausted" do
    @user.update!(free_generations_used: 3, token_balance: 2)

    assert_enqueued_with(job: CvGenerationJob) do
      post "/api/job_postings/#{@posting.id}/cv_generations",
           headers: @headers, as: :json
    end

    assert_response :created
    assert_equal 1, @user.reload.token_balance
    assert_equal 1, CvGeneration.last.tokens_used
  end

  test "POST returns 402 when no free tier and no tokens" do
    @user.update!(free_generations_used: 3, token_balance: 0)

    post "/api/job_postings/#{@posting.id}/cv_generations",
         headers: @headers, as: :json

    assert_response :payment_required
  end

  test "POST returns 422 when analysis not completed" do
    @posting.update!(analysis_status: "pending")

    post "/api/job_postings/#{@posting.id}/cv_generations",
         headers: @headers, as: :json

    assert_response :unprocessable_entity
  end

  test "GET index returns all generations for posting" do
    gen = CvGeneration.create!(user: @user, job_posting: @posting)
    get "/api/job_postings/#{@posting.id}/cv_generations", headers: @headers
    assert_response :ok
    data = JSON.parse(response.body)
    assert_equal 1, data.length
    assert_equal gen.id, data[0]["id"]
  end

  test "GET show returns a generation" do
    gen = CvGeneration.create!(user: @user, job_posting: @posting,
                               status: "completed", content: { "summary" => "Great dev" })
    get "/api/job_postings/#{@posting.id}/cv_generations/#{gen.id}", headers: @headers
    assert_response :ok
    data = JSON.parse(response.body)
    assert_equal "completed", data["status"]
    assert_equal "Great dev", data["content"]["summary"]
  end

  test "requires authentication" do
    get "/api/job_postings/#{@posting.id}/cv_generations"
    assert_response :unauthorized
  end
end
