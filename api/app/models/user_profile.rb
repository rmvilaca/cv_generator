class UserProfile < ApplicationRecord
  belongs_to :user
  has_many :work_experiences, -> { order(:position) }, dependent: :destroy
  has_many :education_entries, -> { order(:position) }, dependent: :destroy

  validates :full_name, presence: true
  serialize :skills, coder: JSON
end
