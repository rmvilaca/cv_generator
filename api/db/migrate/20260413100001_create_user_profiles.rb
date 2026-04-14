class CreateUserProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :user_profiles do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :full_name, null: false
      t.string :email
      t.string :phone
      t.string :location
      t.text   :summary
      t.text   :skills, default: "[]", null: false
      t.timestamps
    end
  end
end
