require "test_helper"

class UserProfileTest < ActiveSupport::TestCase
  def setup
    @user = User.create!(email: "prof@test.com", password: "password123")
  end

  test "valid with full_name" do
    assert UserProfile.new(user: @user, full_name: "Jane Doe").valid?
  end

  test "invalid without full_name" do
    profile = UserProfile.new(user: @user)
    assert_not profile.valid?
    assert_includes profile.errors[:full_name], "can't be blank"
  end

  test "skills defaults to empty array" do
    profile = UserProfile.create!(user: @user, full_name: "Jane")
    assert_equal [], profile.skills
  end

  test "can have work experiences" do
    profile = UserProfile.create!(user: @user, full_name: "Jane")
    exp = profile.work_experiences.create!(company: "Acme", title: "Engineer", start_date: "Jan 2020")
    assert_equal 1, profile.work_experiences.count
    assert_equal "Acme", exp.company
  end

  test "work_experience bullet_points defaults to empty array" do
    profile = UserProfile.create!(user: @user, full_name: "Jane")
    exp = profile.work_experiences.create!(company: "Acme", title: "Engineer", start_date: "Jan 2020")
    assert_equal [], exp.bullet_points
  end

  test "can have education entries" do
    profile = UserProfile.create!(user: @user, full_name: "Jane")
    edu = profile.education_entries.create!(institution: "MIT", degree: "BSc CS")
    assert_equal 1, profile.education_entries.count
    assert_equal "MIT", edu.institution
  end
end
