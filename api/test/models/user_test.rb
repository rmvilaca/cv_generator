require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "free_generations_used defaults to 0" do
    user = User.create!(email: "u@test.com", password: "password123")
    assert_equal 0, user.free_generations_used
  end

  test "token_balance defaults to 0" do
    user = User.create!(email: "u2@test.com", password: "password123")
    assert_equal 0, user.token_balance
  end
end
