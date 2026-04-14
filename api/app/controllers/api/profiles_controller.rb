class Api::ProfilesController < ApplicationController
  before_action :authenticate_user!

  def show
    profile = current_user.user_profile
    return render json: { error: "Profile not found" }, status: :not_found unless profile

    render json: serialize(profile), status: :ok
  end

  def update
    profile = current_user.user_profile || current_user.build_user_profile

    ActiveRecord::Base.transaction do
      profile.assign_attributes(profile_params)
      profile.save!
      sync_work_experiences(profile, params[:work_experiences])
      sync_education_entries(profile, params[:education_entries])
    end

    render json: serialize(profile.reload), status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def profile_params
    params.permit(:full_name, :email, :phone, :location, :summary, skills: [])
  end

  def sync_work_experiences(profile, experiences)
    return unless experiences.present?

    profile.work_experiences.destroy_all
    Array(experiences).each_with_index do |exp, index|
      profile.work_experiences.create!(
        company:       exp[:company],
        title:         exp[:title],
        start_date:    exp[:start_date],
        end_date:      exp[:end_date],
        bullet_points: Array(exp[:bullet_points]),
        position:      exp[:position] || index
      )
    end
  end

  def sync_education_entries(profile, entries)
    return unless entries.present?

    profile.education_entries.destroy_all
    Array(entries).each_with_index do |edu, index|
      profile.education_entries.create!(
        institution: edu[:institution],
        degree:      edu[:degree],
        year:        edu[:year],
        position:    edu[:position] || index
      )
    end
  end

  def serialize(profile)
    UserProfileSerializer.new(profile).serializable_hash[:data][:attributes]
  end
end
