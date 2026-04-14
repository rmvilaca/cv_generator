require "test_helper"

class JobPostingTest < ActiveSupport::TestCase
  def setup
    @user = User.create!(email: "jp@test.com", password: "password123")
  end

  test "valid with raw_text" do
    assert JobPosting.new(user: @user, raw_text: "We are hiring a Rails engineer...").valid?
  end

  test "invalid without raw_text" do
    posting = JobPosting.new(user: @user)
    assert_not posting.valid?
    assert_includes posting.errors[:raw_text], "can't be blank"
  end

  test "analysis_status defaults to pending" do
    posting = JobPosting.create!(user: @user, raw_text: "job text")
    assert_equal "pending", posting.analysis_status
  end

  test "analysis_status must be valid" do
    posting = JobPosting.new(user: @user, raw_text: "job text", analysis_status: "bad_status")
    assert_not posting.valid?
  end

  test "analysis defaults to nil" do
    posting = JobPosting.create!(user: @user, raw_text: "job text")
    assert_nil posting.analysis
  end
end
