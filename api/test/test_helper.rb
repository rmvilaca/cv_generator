ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "minitest/mock"

module AuthHelper
  # Signs in the user via the real login endpoint and returns auth headers.
  # All test users should be created with password "password123".
  def auth_headers_for(user)
    post "/api/login",
         params: { user: { email: user.email, password: "password123" } },
         as: :json
    { "Authorization" => response.headers["Authorization"] }
  end
end

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)
    fixtures :all
    include AuthHelper
  end
end

class ActionDispatch::IntegrationTest
  include AuthHelper
end
