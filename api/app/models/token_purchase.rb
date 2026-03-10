class TokenPurchase < ApplicationRecord
  belongs_to :user

  validates :stripe_session_id, presence: true, uniqueness: true
  validates :amount_cents, :token_amount, presence: true, numericality: { greater_than: 0 }
  validates :status, inclusion: { in: %w[pending completed failed] }

  scope :completed, -> { where(status: "completed") }
  scope :pending,   -> { where(status: "pending") }
  scope :failed,    -> { where(status: "failed") }
end
