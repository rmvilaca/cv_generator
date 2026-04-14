class Api::CvGenerationsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_job_posting

  FREE_TIER_LIMIT = 3

  def index
    generations = @job_posting.cv_generations.order(created_at: :desc)
    render json: generations.map { |g| serialize(g) }, status: :ok
  end

  def show
    generation = @job_posting.cv_generations.find_by(id: params[:id])
    return render json: { error: "Not found" }, status: :not_found unless generation

    render json: serialize(generation), status: :ok
  end

  def create
    unless @job_posting.analysis_status == "completed"
      return render json: { error: "Job analysis not ready yet" }, status: :unprocessable_entity
    end

    tokens_used = 0
    granted     = false

    ActiveRecord::Base.transaction do
      user = User.find(current_user.id)

      if user.free_generations_used < FREE_TIER_LIMIT
        user.increment!(:free_generations_used)
        granted = true
      elsif user.token_balance >= 1
        user.decrement!(:token_balance)
        tokens_used = 1
        granted     = true
      end
    end

    return render json: { error: "Insufficient tokens. Please purchase more." },
                  status: :payment_required unless granted

    generation = CvGeneration.create!(
      user:        current_user,
      job_posting: @job_posting,
      tokens_used: tokens_used
    )
    CvGenerationJob.perform_later(generation.id)
    render json: serialize(generation), status: :created
  end

  private

  def set_job_posting
    @job_posting = current_user.job_postings.find_by(id: params[:job_posting_id])
    render json: { error: "Job posting not found" }, status: :not_found unless @job_posting
  end

  def serialize(generation)
    CvGenerationSerializer.new(generation).serializable_hash[:data][:attributes]
  end
end
