class CreateEducationEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :education_entries do |t|
      t.references :user_profile, null: false, foreign_key: true
      t.string  :institution, null: false
      t.string  :degree,      null: false
      t.string  :year
      t.integer :position,    default: 0, null: false
      t.timestamps
    end
  end
end
