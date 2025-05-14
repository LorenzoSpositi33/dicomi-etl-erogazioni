import "dotenv/config";
import crypto from "crypto";
import axios from "axios";
import { XMLValidator, XMLParser } from "fast-xml-parser";
import { sql, getDatabasePool } from "./db/db.js"
import { parse, startOfDay  } from 'date-fns';


if (!process.env.API_CRYPTO_KEY || !process.env.API_ROOT || !process.env.DB_TABLE_EROGAZIONI) {
  throw "Impostare tutte le variabili di ambiente";
}

// Variabili di ambiente
const API_CRYPTO_KEY = process.env.API_CRYPTO_KEY;
const API_ROOT = process.env.API_ROOT;
const API_RETISTA = process.env.API_RETISTA;
const DB_TABLE_EROGAZIONI = process.env.DB_TABLE_EROGAZIONI;

/**
 * ICAD_Hash
 *
 * Cifra il testo in input utilizzando 3DES (DES-EDE3) in modalità ECB con padding PKCS#7, per ottenere il token di autenticazione
 * utilizzato da ICAD per verificare le richieste API, derivando la chiave dalla variabile di ambiente `CRYPTO_KEY`.
 *
 * @param text - Il testo in chiaro da cifrare.
 * @returns La stringa cifrata, codificata in Base64.
 */
