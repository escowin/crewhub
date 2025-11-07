import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface RegattaAttributes {
  regatta_id: number;
  event: string;
  host: string;
  type: 'Head' | 'Sprint' | 'Head/Sprint' | 'Indoor' | 'Coastal' | 'Henley' | 'Open Water' | 'Virtual';
  location?: string;
  venue?: string;
  start_date?: Date;
  duration?: number;
  registration_opens?: Date;
  registration_closes?: Date;
  late_registration_opens?: Date;
  late_registration_closes?: Date;
  scratch_window_opens?: Date;
  scratch_window_closes?: Date;
  url?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes
interface RegattaCreationAttributes extends Optional<RegattaAttributes,
  'regatta_id' | 'event' | 'host' | 'type' | 'location' | 'venue' | 'start_date' | 'duration' | 
  'registration_opens' | 'registration_closes' | 'late_registration_opens' | 'late_registration_closes' | 'scratch_window_opens' | 'scratch_window_closes' | 'url' | 'notes' | 'created_at' | 'updated_at'
> {}

class Regatta extends Model<RegattaAttributes, RegattaCreationAttributes> implements RegattaAttributes {
  public regatta_id!: number;
  public event!: string;
  public host!: string;
  public type!: 'Head' | 'Sprint' | 'Head/Sprint' | 'Indoor' | 'Coastal' | 'Henley' | 'Open Water' | 'Virtual';
  public location?: string;
  public venue?: string;
  public start_date?: Date;
  public duration?: number;
  public registration_opens?: Date;
  public registration_closes?: Date;
  public late_registration_opens?: Date;
  public late_registration_closes?: Date;
  public scratch_window_opens?: Date;
  public scratch_window_closes?: Date;
  public url?: string;
  public notes?: string;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Regatta.init(
  {
    regatta_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    host: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('Head', 'Sprint', 'Head/Sprint', 'Indoor', 'Coastal', 'Henley', 'Open Water', 'Virtual'),
      allowNull: false,
      defaultValue: 'Sprint',
    },
    location: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    venue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    registration_opens: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    registration_closes: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    late_registration_opens: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    late_registration_closes: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    scratch_window_opens: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    scratch_window_closes: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    modelName: 'Regatta',
    tableName: 'regattas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['event'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['start_date'],
      },
      {
        fields: ['registration_opens'],
      },
    ],
  }
);

export default Regatta;
