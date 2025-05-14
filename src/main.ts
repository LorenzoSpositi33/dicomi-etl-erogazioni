import "dotenv/config";
import crypto from "crypto";
import axios from "axios";
import { XMLValidator, XMLParser } from "fast-xml-parser";

if (!process.env.API_CRYPTO_KEY || !process.env.API_ROOT) {
  throw "Impostare tutte le variabili di ambiente";
}

// Variabili di ambiente
const API_CRYPTO_KEY = process.env.API_CRYPTO_KEY;
const API_ROOT = process.env.API_ROOT;
const API_RETISTA = process.env.API_RETISTA;

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

// TODO: 1) Ottengo l'elenco degli impianti di ICAD attuali dalla loro API
// API verso {API_ROOT}/impiantiInfo.xml? retista=10006 & impianto=0 & H= ICAD_Hash(retista+impianto)

// TODO 2) Dalla lista ricevuta, estraggo in un array [] l'elenco degli STOREID
// storeIDList = [...]

// TODO 3) Dall'array storeIDList, faccio un loop per ogni elemento
// for (storeID in storeIDList ) { .... }

// ... Mi fermo momentaneamente ...

// TODO 4) Per ogni storeID, interagisco con il DB e ottengo l'ultimo ID_ICAD dalla tabella DICOMI_Erogazioni per lo storeID in corso.
// lastIcadID = SELECT MAX(ID_ICAD) FROM Dicomi_DB.dbo.DICOMI_Erogazioni WHERE ImpiantoStoreID = {storeID}

// TODO 5) Ottengo l'elenco di erogazioni mancanti dall'ultimo ID ICAD presente nel DB in poi con le API di ICAD
// API verso {API_ROOT}/erogazioniIDfilter.xml? retista=10006 & impianto={storeID} & H= ICAD_HASH(retista+impianto+storeID)

// TODO 6) Eseguo un controllo. Prendo il campo TIPOPREZZO e il campo OPMODE, e li cerco nella tabella DB Dicomi_DB.dbo.TipoOperazioneSellout. Se non lo trovo, o trovo N/A, alzo un warning
// IF( tipoOperazione = SELECT TipoOperazione FROM Dicomi_DB.dbo.DICOMI_TipiOperazioneSellout WHERE TipoOperazioneSellout = {OPMODE} AND TipoPrezzoSellout = {TIPOPREZZO} ) == 'N/A' OR *non contiene elementi* -> warning

// TODO 7) Inserisco nel DB la riga di erogazione con tutti i parametri estratti dalle API ed eventuali (se necessarie) elaborazioni del dato
// INSERT INTO Dicomi_DB.dbo.Erogazioni (ImpiantoCodice, DataOra, DataCompetenza, TipoDevice, ImpiantoLink, ... ) VALUES (x, y, z, a, b, ...)

// TODO 8) Gestisco tutti gli eventuali errori che ricevo dal DB e alzo un warning
// try { ... } catch (err) { logger.error("Errore durante l'operazione con il DB: ", err) }

// TODO 9) Gestisco tutti gli eventuali errori che ricevo dalle interazioni API con ICAD
// try { ... } catch (err) { logger.error("Errore durante l'interazione con le API di ICAD: ", err) }

// Make a request for a user with a given ID

// TODO: Creo una funzione "getImpiantiInfo" che, passato il parametro "ImpiantoCodice" ti ritorna i dati. Se impiantoCodice = 0, ti ritorna tutti gli impianti

try {
  const response = await axios.get(`${API_ROOT}/impiantiInfo.xml`, {
    params: {
      retista: API_RETISTA,
      impianto: 0,
      H: "y/X0X/IG1fU=",
    },
  });
  // Verifico status di response corretto
  const xmlBody = response.data;

  const result = XMLValidator.validate(xmlBody);
  if (result === true) {
    console.log(`Formato XML valido: `, result);

    // Converto XML in JSON:
    const parser = new XMLParser();
    const json = parser.parse(xmlBody);

    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(`Formato XML non valido: ${result.err.msg}`, result);
  }

  //TODO : Mi informo su come elaborare l'XML in node.js
} catch (error) {
  console.error(error);
}
