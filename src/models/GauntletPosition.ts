import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface GauntletPositionAttributes {
  position_id: string; // Changed to UUID
  gauntlet_id: string; // UUID reference to gauntlets (replaces ladder_id)
  gauntlet_lineup_id: string; // UUID reference to gauntlet lineups
  position: number; // 1-based position (1 = top of ladder)
  previous_position?: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  total_matches: number;
  points: number;
  streak_type: 'win' | 'loss' | 'draw' | 'none';
  streak_count: number;
  last_match_date?: Date;
  joined_date: Date;
  last_updated: Date;
  created_at: Date; // Add missing created_at field
  updated_at: Date; // Add missing updated_at field
}

// Define the creation attributes interface
interface GauntletPositionCreationAttributes extends Optional<GauntletPositionAttributes, 'position_id' | 'previous_position' | 'wins' | 'losses' | 'draws' | 'win_rate' | 'total_matches' | 'points' | 'streak_type' | 'streak_count' | 'last_match_date' | 'joined_date' | 'last_updated' | 'created_at' | 'updated_at'> {}

// Define the model class
class GauntletPosition extends Model<GauntletPositionAttributes, GauntletPositionCreationAttributes> {
  // Use declare to avoid emitting class fields that shadow Sequelize accessors
  declare position_id: string;
  declare gauntlet_id: string; // Replaces ladder_id
  declare gauntlet_lineup_id: string;
  declare position: number;
  declare previous_position?: number;
  declare wins: number;
  declare losses: number;
  declare draws: number;
  declare win_rate: number;
  declare total_matches: number;
  declare points: number;
  declare streak_type: 'win' | 'loss' | 'draw' | 'none';
  declare streak_count: number;
  declare last_match_date?: Date;
  declare joined_date: Date;
  declare last_updated: Date;
  declare created_at: Date;
  declare updated_at: Date;
}

// Initialize the model
GauntletPosition.init(
  {
    position_id: {
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
    gauntlet_lineup_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'gauntlet_lineups',
        key: 'gauntlet_lineup_id'
      },
      onDelete: 'CASCADE'
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    previous_position: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    wins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    losses: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    draws: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    win_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    total_matches: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    streak_type: {
      type: DataTypes.ENUM('win', 'loss', 'draw', 'none'),
      allowNull: false,
      defaultValue: 'none'
    },
    streak_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    last_match_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    joined_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    last_updated: {
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
    modelName: 'GauntletPosition',
    tableName: 'gauntlet_positions',
    timestamps: false, // Using custom timestamp fields
    indexes: [
      {
        name: 'idx_gauntlet_positions_gauntlet_id',
        fields: ['gauntlet_id']
      },
      {
        name: 'idx_gauntlet_positions_gauntlet_lineup_id',
        fields: ['gauntlet_lineup_id']
      },
      {
        name: 'idx_gauntlet_positions_position',
        fields: ['position']
      },
      {
        name: 'idx_gauntlet_positions_unique',
        fields: ['gauntlet_id', 'gauntlet_lineup_id'],
        unique: true
      }
    ]
  }
);

export default GauntletPosition;