function ICAD_Hash(text: string) {
  // 1) calcola MD5 della chiave
  const md5 = crypto.createHash("md5");
  md5.update(Buffer.from(API_CRYPTO_KEY, "utf8"));
  const keyHash = md5.digest(); // 16 byte

  // 2) estendi a 24 byte (two-key 3DES = K1,K2,K1)
  const key24 = Buffer.concat([keyHash, keyHash.slice(0, 8)]);

  // 3) crea il cipher 3DES-ECB con padding PKCS7
  const cipher = crypto.createCipheriv("des-ede3-ecb", key24, null);
  cipher.setAutoPadding(true);

  // 4) cifra e restituisci in Base64
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function formattaErogazione(erogazione: any) {


  const DataOra = parse(String(erogazione.DATETIME), "dd/MM/yyyy HH:mm:ss", new Date());
  const DataCompetenza = startOfDay(DataOra);

  return {
    ImpiantoCodice: String(erogazione.IMPIANTO.codice),
    DataOra: DataOra as Date,
    DataCompetenza: DataCompetenza as Date,
    TipoDevice: String(erogazione.DEVICETYPE),
    ImpiantoLink: String(erogazione.IMPIANTO.link),
    ImpiantoNome: String(erogazione.IMPIANTO.nome),
    ImpiantoStoreID: String(erogazione.IMPIANTO.storeID),
    ImportoTot: Number(String(erogazione.IMPORTOTOT).replace(",", ".")),
    Litri: Number(String(erogazione.LITRI).replace(",", ".")),
    Tessera: String(erogazione.LOCALCARD),
    Lotto: Number(String(erogazione.LOTTO).replace(",", ".")),
    NumeroMovimento: Number(String(erogazione.NUMMOV).replace(",", ".")),
    TipoOperazione: String(erogazione.OPMODE),
    TipoPagamento: String(erogazione.PAYMODE),
    PompaPistola: Number(String(erogazione.POMPA.npistola).replace(",", ".")),
    PompaNumero: Number(String(erogazione.POMPA.npompa).replace(",", ".")),
    Prezzo: Number(String(erogazione.PREZZO).replace(",", ".")),
    ProdottoCodice: String(erogazione.PRODOTTO.codice),
    ProdottoNome: String(erogazione.PRODOTTO.nome),
    TipoCarta: String(erogazione.TIPOCARTA),
    TipoPrezzo: String(erogazione.TIPOPREZZO),
    TotaleEL: Number(String(erogazione.TOTAL_EL).replace(",", ".")),
    TotaleMEC: Number(String(erogazione.TOTAL_MEC).replace(",", ".")),
    NumeroTransazione: Number(String(erogazione.TRANSACTIONNUMBER).replace(",", ".")),
    ID_ICAD: Number(String(erogazione.ID).replace(",", "."))
  }
}

async function executeQuery(query: string) {

  try {
    const pool = await getDatabasePool();
    

    const result = await pool?.request().query(query);
    return result?.recordset;
  }
  catch (err) {
    throw `Errore nella query: ${err}`
  }
}

// Funziona che, dato un impianto codice di default 0 (tutti gli impianti), mi restituisce il relativo StoreID in array
async function getListStoreID(ImpiantoCodice = 0) {
  try {
    const response = await axios.get(`${API_ROOT}/impiantiInfo.xml`, {
      params: {
        retista: API_RETISTA,
        impianto: ImpiantoCodice,
        H: ICAD_Hash(`${API_RETISTA}${ImpiantoCodice}`),
      },
    });
    // Verifico status di response corretto
    const xmlBody = response.data;

    const result = XMLValidator.validate(xmlBody);
    if (result === true) {

      // Converto XML in JSON:
      const parser = new XMLParser();
      const json = parser.parse(xmlBody);

      const list = json.ArrayOfWrapImpianti.WrapImpianti;

      return list.map((item: any) => item.STOREID)

    } else {
      console.log(`Formato XML dell'anagrafica degli impianti ICAD non valido: ${result.err.msg}`, result);

    }
  } catch (error) {
    throw `Errore nella chiamata API: ${error}`
  }
}
async function getErogazioniList(storeID: string, icadID: number) {

  let ripeti = true;
  let lastIcadID = icadID;
  const listErogazioni = [];

  do {
    // Continuo a ricevere le informazioni di erogazione, andando sempre a prendere l'ultimo ID ritornato, finché non ricevo più dati
    // (tutte le erogazioni fino alla più recente sono state estratte)

    try {
      const response = await axios.get(`${API_ROOT}/erogazioniIDfilter.xml`, {
        params: {
          retista: API_RETISTA,
          impianto: storeID,
          ID: lastIcadID,
          H: ICAD_Hash(`${API_RETISTA}${storeID}${lastIcadID}`),

        }
      })
      // TODO: Dopo aver verificato lo status 200
      const xmlBody = response.data;
      const result = XMLValidator.validate(xmlBody);
      if (result !== true) {

         console.error("Formato XML delle erogazioni di ICAD NON valido");
         break;
      }
       
        // Converto XML in JSON:
        const parser = new XMLParser();
        const json = parser.parse(xmlBody);
        //console.log("Risposta: ", JSON.stringify(json, null, 2))

        // Ora che ho i dati ci sono delle opzioni
        // 1) Il dato è un array, quindi ci sono più erogazioni. Le aggiungo all'array finale e ripeto
        // 2) Il dato è un singolo elemento. Lo aggiungo all'array finale e ripeto (per sicurezza)
        // 3) il dato è un nullo. Non ci sono più dati da recuperare

        // Caso 1: Aggiungo le erogazioni alla lista e continuo
        if (Array.isArray(json.ArrayOfWrapErogazioni.WrapErogazioni)) {

          for (const item of json.ArrayOfWrapErogazioni.WrapErogazioni) {

            listErogazioni.push(formattaErogazione(item))
          }

          lastIcadID = json.ArrayOfWrapErogazioni.WrapErogazioni[json.ArrayOfWrapErogazioni.WrapErogazioni.length-1].ID

        }
        // Caso 2: Aggiungo la singola erogazione alla lista e continuo
        else if(json.ArrayOfWrapErogazioni !== '') {
          const item = json.ArrayOfWrapErogazioni.WrapErogazioni;

          listErogazioni.push(formattaErogazione(item))

          // Imposto l'icad ID come l'ID corrente.
          lastIcadID = item.ID;
        }
        // Caso 3: Non c'è più niente da estrarre, mi fermo
        else {
          console.info(`Estrazione terminata per lo store ${storeID}`)
          ripeti = false;
        }

      
    } catch (error) {
      ripeti = false;
      throw `Errore durante la chiamata API per estrarre le erogazioni: ${error}`
    }
  }
  while (ripeti);

  return listErogazioni;
}

// Otteniamo, per ogni impianto rilevato sul DB, l'ultima erogazione registrata
const lastIDList = await executeQuery(`SELECT
ImpiantoStoreID AS Impianto,
MAX(ID_ICAD) AS LAST_ID

FROM Dicomi_DB.dbo.Dicomi_Erogazioni

GROUP BY ImpiantoStoreID`)

const STORE_LASTID_MAP = [];

// Mapping degli impianti sul last_id nel DB
for (const item of lastIDList) {

  STORE_LASTID_MAP[item.Impianto] = item.LAST_ID
}

// Ottengo la lista di tutti gli store ID di Dicomi presenti in ICAD, per cui estrarre le erogazioni
const storeIDList = await getListStoreID();

for (const storeID of storeIDList) {
  console.log(`Elaborazione dello Store: ${storeID} in corso... `)

  // Ottengo l'ultimo ID erogato per lo store, oppure undefined se non esiste
  const lastIcadID = STORE_LASTID_MAP[storeID]

  // Se lo store non esiste, sollevo un errore e salto lo store
  if (!lastIcadID) {
    console.error("STORE ID NON TROVATO")
    continue;
  }
  else {
    console.info(`Ultimo ICAD ID rilevato: ${lastIcadID}`)
  }

  //API verso ICAD per ottenere tutte le erogazioni dell'impianto in questione
  const erogazioniList = await getErogazioniList(storeID, lastIcadID)

  console.log(`Erogazioni Estratte: ${erogazioniList.length}`)

  //ciclo sulle erogazioni
  // insert nel DB
  for(const erogazione of erogazioniList){

    const pool = await getDatabasePool();

    const query = `
    INSERT INTO Dicomi_DB.dbo.Dicomi_Erogazioni 
    (
      ImpiantoCodice, 
      DataOra,
      DataCompetenza,
      TipoDevice,
      ImpiantoLink,
      ImpiantoNome,
      ImpiantoStoreID,
      ImportoTot,
      Litri,
      Tessera,
      Lotto,
      NumeroMovimento,
      TipoOperazione,
      TipoPagamento,
      PompaPistola,
      PompaNumero,
      Prezzo,
      ProdottoCodice,
      ProdottoNome,
      TipoCarta,
      TipoPrezzo,
      TotaleEL,
      TotaleMEC,
      NumeroTransazione,
      ID_ICAD
    )
      VALUES
    (
      @ImpiantoCodice, 
      @DataOra,
      @DataCompetenza,
      @TipoDevice,
      @ImpiantoLink,
      @ImpiantoNome,
      @ImpiantoStoreID,
      @ImportoTot,
      @Litri,
      @Tessera,
      @Lotto,
      @NumeroMovimento,
      @TipoOperazione,
      @TipoPagamento,
      @PompaPistola,
      @PompaNumero,
      @Prezzo,
      @ProdottoCodice,
      @ProdottoNome,
      @TipoCarta,
      @TipoPrezzo,
      @TotaleEL,
      @TotaleMEC,
      @NumeroTransazione,
      @ID_ICAD
    )`

    const result = await 
    pool.request()
    .input("ImpiantoCodice", sql.NVarChar, erogazione.ImpiantoCodice)
    .input("DataOra", sql.DateTime, erogazione.DataOra)
    .input("DataCompetenza", sql.DateTime, erogazione.DataCompetenza)
    .input("TipoDevice", sql.NVarChar, erogazione.TipoDevice)
    .input("ImpiantoLink", sql.NVarChar, erogazione.ImpiantoLink)
    .input("ImpiantoNome", sql.NVarChar, erogazione.ImpiantoNome)
    .input("ImpiantoStoreID", sql.NVarChar, erogazione.ImpiantoStoreID)
    .input("ImportoTot", sql.Money, erogazione.ImportoTot)
    .input("Litri", sql.Decimal, erogazione.Litri)
    .input("Tessera", sql.NVarChar, erogazione.Tessera)
    .input("Lotto", sql.Int, erogazione.Lotto)
    .input("NumeroMovimento", sql.Int, erogazione.NumeroMovimento)
    .input("TipoOperazione", sql.NVarChar, erogazione.TipoOperazione)
    .input("TipoPagamento", sql.NVarChar, erogazione.TipoPagamento)
    .input("PompaPistola", sql.Int, erogazione.PompaPistola)
    .input("PompaNumero", sql.Int, erogazione.PompaNumero)
    .input("Prezzo", sql.Money, erogazione.Prezzo)
    .input("ProdottoCodice", sql.NVarChar, erogazione.ProdottoCodice)
    .input("ProdottoNome", sql.NVarChar, erogazione.ProdottoNome)
    .input("TipoCarta", sql.NVarChar, erogazione.TipoCarta)
    .input("TipoPrezzo", sql.NVarChar, erogazione.TipoPrezzo)
    .input("TotaleEL", sql.Int, erogazione.TotaleEL)
    .input("TotaleMEC", sql.Int, erogazione.TotaleMEC)
    .input("NumeroTransazione", sql.BigInt, erogazione.NumeroTransazione)
    .input("ID_ICAD", sql.BigInt, erogazione.ID_ICAD)
    .query(query);
  }

  // TODO 1) Ottengo l'elenco degli impianti di ICAD attuali dalla loro API
  // API verso {API_ROOT}/impiantiInfo.xml? retista=10006 & impianto=0 & H= ICAD_Hash(retista+impianto)

  // TODO 2) Dalla lista ricevuta, estraggo in un array [] l'elenco degli STOREID
  // storeIDList = [...]

  // TODO 3) Dall'array storeIDList, faccio un loop per ogni elemento
  // for (storeID in storeIDList ) { .... }

  // ... Mi fermo momentaneamente ...

  // TODO 4) Per ogni storeID, interagisco con il DB e ottengo l'ultimo ID_ICAD dalla tabella DICOMI_Erogazioni per lo storeID in corso.
  // lastIcadID = SELECT MAX(ID_ICAD) FROM Dicomi_DB.dbo.DICOMI_Erogazioni WHERE ImpiantoStoreID = {storeID}

  // TODO 5) Ottengo l'elenco di erogazioni mancanti dall'ultimo ID ICAD presente nel DB in poi con le API di ICAD
  // API verso {API_ROOT}/erogazioniIDfilter.xml? retista=10006 & impianto={storeID} & H= ICAD_HASH(retista+storeID+IcadID)

  // TODO 6) Eseguo un controllo. Prendo il campo TIPOPREZZO e il campo OPMODE, e li cerco nella tabella DB Dicomi_DB.dbo.TipoOperazioneSellout. Se non lo trovo, o trovo N/A, alzo un warning
  // IF( tipoOperazione = SELECT TipoOperazione FROM Dicomi_DB.dbo.DICOMI_TipiOperazioneSellout WHERE TipoOperazioneSellout = {OPMODE} AND TipoPrezzoSellout = {TIPOPREZZO} ) == 'N/A' OR *non contiene elementi* -> warning

  // TODO 7) Inserisco nel DB la riga di erogazione con tutti i parametri estratti dalle API ed eventuali (se necessarie) elaborazioni del dato
  // INSERT INTO Dicomi_DB.dbo.Erogazioni (ImpiantoCodice, DataOra, DataCompetenza, TipoDevice, ImpiantoLink, ... ) VALUES ('x', '2025-05-01', z, a, b, ...)

  // TODO 8) Gestisco tutti gli eventuali errori che ricevo dal DB e alzo un warning
  // try { ... } catch (err) { logger.error("Errore durante l'operazione con il DB: ", err) }

  // TODO 9) Gestisco tutti gli eventuali errori che ricevo dalle interazioni API con ICAD
  // try { ... } catch (err) { logger.error("Errore durante l'interazione con le API di ICAD: ", err) }

  // Make a request for a user with a given ID

  // TODO Creo una funzione "getImpiantiInfo" che, passato il parametro "ImpiantoCodice" ti ritorna i dati. Se impiantoCodice = 0, ti ritorna tutti gli impianti
}