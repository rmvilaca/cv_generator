class User < ApplicationRecord
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :jwt_authenticatable, jwt_revocation_strategy: JwtDenylist

  has_many :token_purchases, dependent: :destroy
  has_one  :user_profile,    dependent: :destroy
  has_many :job_postings,    dependent: :destroy
  has_many :cv_generations,  dependent: :destroy
end
