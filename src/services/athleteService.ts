import { Athlete, UsraCategory } from '../models';

export interface AthleteFilters {
  active?: boolean;
  competitive_status?: 'active' | 'inactive' | 'retired' | 'banned';
  team_id?: number;
}

export interface AthleteWithUsraData {
  // Essential fields for localStorage - using snake_case to match database and RowCalibur
  athlete_id: string;
  name: string;
  active: boolean;
  age?: number | undefined;
  birth_year?: number | string;
  bow_in_dark?: boolean;
  email?: string;
  emergency_contact?: string;
  emergency_contact_phone?: string;
  experience_years?: number | string;
  gender?: 'M' | 'F';
  height_cm?: number | string;
  phone?: string;
  port_starboard?: 'Starboard' | 'Prefer Starboard' | 'Either' | 'Prefer Port' | 'Port';
  sweep_scull?: 'Sweep' | 'Scull' | 'Sweep & Scull';
  type: 'Cox' | 'Rower' | 'Rower & Coxswain';
  usra_age_category?: string;
  us_rowing_number?: string;
  weight_kg?: number | string;
}

export class AthleteService {
  /**
   * Get athletes with USRA category data (consolidated method)
   * Returns full athlete data including contact information for all use cases
   */
  async getAthletes(filters?: AthleteFilters): Promise<AthleteWithUsraData[]> {
    try {
      const whereClause: any = {};
      
      if (filters?.active !== undefined) {
        whereClause.active = filters.active;
      }
      
      if (filters?.competitive_status) {
        whereClause.competitive_status = filters.competitive_status;
      }

      const athletes = await Athlete.findAll({
        where: whereClause,
        include: [{
          model: UsraCategory,
          as: 'usra_age_category',
          required: false, // LEFT JOIN to include athletes without USRA categories
          attributes: ['category']
        }],
        attributes: [
          'active',
          'athlete_id',
          'name',
          'birth_year',
          'bow_in_dark',
          'email',
          'emergency_contact',
          'emergency_contact_phone',
          'experience_years',
          'gender',
          'height_cm',
          'phone',
          'port_starboard',
          'sweep_scull',
          'type',
          'weight_kg',
          'usra_age_category_id',
          'us_rowing_number',
          'created_at',
          'updated_at'
        ],
        order: [['name', 'ASC']],
        raw: false // Keep as instances to access included data
      });

      // Transform the data to include calculated age and USRA category
      const currentYear = new Date().getFullYear();
      
      return athletes.map(athlete => {
        const athleteData = athlete.toJSON() as any;
        
        return {
          athlete_id: athleteData.athlete_id,
          name: athleteData.name,
          active: athleteData.active,
          birth_year: athleteData.birth_year,
          age: athleteData.birth_year ? currentYear - athleteData.birth_year : undefined,
          bow_in_dark: athleteData.bow_in_dark,
          email: athleteData.email,
          emergency_contact: athleteData.emergency_contact,
          emergency_contact_phone: athleteData.emergency_contact_phone,
          experience_years: athleteData.experience_years,
          gender: athleteData.gender,
          height_cm: athleteData.height_cm,
          phone: athleteData.phone,
          port_starboard: athleteData.port_starboard,
          sweep_scull: athleteData.sweep_scull,
          type: athleteData.type,
          usra_age_category: athleteData.usra_age_category?.category || undefined,
          us_rowing_number: athleteData.us_rowing_number,
          weight_kg: athleteData.weight_kg,
        };
      });

    } catch (error) {
      console.error('Error fetching athletes:', error);
      throw new Error('Failed to fetch athletes');
    }
  }

  /**
   * Update athlete profile data
   * Allows athletes to update their own profile information
   */
  async updateAthleteProfile(athleteId: string, updateData: Partial<AthleteWithUsraData>): Promise<AthleteWithUsraData | null> {
    try {
      // Find the athlete first
      const athlete = await Athlete.findByPk(athleteId);
      if (!athlete) {
        return null;
      }

      // Map frontend field names to database field names (now both use snake_case)
      const dbUpdateData: any = {};
      
      if (updateData.height_cm !== undefined) {
        // Convert empty string to null for numeric fields
        dbUpdateData.height_cm = updateData.height_cm === '' ? null : updateData.height_cm;
      }
      if (updateData.weight_kg !== undefined) {
        // Convert empty string to null for numeric fields
        dbUpdateData.weight_kg = updateData.weight_kg === '' ? null : updateData.weight_kg;
      }
      if (updateData.email !== undefined) {
        dbUpdateData.email = updateData.email;
      }
      if (updateData.phone !== undefined) {
        dbUpdateData.phone = updateData.phone;
      }
      if (updateData.emergency_contact !== undefined) {
        dbUpdateData.emergency_contact = updateData.emergency_contact;
      }
      if (updateData.emergency_contact_phone !== undefined) {
        dbUpdateData.emergency_contact_phone = updateData.emergency_contact_phone;
      }
      if (updateData.port_starboard !== undefined) {
        dbUpdateData.port_starboard = updateData.port_starboard;
      }
      if (updateData.sweep_scull !== undefined) {
        dbUpdateData.sweep_scull = updateData.sweep_scull;
      }
      if (updateData.bow_in_dark !== undefined) {
        dbUpdateData.bow_in_dark = updateData.bow_in_dark;
      }
      if (updateData.experience_years !== undefined) {
        // Convert empty string to null for numeric fields
        dbUpdateData.experience_years = updateData.experience_years === '' ? null : updateData.experience_years;
      }
      if (updateData.birth_year !== undefined) {
        // Convert empty string to null for numeric fields
        dbUpdateData.birth_year = updateData.birth_year === '' ? null : updateData.birth_year;
      }

      // Update the athlete
      await athlete.update(dbUpdateData);

      // Return the updated athlete profile by finding it in the full athletes list
      const athletes = await this.getAthletes({ active: true });
      return athletes.find(athlete => athlete.athlete_id === athleteId) || null;

    } catch (error) {
      console.error('Error updating athlete profile:', error);
      throw new Error('Failed to update athlete profile');
    }
  }
}

export const athleteService = new AthleteService();
