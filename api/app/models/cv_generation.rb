class CvGeneration < ApplicationRecord
  belongs_to :user
  belongs_to :job_posting

  validates :status, inclusion: { in: %w[pending processing completed failed] }

  serialize :content, coder: JSON
end
