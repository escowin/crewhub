import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface ChallengeLineupAttributes {
  challenge_lineup_id: string;
  challenge_id: number;
  saved_lineup_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes interface
interface ChallengeLineupCreationAttributes extends Optional<ChallengeLineupAttributes, 'challenge_lineup_id' | 'is_active' | 'created_at' | 'updated_at'> {}

// Define the model class
class ChallengeLineup extends Model<ChallengeLineupAttributes, ChallengeLineupCreationAttributes> implements ChallengeLineupAttributes {
  public challenge_lineup_id!: string;
  public challenge_id!: number;
  public saved_lineup_id!: string;
  public is_active!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
ChallengeLineup.init(
  {
    challenge_lineup_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    challenge_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'challenges',
        key: 'challenge_id'
      },
      onDelete: 'CASCADE'
    },
    saved_lineup_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'saved_lineups',
        key: 'saved_lineup_id'
      },
      onDelete: 'CASCADE'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    modelName: 'ChallengeLineup',
    tableName: 'challenge_lineups',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_challenge_lineups_challenge_id',
        fields: ['challenge_id']
      },
      {
        name: 'idx_challenge_lineups_saved_lineup_id',
        fields: ['saved_lineup_id']
      },
      {
        name: 'idx_challenge_lineups_is_active',
        fields: ['is_active']
      },
      {
        name: 'idx_challenge_lineups_challenge_saved_lineup_active',
        fields: ['challenge_id', 'saved_lineup_id', 'is_active'],
        where: {
          is_active: true
        }
      },
      {
        unique: true,
        fields: ['challenge_id', 'saved_lineup_id'] // Ensure one challenge_lineup per challenge per saved_lineup
      }
    ]
  }
);

export default ChallengeLineup;