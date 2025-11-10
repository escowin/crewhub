import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface ChallengeEntryAttributes {
  challenge_entry_id: string;
  lineup_id: string;
  time_seconds: number;
  stroke_rate?: number;
  split_seconds?: number;
  entry_date: Date;
  entry_time: Date;
  notes?: string;
  conditions?: string;
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes interface
interface ChallengeEntryCreationAttributes extends Optional<ChallengeEntryAttributes, 'challenge_entry_id' | 'stroke_rate' | 'split_seconds' | 'entry_date' | 'entry_time' | 'notes' | 'conditions' | 'created_at' | 'updated_at'> {}

// Define the model class
class ChallengeEntry extends Model<ChallengeEntryAttributes, ChallengeEntryCreationAttributes> implements ChallengeEntryAttributes {
  public challenge_entry_id!: string;
  public lineup_id!: string;
  public time_seconds!: number;
  public stroke_rate?: number;
  public split_seconds?: number;
  public entry_date!: Date;
  public entry_time!: Date;
  public notes?: string;
  public conditions?: string;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
ChallengeEntry.init(
  {
    challenge_entry_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    lineup_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'challenge_lineups',
        key: 'challenge_lineup_id'
      },
      onDelete: 'CASCADE'
    },
    time_seconds: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    stroke_rate: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      }
    },
    split_seconds: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    entry_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    entry_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    conditions: {
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
    modelName: 'ChallengeEntry',
    tableName: 'challenge_entries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_challenge_entries_lineup_id',
        fields: ['lineup_id']
      },
      {
        name: 'idx_challenge_entries_entry_date',
        fields: ['entry_date']
      },
      {
        name: 'idx_challenge_entries_entry_time',
        fields: ['entry_time']
      },
      {
        name: 'idx_challenge_entries_time_seconds',
        fields: ['time_seconds']
      },
      {
        name: 'idx_challenge_entries_lineup_date',
        fields: ['lineup_id', 'entry_date']
      },
      {
        name: 'idx_challenge_entries_lineup_date_time',
        fields: ['lineup_id', 'entry_date', 'entry_time']
      }
    ]
  }
);

export default ChallengeEntry;