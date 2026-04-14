require "test_helper"

class CvGenerationTest < ActiveSupport::TestCase
  def setup
    @user    = User.create!(email: "cvg@test.com", password: "password123")
    @posting = JobPosting.create!(user: @user, raw_text: "job text")
  end

  test "valid with user and job_posting" do
    assert CvGeneration.new(user: @user, job_posting: @posting).valid?
  end

  test "status defaults to pending" do
    assert_equal "pending", CvGeneration.create!(user: @user, job_posting: @posting).status
  end

  test "tokens_used defaults to 0" do
    assert_equal 0, CvGeneration.create!(user: @user, job_posting: @posting).tokens_used
  end

  test "status must be valid" do
    gen = CvGeneration.new(user: @user, job_posting: @posting, status: "bad")
    assert_not gen.valid?
  end
end
