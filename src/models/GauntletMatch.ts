import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface GauntletMatchAttributes {
  match_id: string; // UUID
  gauntlet_id: string; // UUID
  user_lineup_id: string;  // NEW: Reference to user's lineup
  challenger_lineup_id: string;  // NEW: Reference to challenger's lineup
  workout: string;
  sets: number;
  user_wins: number;
  user_losses: number;
  match_date: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes interface
interface GauntletMatchCreationAttributes extends Optional<GauntletMatchAttributes, 'match_id' | 'notes' | 'created_at' | 'updated_at'> {}

// Define the model class
class GauntletMatch extends Model<GauntletMatchAttributes, GauntletMatchCreationAttributes> {
  // Use declare to avoid emitting class fields that shadow Sequelize accessors
  declare match_id: string;
  declare gauntlet_id: string;
  declare user_lineup_id: string;
  declare challenger_lineup_id: string;
  declare workout: string;
  declare sets: number;
  declare user_wins: number;
  declare user_losses: number;
  declare match_date: Date;
  declare notes?: string;
  declare created_at: Date;
  declare updated_at: Date;
}

// Initialize the model
GauntletMatch.init(
  {
    match_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    gauntlet_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'gauntlets',
        key: 'gauntlet_id'
      },
      onDelete: 'CASCADE'
    },
    user_lineup_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'gauntlet_lineups',
        key: 'gauntlet_lineup_id'
      },
      onDelete: 'CASCADE'
    },
    challenger_lineup_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'gauntlet_lineups',
        key: 'gauntlet_lineup_id'
      },
      onDelete: 'CASCADE'
    },
    workout: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    sets: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_wins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    user_losses: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    match_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: 'GauntletMatch',
    tableName: 'gauntlet_matches',
    timestamps: true,
    indexes: [
      {
        name: 'idx_gauntlet_matches_gauntlet_id',
        fields: ['gauntlet_id']
      },
      {
        name: 'idx_gauntlet_matches_user_lineup_id',
        fields: ['user_lineup_id']
      },
      {
        name: 'idx_gauntlet_matches_challenger_lineup_id',
        fields: ['challenger_lineup_id']
      },
      {
        name: 'idx_gauntlet_matches_match_date',
        fields: ['match_date']
      }
    ]
  }
);

export default GauntletMatch;
