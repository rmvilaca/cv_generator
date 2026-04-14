require "test_helper"

class Api::JobPostingsControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user    = User.create!(email: "jpctrl@test.com", password: "password123")
    @headers = auth_headers_for(@user)
    ActiveJob::Base.queue_adapter = :test
  end

  test "POST creates posting and enqueues JobAnalysisJob" do
    assert_enqueued_with(job: JobAnalysisJob) do
      post "/api/job_postings",
           params: { raw_text: "We are hiring a Rails dev", url: "https://jobs.example.com/1" },
           headers: @headers,
           as: :json
    end
    assert_response :created
    data = JSON.parse(response.body)
    assert_equal "pending",                    data["analysis_status"]
    assert_equal "https://jobs.example.com/1", data["url"]
    assert data["id"].present?
  end

  test "POST returns 422 without raw_text" do
    post "/api/job_postings",
         params: { url: "https://example.com" },
         headers: @headers,
         as: :json
    assert_response :unprocessable_entity
  end

  test "GET index returns only current user postings" do
    other = User.create!(email: "other@test.com", password: "password123")
    JobPosting.create!(user: @user,  raw_text: "mine")
    JobPosting.create!(user: other, raw_text: "theirs")

    get "/api/job_postings", headers: @headers
    assert_response :ok
    assert_equal 1, JSON.parse(response.body).length
  end

  test "GET show returns posting" do
    posting = JobPosting.create!(user: @user, raw_text: "some job")
    get "/api/job_postings/#{posting.id}", headers: @headers
    assert_response :ok
    assert_equal posting.id, JSON.parse(response.body)["id"]
  end

  test "GET show returns 404 for another user's posting" do
    other   = User.create!(email: "other2@test.com", password: "password123")
    posting = JobPosting.create!(user: other, raw_text: "not mine")
    get "/api/job_postings/#{posting.id}", headers: @headers
    assert_response :not_found
  end

  test "DELETE destroys posting" do
    posting = JobPosting.create!(user: @user, raw_text: "to delete")
    delete "/api/job_postings/#{posting.id}", headers: @headers
    assert_response :no_content
    assert_nil JobPosting.find_by(id: posting.id)
  end

  test "requires authentication" do
    get "/api/job_postings"
    assert_response :unauthorized
  end
end
