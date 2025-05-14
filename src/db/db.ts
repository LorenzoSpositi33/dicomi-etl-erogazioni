import sql from "mssql";
import { logger } from "../logger/logger.js"; // Importa il logger
import "dotenv/config";

interface DBConfig {
  user: string;
  password: string;
  server: string;
  database: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

const config: DBConfig = {
  user: process.env.DB_USER ?? "",
  password: process.env.DB_PASSWORD ?? "",
  server: process.env.DB_SERVER ?? "",
  database: process.env.DB_NAME ?? "",
  options: {
    encrypt: process.env.DB_ENCRYPT === "true", // Converte la stringa in booleano
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true", // Converte la stringa in booleano
  },
};

// Pool di connessione riutilizzabile
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export const getDatabasePool = async (): Promise<sql.ConnectionPool> => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        logger.info("Connessione al database riuscita");
        return pool;
      })
      .catch((err) => {
        logger.error("Errore nella connessione al database:", err);
        throw err;
      });
  }
  return poolPromise;
};

// Esportazione ESM
export { sql };
