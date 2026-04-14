class Api::JobPostingsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_posting, only: [ :show, :destroy ]

  def index
    postings = current_user.job_postings.order(created_at: :desc)
    render json: postings.map { |p| serialize(p) }, status: :ok
  end

  def show
    render json: serialize(@posting), status: :ok
  end

  def create
    posting = current_user.job_postings.build(posting_params)

    if posting.save
      JobAnalysisJob.perform_later(posting.id)
      render json: serialize(posting), status: :created
    else
      render json: { error: posting.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  def destroy
    @posting.destroy!
    head :no_content
  end

  private

  def set_posting
    @posting = current_user.job_postings.find_by(id: params[:id])
    render json: { error: "Not found" }, status: :not_found unless @posting
  end

  def posting_params
    params.permit(:raw_text, :url)
  end

  def serialize(posting)
    JobPostingSerializer.new(posting).serializable_hash[:data][:attributes]
  end
end
