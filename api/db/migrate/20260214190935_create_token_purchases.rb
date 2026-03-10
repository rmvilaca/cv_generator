class CreateTokenPurchases < ActiveRecord::Migration[8.1]
  def change
    create_table :token_purchases do |t|
      t.references :user, null: false, foreign_key: true
      t.string :stripe_session_id, null: false
      t.integer :amount_cents, null: false
      t.integer :token_amount, null: false
      t.string :status, default: 'pending', null: false

      t.timestamps
    end

    add_index :token_purchases, :stripe_session_id, unique: true
  end
end
