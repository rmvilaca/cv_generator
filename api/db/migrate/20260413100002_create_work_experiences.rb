class CreateWorkExperiences < ActiveRecord::Migration[8.1]
  def change
    create_table :work_experiences do |t|
      t.references :user_profile, null: false, foreign_key: true
      t.string  :company,       null: false
      t.string  :title,         null: false
      t.string  :start_date,    null: false
      t.string  :end_date
      t.text    :bullet_points, default: "[]", null: false
      t.integer :position,      default: 0, null: false
      t.timestamps
    end
  end
end
