class CvGenerationJob < ApplicationJob
  queue_as :default

  def perform(cv_generation_id)
    generation = CvGeneration.find(cv_generation_id)
    generation.update!(status: "processing")

    content = CvGenerationService.new(
      user:        generation.user,
      job_posting: generation.job_posting
    ).call

    generation.update!(content: content, status: "completed")
  rescue CvGenerationService::Error => e
    Rails.logger.error("CvGenerationJob failed for generation #{cv_generation_id}: #{e.message}")
    generation&.update!(status: "failed")
  end
end
