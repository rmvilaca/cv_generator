class CreateCvGenerations < ActiveRecord::Migration[8.1]
  def change
    create_table :cv_generations do |t|
      t.references :user,        null: false, foreign_key: true
      t.references :job_posting, null: false, foreign_key: true
      t.text    :content
      t.string  :status,      default: "pending", null: false
      t.integer :tokens_used, default: 0,       null: false
      t.timestamps
    end
  end
end
