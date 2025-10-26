import { Sequelize } from 'sequelize';
import { env } from './env';

// API-optimized database configuration interface
interface APIDatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  dialect: 'postgres';
  logging: boolean | ((sql: string) => void);
  pool: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
  define: {
    timestamps: boolean;
    underscored: boolean;
    freezeTableName: boolean;
  };
  // API-specific options
  benchmark: boolean;
  retry: {
    match: RegExp[];
    max: number;
  };
}

// API-optimized database configuration
const apiConfig: APIDatabaseConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? console.log : false,
  // API-optimized connection pool (higher for concurrent requests)
  pool: {
    max: 20,       // Higher max connections for API
    min: 5,        // Keep minimum connections warm
    acquire: 30000, // Faster timeout for API responses
    idle: 10000    // Standard idle timeout
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  },
  // API-specific optimizations
  benchmark: env.NODE_ENV === 'development',
  retry: {
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ESOCKETTIMEDOUT/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 3
  }
};

// Create API-optimized Sequelize instance
const sequelize = new Sequelize(
  apiConfig.database,
  apiConfig.username,
  apiConfig.password,
  {
    host: apiConfig.host,
    port: apiConfig.port,
    dialect: apiConfig.dialect,
    logging: apiConfig.logging,
    pool: apiConfig.pool,
    define: apiConfig.define,
    benchmark: apiConfig.benchmark,
    retry: apiConfig.retry,
    // API-specific optimizations
    hooks: {
      beforeQuery: (_options: any, query: any) => {
        if (env.NODE_ENV === 'development') {
          console.log(`🔍 API: Executing query: ${query}`);
        }
      },
      afterQuery: (_options: any, _query: any) => {
        if (env.NODE_ENV === 'development') {
          console.log(`✅ API: Query completed successfully`);
        }
      }
    }
  }
);

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
};

// Close database connection
export const closeConnection = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed successfully.');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

export default sequelize;
export { apiConfig as config };
