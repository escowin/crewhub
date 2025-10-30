import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface LadderProgressionAttributes {
  progression_id: string; // Changed to UUID
  ladder_id: string; // Changed to UUID
  gauntlet_lineup_id: string; // UUID reference to gauntlet lineups
  from_position: number;
  to_position: number;
  change: number; // Positive = moved up, Negative = moved down
  reason: 'match_win' | 'match_loss' | 'match_draw' | 'manual_adjustment' | 'new_lineup';
  match_id?: string; // Optional reference to gauntlet_matches (changed to UUID)
  notes?: string;
  date: Date;
  created_at: Date; // Add missing created_at field
  updated_at: Date; // Add missing updated_at field
}

// Define the creation attributes interface
interface LadderProgressionCreationAttributes extends Optional<LadderProgressionAttributes, 'progression_id' | 'match_id' | 'notes' | 'date' | 'created_at' | 'updated_at'> {}

// Define the model class
class LadderProgression extends Model<LadderProgressionAttributes, LadderProgressionCreationAttributes> implements LadderProgressionAttributes {
  // Use declare to avoid emitting class fields that shadow Sequelize accessors
  declare progression_id: string;
  declare ladder_id: string;
  declare gauntlet_lineup_id: string;
  declare from_position: number;
  declare to_position: number;
  declare change: number;
  declare reason: 'match_win' | 'match_loss' | 'match_draw' | 'manual_adjustment' | 'new_lineup';
  declare match_id?: string;
  declare notes?: string;
  declare date: Date;
  declare created_at: Date;
  declare updated_at: Date;

  // Timestamps
  declare createdAt: Date;
  declare updatedAt: Date;
}

// Initialize the model
LadderProgression.init(
  {
    progression_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    ladder_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ladders',
        key: 'ladder_id'
      },
      onDelete: 'CASCADE'
    },
    gauntlet_lineup_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'gauntlet_lineups',
        key: 'gauntlet_lineup_id'
      },
      onDelete: 'CASCADE'
    },
    from_position: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    to_position: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    change: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    reason: {
      type: DataTypes.ENUM('match_win', 'match_loss', 'match_draw', 'manual_adjustment', 'new_lineup'),
      allowNull: false
    },
    match_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'gauntlet_matches',
        key: 'match_id'
      },
      onDelete: 'CASCADE'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
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
    modelName: 'LadderProgression',
    tableName: 'ladder_progressions',
    timestamps: false, // Using custom date field
    indexes: [
      {
        name: 'idx_ladder_progressions_ladder_id',
        fields: ['ladder_id']
      },
      {
        name: 'idx_ladder_progressions_gauntlet_lineup_id',
        fields: ['gauntlet_lineup_id']
      },
      {
        name: 'idx_ladder_progressions_match_id',
        fields: ['match_id']
      }
    ]
  }
);

export default LadderProgression;
