import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface SavedLineupAttributes {
  saved_lineup_id: string;
  boat_id: string;
  lineup_name?: string;
  team_id?: number;
  created_by: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes interface
interface SavedLineupCreationAttributes extends Optional<SavedLineupAttributes, 'saved_lineup_id' | 'lineup_name' | 'team_id' | 'is_active' | 'created_at' | 'updated_at'> {}

// Define the model class
class SavedLineup extends Model<SavedLineupAttributes, SavedLineupCreationAttributes> implements SavedLineupAttributes {
  public saved_lineup_id!: string;
  public boat_id!: string;
  public lineup_name?: string;
  public team_id?: number;
  public created_by!: string;
  public is_active!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
SavedLineup.init(
  {
    saved_lineup_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    boat_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'boats',
        key: 'boat_id'
      },
      onDelete: 'CASCADE'
    },
    lineup_name: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'teams',
        key: 'team_id'
      }
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'athletes',
        key: 'athlete_id'
      }
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
    modelName: 'SavedLineup',
    tableName: 'saved_lineups',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_saved_lineups_boat_id',
        fields: ['boat_id']
      },
      {
        name: 'idx_saved_lineups_team_id',
        fields: ['team_id']
      },
      {
        name: 'idx_saved_lineups_created_by',
        fields: ['created_by']
      },
      {
        name: 'idx_saved_lineups_is_active',
        fields: ['is_active']
      }
    ]
  }
);

export default SavedLineup;

