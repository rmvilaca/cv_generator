class JobPosting < ApplicationRecord
  belongs_to :user
  has_many :cv_generations, dependent: :destroy

  validates :raw_text, presence: true
  validates :analysis_status, inclusion: { in: %w[pending processing completed failed] }

  serialize :analysis, coder: JSON
end
