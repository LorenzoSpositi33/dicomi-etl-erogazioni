import "dotenv/config";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const excelLogDir = path.join(__dirname, "logger", "xlsx");
// const excelLogPath = path.join(excelLogDir, "oss_logs.xlsx");
// // Crea la directory per contenere gli excel
// if (!fs.existsSync(excelLogDir)) {
//   fs.mkdirSync(excelLogDir, { recursive: true });
// }
// // Parametri del file .ENV
// const ossTable = process.env.TABLE_OSSERVATORIO_PREZZI;
// const logTable = process.env.TABLE_OSSERVATORIO_PREZZI_LOG;
// const concTable = process.env.TABLE_CONCORRENZA;
// const secretGen = process.env.SECRET_AUTH_KEY;
// const codesLog = {};
// // Funzione per calcolare l'hash di una stringa
// function hashString(input) {
//   logger.info("✅ Secret in generazione");
//   return crypto.createHash("sha256").update(input).digest("hex");
// }
// // Funzione per eseguire query
// async function executeQuery(query) {
//   try {
//     const pool = await poolPromise; // Ottieni il pool di connessione
//     const result = await pool.request().query(query);
//     return result.recordset;
//   } catch (err) {
//     logger.error("❌ Errore nella query:", err);
//   }
// }
// // Funzione per ottenere i dati dell'osservatorio prezzi dall'API pubblica
// async function fetchData(ossId) {
//   try {
//     const response = await axios.get(
//       `https://carburanti.mise.gov.it/ospzApi/registry/servicearea/${ossId}`
//     );
//     if (response.status === 200) {
//       return response.data;
//     }
//   } catch (error) {
//     logger.error("❌ Errore nella richiesta API:", error);
//     return false;
//   }
// }
// // Funzione per convertire il nome presente nell'Osservatorio con il codice articolo di Dicomi
// async function convertArticle(article) {
//   switch (article.toUpperCase()) {
//     case "BENZINA":
//       return "BEN";
//     case "GASOLIO":
//       return "GAS";
//     case "GASOLIO ALPINO":
//     case "GASOLIO ARTICO":
//     case "GASOLIO GELO":
//       return "ART";
//     case "GPL":
//       return "GPL";
//     default:
//       return null;
//   }
// }
// // Funzione per inserire in modo sicuro nel DB i dati ottenuti dall'API
// async function insertFuels(IDOss, fuel, article, type) {
//   try {
//     const pool = await poolPromise; // Ottieni la connessione al database
//     // Converte la data in fuso orario locale e aggiunge 1 ora se necessario
//     let validityDate = DateTime.fromJSDate(fuel.validityDate, {
//       zone: "Europe/Rome",
//     });
//     if (validityDate.isInDST) {
//       // Verifica se è in ora legale
//       validityDate = validityDate.plus({ hours: 1 });
//     }
//     // Query MERGE per upsert: se la combinazione di IDOss, DataScarico, ArticoloOss e TipoOperazione esiste, aggiorna i campi specificati;
//     // altrimenti, inserisci una nuova riga.
//     const query = `
//       MERGE INTO ${ossTable} AS target
//       USING (VALUES (@IDOss, CAST(GETDATE() AS date), @ArticoloOss, @TipoOperazione))
//              AS source (IDOss, DataScarico, ArticoloOss, TipoOperazione)
//       ON (target.IDOss = source.IDOss
//           AND target.DataScarico = source.DataScarico
//           AND target.ArticoloOss = source.ArticoloOss
//           AND target.TipoOperazione = source.TipoOperazione)
//       WHEN MATCHED THEN
//          UPDATE SET
//             DataComunicazione = @DataComunicazione,
//             Articolo = @Articolo,
//             Prezzo = @Prezzo,
//             DataModifica = GETDATE()
//       WHEN NOT MATCHED THEN
//          INSERT (IDOss, DataScarico, DataComunicazione, ArticoloOss, Articolo, TipoOperazione, Prezzo)
//          VALUES (@IDOss, CAST(GETDATE() AS date), @DataComunicazione, @ArticoloOss, @Articolo, @TipoOperazione, @Prezzo);
//       `;
//     await pool
//       .request()
//       .input("IDOss", sql.Int, IDOss)
//       .input("DataComunicazione", sql.DateTime, fuel.validityDate)
//       .input("ArticoloOss", sql.NVarChar, fuel.name)
//       .input("Articolo", sql.NVarChar, article)
//       .input("TipoOperazione", sql.NVarChar, type)
//       .input("Prezzo", sql.Float, fuel.price)
//       .query(query);
//     logger.info(`✅ Inserito con successo in ${ossTable} :`, fuel);
//   } catch (err) {
//     logger.error(`❌ Errore durante l\'inserimento in ${ossTable}:`, err);
//   }
// }
// // Funzione per inserire una riga di log relativamente alla connessione con l'impianto dell'Osservatorio Prezzi
// async function insertLog(IDOss, code) {
//   codesLog[code] = (codesLog[code] || 0) + 1;
//   try {
//     const pool = await poolPromise; // Ottieni la connessione al database
//     const query = `INSERT INTO ${logTable} (IDOss, Codice)
//          VALUES (@IDOss, @Codice)`;
//     await pool
//       .request()
//       .input("IDOss", sql.Int, IDOss)
//       .input("Codice", sql.Int, code)
//       .query(query);
//     logger.info(`✅ Inserito con successo in ${logTable} :`, {
//       IdOss: IDOss,
//       code: code,
//     });
//   } catch (err) {
//     logger.error(`❌ Errore durante l\'inserimento in ${logTable}:`, err);
//   }
// }
// async function hasArticleGas(fuels) {
//   const results = await Promise.all(
//     fuels.map(async (fuel) => (await convertArticle(fuel.name)) === "GAS")
//   );
//   return results.some((result) => result === true); // Se almeno un GAS è presente, ritorna true
// }
// logger.info("🚀 Script avviato con successo.", { mail_log: true });
// // Ottengo l'elenco di tutti gli ID Osservatorio che devo monitorare dalla tabella "concorrenza", solo per gli impianti attivi
// logger.info("📢 Ottengo l'elenco degli ID Osservatorio da monitorare...");
// const ossList = await executeQuery(
//   `SELECT DISTINCT IdOsservatorioPrezzi FROM ${concTable} WHERE AttivoSiNo = 1`
// );
// // const ossList = [{ IdOsservatorioPrezzi: 17547 }];
// // Array per accumulare i dati per Excel
// const excelData = [];
// // Array per contenere tutti gli impianti rilevati per nuova gestione
// const ossTracker = [];
// // Creazione del file Excel con exceljs
// const workbook = new ExcelJS.Workbook();
// const worksheet = workbook.addWorksheet("Impianti");
// // Definizione delle colonne
// worksheet.columns = [
//   { header: "IDOsservatorio", key: "ossID", width: 20 },
//   { header: "Codice", key: "code", width: 10 },
//   { header: "Descrizione", key: "desc", width: 50 },
//   { header: "Dati", key: "fuels", width: 50 },
// ];
// for (const oss of ossList) {
//   const ossID = oss.IdOsservatorioPrezzi;
//   logger.info(`📢 Id Osservatorio in corso: ${ossID}`);
//   const data = await fetchData(ossID);
//   if (!data) {
//     logger.error(
//       `❌ Impianto ${ossID}: Errore nel recupero dei dati dall'API`,
//       { mail_log: true }
//     );
//     insertLog(ossID, 1);
//     excelData.push({
//       ossID,
//       code: 1,
//       desc: "ID Impianto NON raggiunto",
//       fuels: "NULL",
//     });
//     continue;
//   }
//   const fuels = data.fuels;
//   if (fuels === null) {
//     // L'impianto non esiste
//     logger.warn(`⚠️ Impianto ${ossID}: L'impianto non esiste`, {
//       mail_log: true,
//     });
//     insertLog(ossID, 2);
//     excelData.push({
//       ossID,
//       code: 2,
//       desc: "ID Impianto raggiunto, nessun valore restituito",
//       fuels: "NULL",
//     });
//   } else if (fuels.length === 0) {
//     // L'impianto esiste ma non contiene dati nell'Osservatorio Prezzi
//     logger.warn(
//       `⚠️ Impianto ${ossID}: L'impianto esiste ma non contiene dati nell'Osservatorio Prezzi`,
//       { mail_log: true }
//     );
//     insertLog(ossID, 3);
//     excelData.push({
//       ossID,
//       code: 3,
//       desc: "ID Impianto raggiunto, nessun prezzo trovato",
//       fuels: "",
//     });
//     // Ottengo la via dell'Osservatorio Prezzi con cui sto avendo problemi
//     const address = data.address;
//     const urlParams = new URLSearchParams(address).toString();
//     // Ottengo la geolocalizzazione da open street map
//     const openStreetInfo = await axios.get(
//       `https://nominatim.openstreetmap.org/search?q=${urlParams}&format=json&limit=1`
//     );
//     const lat = openStreetInfo.data[0].lat;
//     const lon = openStreetInfo.data[0].lon;
//     logger.info(
//       `✅ L'impianto risulta essere in queste coordinate di Latitudine: ${lat} e Longitudine: ${lon}`
//     );
//     // Ottengo tutti gli impianti nel range di 500 metri
//     const body = {
//       points: [{ lat: lat, lng: lon }],
//       radius: 0.5,
//     };
//     // Ottengo tutti gli impianti nel range di 500 metri
//     const proximityList = await axios.post(
//       `https://carburanti.mise.gov.it/ospzApi/search/zone`,
//       body
//     );
//     // Ordina i risultati per distanza crescente
//     const sortedResults = (proximityList?.data?.results || []).sort(
//       (a, b) => Number(a.distance) - Number(b.distance)
//     );
//     var itemList = [];
//     for (const item of sortedResults) {
//       // Ottengo i dati di ogni concorrente
//       const ossConcInfo = await axios.get(
//         `https://carburanti.mise.gov.it/ospzApi/registry/servicearea/${item.id}`
//       );
//       var final_item = {};
//       final_item.id = item.id;
//       final_item.name = ossConcInfo.data.name;
//       final_item.address = ossConcInfo.data.address;
//       final_item.brand = ossConcInfo.data.brand;
//       final_item.distance = Math.round(Number(item.distance) * 1000);
//       itemList.push(final_item);
//     }
//     logger.info(
//       `✅ Elenco degli impianti che sono stati rilevati nella stessa zona: ${JSON.stringify(
//         itemList,
//         null,
//         2
//       )}`
//     );
//     ossTracker.push({
//       id: ossID,
//       name: data.name,
//       address: data.address,
//       brand: data.brand,
//       concorrenti: itemList,
//     });
//   } else {
//     // L'impianto esiste correttamente
//     logger.info(`✅ Impianto ${ossID}: L'impianto esiste correttamente`);
//     insertLog(ossID, 4);
//     excelData.push({
//       ossID,
//       code: 4,
//       desc: "ID Impianto raggiunto, prezzo scaricato",
//       fuels: JSON.stringify(fuels),
//     });
//     const hasGas = await hasArticleGas(fuels);
//     for (const fuel of fuels) {
//       const article = await convertArticle(fuel.name);
//       // Se la tipologia è di tipo "SELF", carico due righe, per "SELF" e per "PREPAY"
//       if (fuel.isSelf) {
//         await insertFuels(ossID, fuel, article, "SELF");
//         await insertFuels(ossID, fuel, article, "PREPAY");
//       }
//       //Altrimenti, carico solo per "SERV"
//       else {
//         await insertFuels(ossID, fuel, article, "SERV");
//       }
//       // Se sto inserendo il prodotto "ART" ma l'impianto non presenta prodotti "GAS", vado a duplicare tutte le righe "ART" come "GAS"
//       if (article == "ART" && !hasGas) {
//         // Se la tipologia è di tipo "SELF", carico due righe, per "SELF" e per "PREPAY"
//         if (fuel.isSelf) {
//           await insertFuels(ossID, fuel, "GAS", "SELF");
//           await insertFuels(ossID, fuel, "GAS", "PREPAY");
//         }
//         //Altrimenti, carico solo per "SERV"
//         else {
//           await insertFuels(ossID, fuel, "GAS", "SERV");
//         }
//       }
//     }
//   }
// }
// // Aggiungo ogni riga raccolta nell'array
// excelData.forEach((item) => {
//   worksheet.addRow(item);
// });
// // Salva il workbook in un file Excel
// await workbook.xlsx.writeFile(excelLogPath);
// // Dopo aver inserito tutti i dati, chiudo la connessione e termino il processo
// logger.info("✅ Processo completato, chiudo la connessione al database...");
// const pool = await poolPromise;
// await pool.close(); // Chiude il pool di connessioni
// logger.info("🚀 Estrazione terminata con successo.", { mail_log: true });
// // Aspetta il prossimo tick per assicurarti che i log siano stati salvati in memoria
// await new Promise((resolve) => setImmediate(resolve));
// // Alla fine, recupera il riepilogo dei log
// const logSummary = memoryTransport.getLogSummary();
// // Devo verificare se la richiesta è valida per gli impianti di cui voglio cambiare la gestione dall'email.
// // Se secreKey+dataDiOggi corrisponde all'hash che si aspetta il server, la richiesta è autentica
// const today = new Date().toLocaleDateString("it-IT");
// const authHash = hashString(`${today}__${secretGen}`);
// // Invia il riepilogo via email
// try {
//   await sendLogSummary(
//     logSummary,
//     codesLog,
//     ossTracker,
//     authHash,
//     excelLogPath
//   );
//   logger.info("✅ Email inviata con il riepilogo dei log.");
// } catch (error) {
//   logger.error("❌ Errore nell'invio dell'email:", error);
// }
// logger.info("🚀 Script terminato con successo.");
// process.exit(0);
