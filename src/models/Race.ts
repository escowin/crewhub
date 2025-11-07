import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface RaceAttributes {
  race_id: string; // Changed from number to string (UUID)
  regatta_id: number;
  lineup_id?: string; // Changed from number to string (UUID) to match Lineup model
  event_name: string;
  event_date?: Date;
  event_time?: string;
  heat?: number;
  distance_meters: number;
  race_time?: Date;
  race_delta?: number;
  race_placement?: number;
  total_entries?: number;
  lane?: number;
  boat_number?: number;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface RaceCreationAttributes extends Optional<RaceAttributes, 'race_id' | 'regatta_id' | 'lineup_id' | 'event_name' | 'event_date' | 'event_time' | 'distance_meters' | 'race_time' | 'race_delta' | 'race_placement' | 'total_entries' | 'lane' | 'boat_number' | 'notes'> {}

class Race extends Model<RaceAttributes, RaceCreationAttributes> implements RaceAttributes {
  public race_id!: string; // Changed from number to string (UUID)
  public regatta_id!: number;
  public lineup_id?: string; // Changed from number to string (UUID) to match Lineup model
  public event_name!: string;
  public race_date?: Date;
  public race_time?: Date;
  public distance_meters!: number;
  public result_time_seconds?: number;
  public placement?: number;
  public total_entries?: number;
  public lane?: number;
  public boat_number?: number;
  public notes?: string;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Race.init(
  {
    race_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    regatta_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'regattas',
        key: 'regatta_id',
      },
    },
    lineup_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'lineups',
        key: 'lineup_id',
      },
    },
    event_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    event_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    event_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    distance_meters: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2000,
      validate: {
        min: 0,
      },
    },
    race_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    race_delta: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
      },
    },
    race_placement: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
      },
    },
    total_entries: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
      },
    },
    lane: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 10, // Most regattas have max 10 lanes
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Race',
    tableName: 'races',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['regatta_id'],
      },
      {
        fields: ['lineup_id'],
      },
      {
        fields: ['event_date'],
      },
      {
        fields: ['event_name'],
      },
    ],
  }
);

export default Race;
