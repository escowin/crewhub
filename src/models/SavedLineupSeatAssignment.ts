import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Define the attributes interface
interface SavedLineupSeatAssignmentAttributes {
  saved_lineup_seat_id: string;
  saved_lineup_id: string;
  athlete_id: string;
  seat_number: number;
  side?: 'Port' | 'Starboard' | 'Scull' | '';
  created_at: Date;
  updated_at: Date;
}

// Define the creation attributes interface
interface SavedLineupSeatAssignmentCreationAttributes extends Optional<SavedLineupSeatAssignmentAttributes, 'saved_lineup_seat_id' | 'side' | 'created_at' | 'updated_at'> {}

// Define the model class
class SavedLineupSeatAssignment extends Model<SavedLineupSeatAssignmentAttributes, SavedLineupSeatAssignmentCreationAttributes> implements SavedLineupSeatAssignmentAttributes {
  public saved_lineup_seat_id!: string;
  public saved_lineup_id!: string;
  public athlete_id!: string;
  public seat_number!: number;
  public side?: 'Port' | 'Starboard' | 'Scull' | '';
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Custom toJSON method to ensure correct field names
  public override toJSON() {
    const values = Object.assign({}, this.get());
    return {
      saved_lineup_seat_id: values.saved_lineup_seat_id,
      saved_lineup_id: values.saved_lineup_id,
      athlete_id: values.athlete_id,
      seat_number: values.seat_number,
      side: values.side,
      created_at: values.created_at,
      updated_at: values.updated_at
    };
  }
}

// Initialize the model
SavedLineupSeatAssignment.init(
  {
    saved_lineup_seat_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false
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
    athlete_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'athletes',
        key: 'athlete_id'
      },
      onDelete: 'CASCADE'
    },
    seat_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 9
      }
    },
    side: {
      type: DataTypes.ENUM('Port', 'Starboard', 'Scull', ''),
      allowNull: true,
      defaultValue: ''
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
    modelName: 'SavedLineupSeatAssignment',
    tableName: 'saved_lineup_seat_assignments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_saved_lineup_seat_assignments_saved_lineup_id',
        fields: ['saved_lineup_id']
      },
      {
        name: 'idx_saved_lineup_seat_assignments_athlete_id',
        fields: ['athlete_id']
      },
      {
        name: 'idx_saved_lineup_seat_assignments_seat_number',
        fields: ['seat_number']
      },
      {
        unique: true,
        fields: ['saved_lineup_id', 'seat_number'] // Ensure one athlete per seat per saved lineup
      }
    ]
  }
);

export default SavedLineupSeatAssignment;

