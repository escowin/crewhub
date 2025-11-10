import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface ChallengeAttributes {
  challenge_id: number;
  distance_meters: number;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes interface
interface ChallengeCreationAttributes extends Optional<ChallengeAttributes, 'challenge_id' | 'description' | 'created_at' | 'updated_at'> {}

// Define the model class
class Challenge extends Model<ChallengeAttributes, ChallengeCreationAttributes> implements ChallengeAttributes {
  public challenge_id!: number;
  public distance_meters!: number;
  public description?: string;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
Challenge.init(
  {
    challenge_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    distance_meters: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      validate: {
        min: 1
      }
    },
    description: {
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
    modelName: 'Challenge',
    tableName: 'challenges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_challenges_distance',
        fields: ['distance_meters']
      }
    ]
  }
);

export default Challenge;