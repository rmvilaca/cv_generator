class WorkExperience < ApplicationRecord
  belongs_to :user_profile

  validates :company, :title, :start_date, presence: true
  serialize :bullet_points, coder: JSON
  serialize :skills, coder: JSON
end
