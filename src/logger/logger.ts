import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

// Icone da usare nei log:
// ✅ Successo (info)
// ❌ Errore (error)
// ⚠️ Avviso (warn)
// 📢 Informazione (info)
// 🐛 Debug (debug)

// Ottieni il percorso corrente del file (per ES module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Filtro che raccoglie solo log con il flag "mail_log"
const mail_log = winston.format((info) => {
  return info.mail_log ? info : false;
});

// Configura Winston
const logger: winston.Logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length
        ? `${JSON.stringify(meta)}`
        : "";
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Mantiene i colori nella console
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "logs", "app.log"),
      maxsize: 500 * 1024 * 1024, // 500MB per file
      maxFiles: 30,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "logs", "errors.log"),
      level: "error",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
        })
      ),
    }),
  ],
});

// Esporta il logger
export { logger };
