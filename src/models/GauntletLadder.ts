import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface GauntletLadderAttributes {
  ladder_id: string; // Changed to UUID
  gauntlet_id: string; // UUID reference to gauntlets
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes interface
interface GauntletLadderCreationAttributes extends Optional<GauntletLadderAttributes, 'ladder_id' | 'created_at' | 'updated_at'> {}

// Define the model class
class GauntletLadder extends Model<GauntletLadderAttributes, GauntletLadderCreationAttributes> implements GauntletLadderAttributes {
  public ladder_id!: string;
  public gauntlet_id!: string;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
GauntletLadder.init(
  {
    ladder_id: {
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
    modelName: 'GauntletLadder',
    tableName: 'gauntlet_ladders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_ladders_gauntlet_id',
        fields: ['gauntlet_id']
      }
    ]
  }
);

export default GauntletLadder;
