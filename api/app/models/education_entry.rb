class EducationEntry < ApplicationRecord
  belongs_to :user_profile

  validates :institution, :degree, presence: true
end
