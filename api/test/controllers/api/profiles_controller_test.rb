require "test_helper"

class Api::ProfilesControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user    = User.create!(email: "pctrl@test.com", password: "password123")
    @headers = auth_headers_for(@user)
  end

  test "GET /api/profile returns 404 when no profile exists" do
    get "/api/profile", headers: @headers
    assert_response :not_found
  end

  test "PUT /api/profile creates a new profile" do
    put "/api/profile",
        params: {
          full_name: "Jane Doe",
          email:     "jane@example.com",
          phone:     "555-0100",
          location:  "Lisbon",
          summary:   "Senior engineer",
          skills:    [ "Ruby", "Rails" ],
          work_experiences: [
            { company: "Acme", title: "Engineer", start_date: "Jan 2020",
              end_date: nil, bullet_points: [ "Built APIs" ], position: 0 }
          ],
          education_entries: [
            { institution: "MIT", degree: "BSc CS", start_year: "2020", position: 0 }
          ]
        },
        headers: @headers,
        as: :json

    assert_response :ok
    data = JSON.parse(response.body)
    assert_equal "Jane Doe",         data["full_name"]
    assert_equal [ "Ruby", "Rails" ], data["skills"]
    assert_equal 1, data["work_experiences"].length
    assert_equal "Acme", data["work_experiences"][0]["company"]
    assert_equal 1, data["education_entries"].length
  end

  test "GET /api/profile returns existing profile" do
    UserProfile.create!(user: @user, full_name: "Jane")
    get "/api/profile", headers: @headers
    assert_response :ok
    assert_equal "Jane", JSON.parse(response.body)["full_name"]
  end

  test "PUT /api/profile updates existing profile" do
    UserProfile.create!(user: @user, full_name: "Jane")
    put "/api/profile",
        params: { full_name: "Jane Updated", skills: [ "Go" ] },
        headers: @headers,
        as: :json
    assert_response :ok
    assert_equal "Jane Updated", JSON.parse(response.body)["full_name"]
    assert_equal 1, UserProfile.where(user: @user).count
  end

  test "requires authentication" do
    get "/api/profile"
    assert_response :unauthorized
  end

  test "PUT /api/profile round-trips expanded work experience fields" do
    put "/api/profile",
        params: {
          full_name: "Jane Doe",
          work_experiences: [
            { company: "Acme", title: "Engineer", start_date: "Jan 2020",
              end_date: nil, bullet_points: [ "Built APIs" ], description: "Full-stack work",
              location: "Lisbon", skills: [ "Ruby", "Rails" ], position: 0 }
          ]
        },
        headers: @headers,
        as: :json

    assert_response :ok
    exp = JSON.parse(response.body)["work_experiences"][0]
    assert_equal "Full-stack work", exp["description"]
    assert_equal "Lisbon", exp["location"]
    assert_equal [ "Ruby", "Rails" ], exp["skills"]
  end

  test "PUT /api/profile round-trips expanded education fields" do
    put "/api/profile",
        params: {
          full_name: "Jane Doe",
          education_entries: [
            { institution: "MIT", degree: "BSc CS", field_of_study: "Computer Science",
              start_year: "2016", end_year: "2020", description: "Dean's list",
              skills: [ "Python", "ML" ], position: 0 }
          ]
        },
        headers: @headers,
        as: :json

    assert_response :ok
    edu = JSON.parse(response.body)["education_entries"][0]
    assert_equal "Computer Science", edu["field_of_study"]
    assert_equal "2016", edu["start_year"]
    assert_equal "2020", edu["end_year"]
    assert_equal "Dean's list", edu["description"]
    assert_equal [ "Python", "ML" ], edu["skills"]
  end
end
