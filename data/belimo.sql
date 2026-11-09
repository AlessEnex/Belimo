-- Valve & Actuator Selector - base dati
-- Fonte unica dei dati: questo file viene eseguito nel browser con sql.js (SQLite).
-- Per modificare regole/articoli si edita questo file (niente JSON).

PRAGMA foreign_keys = ON;

CREATE TABLE impostazioni (
  chiave TEXT PRIMARY KEY,
  valore TEXT NOT NULL
);

CREATE TABLE modelli (
  codice    TEXT PRIMARY KEY,
  etichetta TEXT NOT NULL,
  ordine    INTEGER NOT NULL
);

CREATE TABLE kit (
  codice      TEXT PRIMARY KEY,
  descrizione TEXT NOT NULL
);

CREATE TABLE adattatori (
  codice      TEXT PRIMARY KEY,
  descrizione TEXT NOT NULL
);

CREATE TABLE attuatori (
  codice        TEXT PRIMARY KEY,
  descrizione   TEXT NOT NULL,
  brand         TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('ON-OFF', 'MODULANTE')),
  nm            INTEGER,
  alimentazione TEXT
);

-- Anagrafica valvole. 'serie' = famiglia di appartenenza.
-- connessioni: materiale degli attacchi (NON del corpo). 'INOX/K65' = valvola IBRIDA:
-- un lato inox, l'altro K65. Le ibride esistono solo 2-vie (vedi trigger sotto).
-- corpo: materiale del corpo valvola (INOX / OTTONE), NULL = non ancora censito.
CREATE TABLE valvole (
  codice       TEXT PRIMARY KEY,
  descrizione  TEXT NOT NULL,
  marca        TEXT,
  serie        TEXT,
  connessioni  TEXT,
  disponibile  INTEGER NOT NULL DEFAULT 1 CHECK (disponibile IN (0, 1)),
  note         TEXT,
  corpo        TEXT CHECK (corpo IN ('INOX', 'OTTONE'))
);

-- Una riga = modello valvola + tipologia attuatore + misura.
CREATE TABLE accoppiamenti (
  id           INTEGER PRIMARY KEY,
  modello      TEXT NOT NULL REFERENCES modelli(codice),
  tipologia    TEXT NOT NULL,
  misura       TEXT NOT NULL,
  valvola_2vie TEXT REFERENCES valvole(codice),
  valvola_3vie TEXT REFERENCES valvole(codice),
  UNIQUE (modello, tipologia, misura)
);

-- Opzioni di motorizzazione della riga: adattatore + kit + attuatore.
-- La marca dell'attuatore (BELIMO, WATERGATE...) è attuatori.brand: è lei a
-- distinguere le alternative, non il modello valvola.
-- adattatore NULL = non richiesto (es. Watergate).
-- vie NULL = vale per 2 e 3 vie.
-- navale = 1: su macchina navale il kit viene sostituito da impostazioni.kit_navale.
CREATE TABLE opzioni (
  accoppiamento_id INTEGER NOT NULL REFERENCES accoppiamenti(id),
  ordine           INTEGER NOT NULL,
  adattatore       TEXT REFERENCES adattatori(codice),
  kit              TEXT NOT NULL REFERENCES kit(codice),
  attuatore        TEXT NOT NULL REFERENCES attuatori(codice),
  vie              TEXT CHECK (vie IN ('2', '3')),
  navale           INTEGER NOT NULL DEFAULT 0 CHECK (navale IN (0, 1)),
  PRIMARY KEY (accoppiamento_id, ordine)
);

-- Solo le 2-vie possono essere ibride
CREATE TRIGGER no_ibrida_3vie_ins BEFORE INSERT ON accoppiamenti
WHEN NEW.valvola_3vie IN (SELECT codice FROM valvole WHERE connessioni = 'INOX/K65')
BEGIN SELECT RAISE(ABORT, 'Valvola ibrida (INOX/K65) non ammessa come 3-vie'); END;
CREATE TRIGGER no_ibrida_3vie_upd BEFORE UPDATE OF valvola_3vie ON accoppiamenti
WHEN NEW.valvola_3vie IN (SELECT codice FROM valvole WHERE connessioni = 'INOX/K65')
BEGIN SELECT RAISE(ABORT, 'Valvola ibrida (INOX/K65) non ammessa come 3-vie'); END;

CREATE TABLE punti_impianto (
  nome   TEXT PRIMARY KEY,
  ordine INTEGER NOT NULL,
  info   TEXT
);

-- Combinazioni senza valvola confermate come inesistenti (non sono buchi da colmare).
CREATE TABLE misure_inesistenti (
  modello   TEXT NOT NULL REFERENCES modelli(codice),
  tipologia TEXT NOT NULL,
  misura    TEXT NOT NULL,
  vie       TEXT NOT NULL CHECK (vie IN ('2', '3')),
  nota      TEXT,
  PRIMARY KEY (modello, tipologia, misura, vie)
);


-- ============ IMPOSTAZIONI ============
INSERT INTO impostazioni VALUES ('fonte', 'TABELLA ACCOPPIAMENTI VALVOLE-MOTORI v3 + censimento GMC 2026-11');
INSERT INTO impostazioni VALUES ('kit_navale', '25C162C');

-- ============ PUNTI IMPIANTO ============
INSERT INTO punti_impianto VALUES ('HR1', 1, NULL);
INSERT INTO punti_impianto VALUES ('HR2', 2, NULL);
INSERT INTO punti_impianto VALUES ('Gascooler', 3, NULL);
INSERT INTO punti_impianto VALUES ('Intercooler', 4, NULL);
INSERT INTO punti_impianto VALUES ('Linea liquida', 5, NULL);
INSERT INTO punti_impianto VALUES ('Aspirazione AUX', 6, NULL);
INSERT INTO punti_impianto VALUES ('Collettore AUX-PDC', 7, 'Questa configurazione si riferisce a quando ci sono circuiti con pompa di calore o aria condizionata che richiedono un motore sul collettore di aspirazione che divide due bancate di compressori');
INSERT INTO punti_impianto VALUES ('BYPASS EMERGENZA RECUPERI MONTE', 8, NULL);
INSERT INTO punti_impianto VALUES ('BYPASS EMERGENZA RECUPERI VALLE', 9, NULL);
INSERT INTO punti_impianto VALUES ('ALIMENTAZIONE EVAPORATORI', 10, NULL);
INSERT INTO punti_impianto VALUES ('MANDATA DEFROST', 11, NULL);
INSERT INTO punti_impianto VALUES ('MANDATA LIQUIDA PER POMPA DI CALORE', 12, NULL);

-- ============ MODELLI ============
INSERT INTO modelli VALUES ('GMC', 'GMC', 1);
INSERT INTO modelli VALUES ('GMC SCHRADER', 'GMC Schrader', 2);
INSERT INTO modelli VALUES ('GMC IBRIDA', 'GMC Ibrida (conn. inox / K65, solo 2-vie)', 3);
INSERT INTO modelli VALUES ('REF', 'REF (corpo ottone)', 4);

-- ============ KIT ============
INSERT INTO kit VALUES ('25C491A', 'KIT ATT. VAL. SFERA CO2 20 Nm GMC ambv1 10/15mm');
INSERT INTO kit VALUES ('25C4910', 'KIT ATT. VAL. SFERA CO2 20 Nm GMC ambv2 22/28mm');
INSERT INTO kit VALUES ('25C4920', 'KIT ATT. VAL. SFERA CO2 40 Nm GMC ambv4 35/42/48mm');
INSERT INTO kit VALUES ('25C492A', 'KIT ATT. VAL. SFERA CO2 90 Nm GMC ambv5 60mm');
INSERT INTO kit VALUES ('25C270B', 'KIT ATT. VAL. SFERA 20 Nm 10/15mm');
INSERT INTO kit VALUES ('25C5040', 'KIT ATT. VAL. SFERA 20 Nm 22/28mm');
INSERT INTO kit VALUES ('25C5030', 'KIT ATT. VAL. SFERA 40 Nm 22/28mm');
INSERT INTO kit VALUES ('25C162A', 'KIT ATT. VAL. SFERA 40 Nm 35/42mm');
INSERT INTO kit VALUES ('25C162C', 'KIT ATT. VAL. SFERA 40 Nm INOX-NAVI');
INSERT INTO kit VALUES ('25C4660', 'KIT ATT. VAL. SFERA 2-VIE 160Nm 60mm');
INSERT INTO kit VALUES ('25C162B', 'KIT ATT. VAL. SFERA 3-VIE 160Nm 60mm');
INSERT INTO kit VALUES ('25C270D', 'KIT ATT. VAL. WATERGATE 16mm');

-- ============ ADATTATORI ============
INSERT INTO adattatori VALUES ('25C201D', 'ADATT. PERNO GR 9x9 mm');
INSERT INTO adattatori VALUES ('25C201C', 'ADATT. PERNO GR 14x14 mm');
INSERT INTO adattatori VALUES ('25C201N', 'ADATT. PERNO Belimo 90Nm e 160Nm');

-- ============ ATTUATORI ============
INSERT INTO attuatori VALUES ('25C201P', 'ATTUATORE 20 Nm PER VAL. HP', 'BELIMO', 'ON-OFF', 20, '230V');
INSERT INTO attuatori VALUES ('25C348A', 'ATTUATORE 20 Nm VAL. HP MODULANTE', 'BELIMO', 'MODULANTE', 20, '24V');
INSERT INTO attuatori VALUES ('25C201Q', 'ATTUATORE 40 Nm PER VAL. HP', 'BELIMO', 'ON-OFF', 40, '230V');
INSERT INTO attuatori VALUES ('25C201F', 'ATTUATORE 40 Nm PER VAL. HP MODULANTE', 'BELIMO', 'MODULANTE', 40, '24V');
INSERT INTO attuatori VALUES ('25C201R', 'ATTUATORE 90 Nm BELIMO ON-OFF', 'BELIMO', 'ON-OFF', 90, '230V');
INSERT INTO attuatori VALUES ('25C392A', 'ATTUATORE 160Nm 35sec 230V IP66 On-Off', 'BELIMO', 'ON-OFF', 160, '230V');
INSERT INTO attuatori VALUES ('25C4670', 'ATTUATORE 160Nm BAC x VAL.HP2'''' MODULANTE', 'BELIMO', 'MODULANTE', 160, '24V');
INSERT INTO attuatori VALUES ('25C3030', 'ATTUATORE WATERGATE ON-OFF', 'WATERGATE', 'ON-OFF', NULL, NULL);
INSERT INTO attuatori VALUES ('25C303A', 'ATTUATORE WATERGATE MODULANTE 24V DC', 'WATERGATE', 'MODULANTE', NULL, '24V DC');
INSERT INTO attuatori VALUES ('25C303B', 'ATTUATORE WATERGATE MODULANTE 230V AC', 'WATERGATE', 'MODULANTE', NULL, '230V AC');

-- ============ VALVOLE ============
INSERT INTO valvole VALUES ('25C176B', 'VAL. SFERA 12 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, 'INOX GMC NO spillo', NULL);
INSERT INTO valvole VALUES ('25C4480', 'VAL. SFERA 16 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, 'NO spillo', NULL);
INSERT INTO valvole VALUES ('25C281C', 'VAL. 3-VIE 16 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4490', 'VAL. SFERA 22 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, 'NO spillo', NULL);
INSERT INTO valvole VALUES ('25C281D', 'VAL. 3-VIE 22 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4500', 'VAL. SFERA 28 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C281E', 'VAL. 3-VIE 28 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4510', 'VAL. SFERA 35 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C281F', 'VAL. 3-VIE 35 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4520', 'VAL. SFERA 42 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C281B', 'VAL. 3-VIE 42 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C452B', 'VAL. SFERA 48 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, 'BVM48HP', NULL);
INSERT INTO valvole VALUES ('25C281G', 'VAL. 3-VIE 48 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C452C', 'VAL. SFERA 60 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, 'BVM60HP', NULL);
INSERT INTO valvole VALUES ('25C281H', 'VAL. 3-VIE 60 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C1751', 'VAL. SFERA 16 mm 140 BAR REF', 'REFRIGERA', NULL, NULL, 1, 'Gestionale: FULL BODY INOX', 'INOX');
INSERT INTO valvole VALUES ('25C3080', 'VAL. 3-VIE CO2 16 mm 140 BAR REF', 'REFRIGERA', NULL, NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C0080', 'VAL. SFERA 304L CO2 1/2" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0150', 'VAL. 3-VIE 304L 1/2" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0070', 'VAL. SFERA 304L CO2 3/4" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0110', 'VAL. 3-VIE 304L 3/4" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0050', 'VAL. SFERA 304L CO2 1" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0100', 'VAL. 3-VIE 304L 1" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0060', 'VAL. SFERA 304L CO2 1 1/4" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0090', 'VAL. 3-VIE 304L 1 1/4" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C3690', 'VAL. SFERA 304L CO2 1 1/2" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0310', 'VAL. 3-VIE 304L 1 1/2" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C369A', 'VAL. SFERA 304L CO2 2" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C009A', 'VAL. 3-VIE 304L 2" 130 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C2660', 'VAL. SFERA 42 mm 120 BAR', 'REFRIGERA', NULL, NULL, 1, 'Gestionale: INOX - CORPO OTTONE', 'OTTONE');
INSERT INTO valvole VALUES ('25C2810', 'VAL. 3-VIE CO2 42 mm 120 BAR', 'REFRIGERA', NULL, NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C038A', 'VAL. 3-VIE 16 mm 140 BAR V-PORT REFRIGERA', 'REFRIGERA', NULL, NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C0440', 'VAL. 3-VIE 304L 1/2" 130 BAR V-PORT', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C007C', 'VAL. SFERA 304L CO2 3/4" MODULANTE', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C007B', 'VAL. 3-VIE 304L 3/4" 130 BAR V-PORT', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C005B', 'VAL. SFERA 304L CO2 1" 130 BAR MODULANTE', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C0420', 'VAL. 3-VIE 304L 1" 130 BAR V-PORT', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C006B', 'VAL. 2-VIE CO2 1 1/4" 130 BAR MODULANTE', 'REFRIGERA', NULL, NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C010B', 'VAL. 3-VIE 304L 1 1/4" 130 BAR V-PORT', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C010E', 'VAL. 2-VIE CO2 1 1/2" 120 BAR MODULANTE', 'REFRIGERA', NULL, NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C010D', 'VAL. 3-VIE 304L 1 1/2" 130 BAR V-PORT', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C369L', 'VAL. SFERA 304L CO2 2" 130 BAR MODULANTE', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C4390', 'VAL. 3-VIE 304L 2" 130 BAR V-PORT', 'REFRIGERA', NULL, NULL, 1, NULL, 'INOX');
INSERT INTO valvole VALUES ('25C038F', 'VAL. 3-VIE 42 mm 140 BAR V-PORT REFRIGERA', 'REFRIGERA', NULL, NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C1800', 'VAL. SFERA 10 mm 140 BAR GMC', 'GMC', 'GMC 140 bar', NULL, 1, 'Inox NO spillo', NULL);
INSERT INTO valvole VALUES ('25C4580', 'VAL. SFERA 12 mm 140 BAR SCHRADER GMC', 'GMC', 'GMC 140 bar Schrader', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4530', 'VAL. SFERA 16 mm 140 BAR SCHRADER GMC', 'GMC', 'GMC 140 bar Schrader', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4540', 'VAL. SFERA 22 mm 140 BAR SCHRADER GMC', 'GMC', 'GMC 140 bar Schrader', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4550', 'VAL. SFERA 28 mm 140 BAR SCHRADER GMC', 'GMC', 'GMC 140 bar Schrader', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4560', 'VAL. SFERA 35 mm 140 BAR SCHRADER GMC', 'GMC', 'GMC 140 bar Schrader', NULL, 1, 'BV11AHP', NULL);
INSERT INTO valvole VALUES ('25C4570', 'VAL. SFERA 42 mm 140 BAR SCHRADER GMC', 'GMC', 'GMC 140 bar Schrader', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4590', 'VAL. SFERA 16 mm 130 BAR IBRIDA GMC', 'GMC', 'GMC 130 bar Ibrida', 'INOX/K65', 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4600', 'VAL. SFERA 22 mm 130 BAR IBRIDA GMC', 'GMC', 'GMC 130 bar Ibrida', 'INOX/K65', 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4610', 'VAL. SFERA 28 mm 130 BAR IBRIDA GMC', 'GMC', 'GMC 130 bar Ibrida', 'INOX/K65', 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4620', 'VAL. SFERA 35 mm 130 BAR IBRIDA GMC', 'GMC', 'GMC 130 bar Ibrida', 'INOX/K65', 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C4630', 'VAL. SFERA 42 mm 130 BAR IBRIDA GMC', 'GMC', 'GMC 130 bar Ibrida', 'INOX/K65', 1, NULL, NULL);
INSERT INTO valvole VALUES ('25C463C', 'VAL. SFERA 60 mm 130 BAR IBRIDA GMC', 'GMC', 'GMC 130 bar Ibrida', 'INOX/K65', 1, '60 mm inox, 54 mm K65', NULL);
INSERT INTO valvole VALUES ('25C463B', 'VAL. SFERA 48 mm 130 BAR IBRIDA GMC', 'GMC', 'GMC 130 bar Ibrida', 'INOX/K65', 0, 'Non esiste, usare ibrida da 60 mm inox (25C463C)', NULL);
-- REF 304L (lista utente 2026-11-09)
INSERT INTO valvole VALUES ('25C369E', 'VAL. SFERA 304L CO2 2.1/2" 130 BAR', 'REFRIGERA', NULL, NULL, 0, 'Codice presente a gestionale ma NON ancora ordinabile. Nessun kit per 2.1/2" (DN65) in anagrafica', 'INOX');
INSERT INTO valvole VALUES ('25C0710', 'VAL. SFERA 304L CO2 22 120BAR MODULANTE', 'REFRIGERA', NULL, NULL, 1, 'REF1.1.N.C.N22.MP120M. Accoppiamento come 3/4" (confermato 2026-11-09)', 'INOX');
INSERT INTO valvole VALUES ('25C1080', 'VAL. SFERA 22 mm 140 BAR Ref', 'REFRIGERA', NULL, NULL, 1, '2-vie corpo ottone (confermato utente 2026-11-09). Gestionale: INOX - corpo OTTONE. Accoppiamento da confermare', 'OTTONE');

-- OLAB (new entry 2026-11-09): corpo e attacchi inox, accoppiamenti non ancora definiti
INSERT INTO valvole VALUES ('25C4487', 'VALVOLA A SFERA 22 mm 150 BAR OLAB', 'OLAB', 'OLAB 150 bar', 'INOX', 1, 'Kit di accoppiamento e attuatore preferenziale da definire', 'INOX');
INSERT INTO valvole VALUES ('25C4486', 'VALVOLA A SFERA 42 mm 150 BAR OLAB', 'OLAB', 'OLAB 150 bar', 'INOX', 1, 'Kit di accoppiamento e attuatore preferenziale da definire', 'INOX');
INSERT INTO valvole VALUES ('25C4481', 'VALVOLA A SFERA 48 mm 150 BAR OLAB', 'OLAB', 'OLAB 150 bar', 'INOX', 1, 'Kit di accoppiamento e attuatore preferenziale da definire', 'INOX');
INSERT INTO valvole VALUES ('25C4482', 'VALVOLA A SFERA 60 mm 150 BAR OLAB', 'OLAB', 'OLAB 150 bar', 'INOX', 1, 'Kit di accoppiamento e attuatore preferenziale da definire', 'INOX');
INSERT INTO valvole VALUES ('030800571', 'VAL. 3-VIE V-SHAPE OLAB 24MM', 'OLAB', 'OLAB V-SHAPE', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('030800572', 'VAL. 3-VIE V-SHAPE OLAB 28MM', 'OLAB', 'OLAB V-SHAPE', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('030800573', 'VAL. 3-VIE V-SHAPE OLAB 37MM', 'OLAB', 'OLAB V-SHAPE', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('030800574', 'VAL. 3-VIE V-SHAPE OLAB 46MM', 'OLAB', 'OLAB V-SHAPE', NULL, 1, NULL, NULL);
INSERT INTO valvole VALUES ('030800575', 'VAL. 3-VIE V-SHAPE OLAB 73MM', 'OLAB', 'OLAB V-SHAPE', NULL, 1, NULL, NULL);

-- ============ ACCOPPIAMENTI + OPZIONI ============
-- Ogni opzione = adattatore + kit + attuatore. La marca attuatore (Belimo / Watergate)
-- è una scelta sulla stessa valvola; Watergate non richiede adattatore.
-- Regola GMC (tutte le serie BVM HP: standard, Schrader, Ibrida), solo Belimo:
--   10-16 mm -> kit 25C491A (AMBV1) + adatt. 25C201D (9x9)  + 25C201P 20 Nm
--   22-28 mm -> kit 25C4910 (AMBV2) + adatt. 25C201D (9x9)  + 25C201P 20 Nm
--   35-48 mm -> kit 25C4920 (AMBV4) + adatt. 25C201C (14x14)+ 25C201Q 40 Nm
--   60 mm    -> kit 25C492A (AMBV5) + adatt. 25C201N        + 25C201R 90 Nm
-- REF 22 mm modulante (25C0710): stessa regola del 3/4" (confermato 2026-11-09).

-- GMC · NON MODULANTI
INSERT INTO accoppiamenti VALUES (1, 'GMC', 'NON MODULANTI', '10 mm', '25C1800', NULL);
INSERT INTO opzioni VALUES (1, 1, '25C201D', '25C491A', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (2, 'GMC', 'NON MODULANTI', '12 mm', '25C176B', NULL);
INSERT INTO opzioni VALUES (2, 1, '25C201D', '25C491A', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (3, 'GMC', 'NON MODULANTI', '16 mm', '25C4480', '25C281C');
INSERT INTO opzioni VALUES (3, 1, '25C201D', '25C491A', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (4, 'GMC', 'NON MODULANTI', '22 mm', '25C4490', '25C281D');
INSERT INTO opzioni VALUES (4, 1, '25C201D', '25C4910', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (5, 'GMC', 'NON MODULANTI', '28 mm', '25C4500', '25C281E');
INSERT INTO opzioni VALUES (5, 1, '25C201D', '25C4910', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (6, 'GMC', 'NON MODULANTI', '35 mm', '25C4510', '25C281F');
INSERT INTO opzioni VALUES (6, 1, '25C201C', '25C4920', '25C201Q', NULL, 0);
INSERT INTO accoppiamenti VALUES (7, 'GMC', 'NON MODULANTI', '42 mm', '25C4520', '25C281B');
INSERT INTO opzioni VALUES (7, 1, '25C201C', '25C4920', '25C201Q', NULL, 0);
INSERT INTO accoppiamenti VALUES (8, 'GMC', 'NON MODULANTI', '48 mm', '25C452B', '25C281G');
INSERT INTO opzioni VALUES (8, 1, '25C201C', '25C4920', '25C201Q', NULL, 0);
INSERT INTO accoppiamenti VALUES (9, 'GMC', 'NON MODULANTI', '60 mm', '25C452C', '25C281H');
INSERT INTO opzioni VALUES (9, 1, '25C201N', '25C492A', '25C201R', NULL, 0);

-- GMC SCHRADER · NON MODULANTI
INSERT INTO accoppiamenti VALUES (10, 'GMC SCHRADER', 'NON MODULANTI', '12 mm', '25C4580', NULL);
INSERT INTO opzioni VALUES (10, 1, '25C201D', '25C491A', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (11, 'GMC SCHRADER', 'NON MODULANTI', '16 mm', '25C4530', NULL);
INSERT INTO opzioni VALUES (11, 1, '25C201D', '25C491A', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (12, 'GMC SCHRADER', 'NON MODULANTI', '22 mm', '25C4540', NULL);
INSERT INTO opzioni VALUES (12, 1, '25C201D', '25C4910', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (13, 'GMC SCHRADER', 'NON MODULANTI', '28 mm', '25C4550', NULL);
INSERT INTO opzioni VALUES (13, 1, '25C201D', '25C4910', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (14, 'GMC SCHRADER', 'NON MODULANTI', '35 mm', '25C4560', NULL);
INSERT INTO opzioni VALUES (14, 1, '25C201C', '25C4920', '25C201Q', NULL, 0);
INSERT INTO accoppiamenti VALUES (15, 'GMC SCHRADER', 'NON MODULANTI', '42 mm', '25C4570', NULL);
INSERT INTO opzioni VALUES (15, 1, '25C201C', '25C4920', '25C201Q', NULL, 0);

-- GMC IBRIDA · NON MODULANTI
INSERT INTO accoppiamenti VALUES (16, 'GMC IBRIDA', 'NON MODULANTI', '16 mm', '25C4590', NULL);
INSERT INTO opzioni VALUES (16, 1, '25C201D', '25C491A', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (17, 'GMC IBRIDA', 'NON MODULANTI', '22 mm', '25C4600', NULL);
INSERT INTO opzioni VALUES (17, 1, '25C201D', '25C4910', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (18, 'GMC IBRIDA', 'NON MODULANTI', '28 mm', '25C4610', NULL);
INSERT INTO opzioni VALUES (18, 1, '25C201D', '25C4910', '25C201P', NULL, 0);
INSERT INTO accoppiamenti VALUES (19, 'GMC IBRIDA', 'NON MODULANTI', '35 mm', '25C4620', NULL);
INSERT INTO opzioni VALUES (19, 1, '25C201C', '25C4920', '25C201Q', NULL, 0);
INSERT INTO accoppiamenti VALUES (20, 'GMC IBRIDA', 'NON MODULANTI', '42 mm', '25C4630', NULL);
INSERT INTO opzioni VALUES (20, 1, '25C201C', '25C4920', '25C201Q', NULL, 0);
INSERT INTO accoppiamenti VALUES (21, 'GMC IBRIDA', 'NON MODULANTI', '60 mm', '25C463C', NULL);
INSERT INTO opzioni VALUES (21, 1, '25C201N', '25C492A', '25C201R', NULL, 0);

-- REF · NON MODULANTI
INSERT INTO accoppiamenti VALUES (22, 'REF', 'NON MODULANTI', '16 mm', '25C1751', '25C3080');
INSERT INTO opzioni VALUES (22, 1, '25C201D', '25C270B', '25C201P', NULL, 0);
INSERT INTO opzioni VALUES (22, 2, NULL, '25C270D', '25C3030', NULL, 0);
INSERT INTO accoppiamenti VALUES (23, 'REF', 'NON MODULANTI', '1/2"', '25C0080', '25C0150');
INSERT INTO opzioni VALUES (23, 1, '25C201D', '25C5040', '25C201P', NULL, 0);
INSERT INTO opzioni VALUES (23, 2, '25C201D', '25C5030', '25C201Q', NULL, 0);
INSERT INTO opzioni VALUES (23, 3, NULL, '25C5030', '25C3030', NULL, 0);
INSERT INTO accoppiamenti VALUES (24, 'REF', 'NON MODULANTI', '3/4"', '25C0070', '25C0110');
INSERT INTO opzioni VALUES (24, 1, '25C201D', '25C5040', '25C201P', NULL, 0);
INSERT INTO opzioni VALUES (24, 2, '25C201D', '25C5030', '25C201Q', NULL, 0);
INSERT INTO opzioni VALUES (24, 3, NULL, '25C5030', '25C3030', NULL, 0);
INSERT INTO accoppiamenti VALUES (25, 'REF', 'NON MODULANTI', '1"', '25C0050', '25C0100');
INSERT INTO opzioni VALUES (25, 1, '25C201C', '25C162A', '25C201Q', NULL, 1);
INSERT INTO opzioni VALUES (25, 2, NULL, '25C162A', '25C3030', NULL, 0);
INSERT INTO accoppiamenti VALUES (26, 'REF', 'NON MODULANTI', '1 1/4"', '25C0060', '25C0090');
INSERT INTO opzioni VALUES (26, 1, '25C201C', '25C162A', '25C201Q', NULL, 1);
INSERT INTO opzioni VALUES (26, 2, NULL, '25C162A', '25C3030', NULL, 0);
INSERT INTO accoppiamenti VALUES (27, 'REF', 'NON MODULANTI', '1 1/2"', '25C3690', '25C0310');
INSERT INTO opzioni VALUES (27, 1, '25C201C', '25C162A', '25C201Q', NULL, 1);
INSERT INTO opzioni VALUES (27, 2, NULL, '25C162A', '25C3030', NULL, 0);
INSERT INTO accoppiamenti VALUES (28, 'REF', 'NON MODULANTI', '2"', '25C369A', '25C009A');
INSERT INTO opzioni VALUES (28, 1, '25C201N', '25C4660', '25C392A', '2', 0);
INSERT INTO opzioni VALUES (28, 2, '25C201N', '25C162B', '25C392A', '3', 0);
INSERT INTO accoppiamenti VALUES (29, 'REF', 'NON MODULANTI', '42 mm', '25C2660', '25C2810');
INSERT INTO opzioni VALUES (29, 1, '25C201C', '25C162A', '25C201Q', NULL, 0);

-- REF · MODULANTI
INSERT INTO accoppiamenti VALUES (30, 'REF', 'MODULANTI', '16 mm', NULL, '25C038A');
INSERT INTO opzioni VALUES (30, 1, '25C201D', '25C270B', '25C348A', NULL, 0);
INSERT INTO opzioni VALUES (30, 2, NULL, '25C5030', '25C303A', NULL, 0);
INSERT INTO opzioni VALUES (30, 3, NULL, '25C5030', '25C303B', NULL, 0);
INSERT INTO accoppiamenti VALUES (31, 'REF', 'MODULANTI', '1/2"', NULL, '25C0440');
INSERT INTO opzioni VALUES (31, 1, '25C201D', '25C5040', '25C348A', NULL, 0);
INSERT INTO opzioni VALUES (31, 2, '25C201D', '25C5030', '25C201F', NULL, 0);
INSERT INTO opzioni VALUES (31, 3, NULL, '25C5030', '25C303A', NULL, 0);
INSERT INTO opzioni VALUES (31, 4, NULL, '25C5030', '25C303B', NULL, 0);
INSERT INTO accoppiamenti VALUES (32, 'REF', 'MODULANTI', '3/4"', '25C007C', '25C007B');
INSERT INTO opzioni VALUES (32, 1, '25C201D', '25C5040', '25C348A', NULL, 0);
INSERT INTO opzioni VALUES (32, 2, '25C201D', '25C5030', '25C201F', NULL, 0);
INSERT INTO opzioni VALUES (32, 3, NULL, '25C5030', '25C303A', NULL, 0);
INSERT INTO opzioni VALUES (32, 4, NULL, '25C5030', '25C303B', NULL, 0);
INSERT INTO accoppiamenti VALUES (33, 'REF', 'MODULANTI', '1"', '25C005B', '25C0420');
INSERT INTO opzioni VALUES (33, 1, '25C201C', '25C162A', '25C201F', NULL, 1);
INSERT INTO opzioni VALUES (33, 2, NULL, '25C162A', '25C303A', NULL, 0);
INSERT INTO opzioni VALUES (33, 3, NULL, '25C162A', '25C303B', NULL, 0);
INSERT INTO accoppiamenti VALUES (34, 'REF', 'MODULANTI', '1 1/4"', '25C006B', '25C010B');
INSERT INTO opzioni VALUES (34, 1, '25C201C', '25C162A', '25C201F', NULL, 1);
INSERT INTO opzioni VALUES (34, 2, NULL, '25C162A', '25C303A', NULL, 0);
INSERT INTO opzioni VALUES (34, 3, NULL, '25C162A', '25C303B', NULL, 0);
INSERT INTO accoppiamenti VALUES (35, 'REF', 'MODULANTI', '1 1/2"', '25C010E', '25C010D');
INSERT INTO opzioni VALUES (35, 1, '25C201C', '25C162A', '25C201F', NULL, 1);
INSERT INTO opzioni VALUES (35, 2, NULL, '25C162A', '25C303A', NULL, 0);
INSERT INTO opzioni VALUES (35, 3, NULL, '25C162A', '25C303B', NULL, 0);
INSERT INTO accoppiamenti VALUES (36, 'REF', 'MODULANTI', '2"', '25C369L', '25C4390');
INSERT INTO opzioni VALUES (36, 1, '25C201N', '25C4660', '25C4670', '2', 0);
INSERT INTO opzioni VALUES (36, 2, '25C201N', '25C162B', '25C4670', '3', 0);
INSERT INTO accoppiamenti VALUES (37, 'REF', 'MODULANTI', '42 mm', NULL, '25C038F');
INSERT INTO opzioni VALUES (37, 1, '25C201C', '25C162A', '25C201F', NULL, 0);
INSERT INTO accoppiamenti VALUES (56, 'REF', 'MODULANTI', '22 mm', '25C0710', NULL);
INSERT INTO opzioni VALUES (56, 1, '25C201D', '25C5040', '25C348A', NULL, 0);
INSERT INTO opzioni VALUES (56, 2, '25C201D', '25C5030', '25C201F', NULL, 0);
INSERT INTO opzioni VALUES (56, 3, NULL, '25C5030', '25C303A', NULL, 0);
INSERT INTO opzioni VALUES (56, 4, NULL, '25C5030', '25C303B', NULL, 0);

-- ============ MISURE INESISTENTI (confermate dall'utente 2026-11-09) ============
INSERT INTO misure_inesistenti VALUES ('GMC', 'NON MODULANTI', '10 mm', '3', 'Valvola GMC non esistente');
INSERT INTO misure_inesistenti VALUES ('GMC', 'NON MODULANTI', '12 mm', '3', 'Valvola GMC non esistente');
INSERT INTO misure_inesistenti VALUES ('GMC SCHRADER', 'NON MODULANTI', '10 mm', '2', 'Valvola GMC non esistente');
INSERT INTO misure_inesistenti VALUES ('GMC SCHRADER', 'NON MODULANTI', '48 mm', '2', 'Valvola GMC non esistente');
INSERT INTO misure_inesistenti VALUES ('GMC SCHRADER', 'NON MODULANTI', '60 mm', '2', 'Valvola GMC non esistente');
INSERT INTO misure_inesistenti VALUES ('GMC IBRIDA', 'NON MODULANTI', '10 mm', '2', 'Valvola GMC non esistente');
INSERT INTO misure_inesistenti VALUES ('GMC IBRIDA', 'NON MODULANTI', '12 mm', '2', 'Valvola GMC non esistente');

-- ============ MATRICE COMBINAZIONI (CAD / PDM) ============
-- Una combinazione = valvola + adattatore + kit + attuatore (un assieme fisico).
-- codice: assegnato una volta (CMB-0001, CMB-0002, ...) e MAI riassegnato o rinumerato,
-- perche' CAD e PDM ci agganciano i loro codici. Nuove combinazioni: prossimo numero libero.
-- codice_pdm / codice_cad: da compilare a cura di CAD + PDM.
CREATE TABLE combinazioni (
  codice      TEXT PRIMARY KEY CHECK (codice GLOB 'CMB-[0-9][0-9][0-9][0-9]'),
  valvola     TEXT NOT NULL REFERENCES valvole(codice),
  adattatore  TEXT REFERENCES adattatori(codice),
  kit         TEXT NOT NULL REFERENCES kit(codice),
  attuatore   TEXT NOT NULL REFERENCES attuatori(codice),
  codice_pdm  TEXT,
  codice_cad  TEXT,
  note        TEXT
);
CREATE UNIQUE INDEX combinazioni_parti ON combinazioni (valvola, COALESCE(adattatore, ''), kit, attuatore);

-- Tutte le combinazioni richieste dalle regole di accoppiamento (varianti navali comprese)
CREATE VIEW combinazioni_attese AS
WITH base AS (
  SELECT a.id AS accoppiamento_id, o.ordine, a.modello, a.tipologia, a.misura, '2' AS vie,
         a.valvola_2vie AS valvola, o.adattatore, o.kit, o.attuatore, o.navale
  FROM accoppiamenti a JOIN opzioni o ON o.accoppiamento_id = a.id
  WHERE a.valvola_2vie IS NOT NULL AND (o.vie IS NULL OR o.vie = '2')
  UNION ALL
  SELECT a.id, o.ordine, a.modello, a.tipologia, a.misura, '3',
         a.valvola_3vie, o.adattatore, o.kit, o.attuatore, o.navale
  FROM accoppiamenti a JOIN opzioni o ON o.accoppiamento_id = a.id
  WHERE a.valvola_3vie IS NOT NULL AND (o.vie IS NULL OR o.vie = '3')
)
SELECT accoppiamento_id, ordine, modello, tipologia, misura, vie, valvola, adattatore, kit, attuatore, 0 AS navale FROM base
UNION ALL
SELECT accoppiamento_id, ordine, modello, tipologia, misura, vie, valvola, adattatore,
       (SELECT valore FROM impostazioni WHERE chiave = 'kit_navale'), attuatore, 1
FROM base WHERE navale = 1;

-- Matrice completa: combinazioni attese + codice assegnato (NULL = codice mancante)
CREATE VIEW matrice AS
SELECT c.codice, e.modello, e.tipologia, e.misura, e.vie, t.brand AS marca_attuatore, e.navale,
       e.valvola, e.adattatore, e.kit, e.attuatore, c.codice_pdm, c.codice_cad, c.note,
       e.accoppiamento_id, e.ordine
FROM combinazioni_attese e
JOIN attuatori t ON t.codice = e.attuatore
LEFT JOIN combinazioni c
  ON c.valvola = e.valvola AND COALESCE(c.adattatore, '') = COALESCE(e.adattatore, '')
 AND c.kit = e.kit AND c.attuatore = e.attuatore;

-- GMC · NON MODULANTI
INSERT INTO combinazioni VALUES ('CMB-0001', '25C1800', '25C201D', '25C491A', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0002', '25C176B', '25C201D', '25C491A', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0003', '25C4480', '25C201D', '25C491A', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0004', '25C281C', '25C201D', '25C491A', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0005', '25C4490', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0006', '25C281D', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0007', '25C4500', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0008', '25C281E', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0009', '25C4510', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0010', '25C281F', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0011', '25C4520', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0012', '25C281B', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0013', '25C452B', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0014', '25C281G', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0015', '25C452C', '25C201N', '25C492A', '25C201R', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0016', '25C281H', '25C201N', '25C492A', '25C201R', NULL, NULL, NULL);
-- GMC SCHRADER · NON MODULANTI
INSERT INTO combinazioni VALUES ('CMB-0017', '25C4580', '25C201D', '25C491A', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0018', '25C4530', '25C201D', '25C491A', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0019', '25C4540', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0020', '25C4550', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0021', '25C4560', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0022', '25C4570', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
-- GMC IBRIDA · NON MODULANTI
INSERT INTO combinazioni VALUES ('CMB-0023', '25C4590', '25C201D', '25C491A', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0024', '25C4600', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0025', '25C4610', '25C201D', '25C4910', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0026', '25C4620', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0027', '25C4630', '25C201C', '25C4920', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0028', '25C463C', '25C201N', '25C492A', '25C201R', NULL, NULL, NULL);
-- REF · NON MODULANTI
INSERT INTO combinazioni VALUES ('CMB-0029', '25C0080', '25C201D', '25C5040', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0030', '25C0080', '25C201D', '25C5030', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0031', '25C0080', NULL, '25C5030', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0032', '25C0150', '25C201D', '25C5040', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0033', '25C0150', '25C201D', '25C5030', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0034', '25C0150', NULL, '25C5030', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0035', '25C1751', '25C201D', '25C270B', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0036', '25C1751', NULL, '25C270D', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0037', '25C3080', '25C201D', '25C270B', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0038', '25C3080', NULL, '25C270D', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0039', '25C0070', '25C201D', '25C5040', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0040', '25C0070', '25C201D', '25C5030', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0041', '25C0070', NULL, '25C5030', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0042', '25C0110', '25C201D', '25C5040', '25C201P', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0043', '25C0110', '25C201D', '25C5030', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0044', '25C0110', NULL, '25C5030', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0045', '25C0050', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0046', '25C0050', '25C201C', '25C162C', '25C201Q', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0047', '25C0050', NULL, '25C162A', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0048', '25C0100', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0049', '25C0100', '25C201C', '25C162C', '25C201Q', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0050', '25C0100', NULL, '25C162A', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0051', '25C0060', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0052', '25C0060', '25C201C', '25C162C', '25C201Q', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0053', '25C0060', NULL, '25C162A', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0054', '25C0090', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0055', '25C0090', '25C201C', '25C162C', '25C201Q', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0056', '25C0090', NULL, '25C162A', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0057', '25C3690', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0058', '25C3690', '25C201C', '25C162C', '25C201Q', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0059', '25C3690', NULL, '25C162A', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0060', '25C0310', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0061', '25C0310', '25C201C', '25C162C', '25C201Q', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0062', '25C0310', NULL, '25C162A', '25C3030', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0063', '25C2660', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0064', '25C2810', '25C201C', '25C162A', '25C201Q', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0065', '25C369A', '25C201N', '25C4660', '25C392A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0066', '25C009A', '25C201N', '25C162B', '25C392A', NULL, NULL, NULL);
-- REF · MODULANTI
INSERT INTO combinazioni VALUES ('CMB-0067', '25C0440', '25C201D', '25C5040', '25C348A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0068', '25C0440', '25C201D', '25C5030', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0069', '25C0440', NULL, '25C5030', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0070', '25C0440', NULL, '25C5030', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0071', '25C038A', '25C201D', '25C270B', '25C348A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0072', '25C038A', NULL, '25C5030', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0073', '25C038A', NULL, '25C5030', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0074', '25C007C', '25C201D', '25C5040', '25C348A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0075', '25C007C', '25C201D', '25C5030', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0076', '25C007C', NULL, '25C5030', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0077', '25C007C', NULL, '25C5030', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0078', '25C007B', '25C201D', '25C5040', '25C348A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0079', '25C007B', '25C201D', '25C5030', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0080', '25C007B', NULL, '25C5030', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0081', '25C007B', NULL, '25C5030', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0082', '25C0710', '25C201D', '25C5040', '25C348A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0083', '25C0710', '25C201D', '25C5030', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0084', '25C0710', NULL, '25C5030', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0085', '25C0710', NULL, '25C5030', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0086', '25C005B', '25C201C', '25C162A', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0087', '25C005B', '25C201C', '25C162C', '25C201F', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0088', '25C005B', NULL, '25C162A', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0089', '25C005B', NULL, '25C162A', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0090', '25C0420', '25C201C', '25C162A', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0091', '25C0420', '25C201C', '25C162C', '25C201F', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0092', '25C0420', NULL, '25C162A', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0093', '25C0420', NULL, '25C162A', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0094', '25C006B', '25C201C', '25C162A', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0095', '25C006B', '25C201C', '25C162C', '25C201F', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0096', '25C006B', NULL, '25C162A', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0097', '25C006B', NULL, '25C162A', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0098', '25C010B', '25C201C', '25C162A', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0099', '25C010B', '25C201C', '25C162C', '25C201F', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0100', '25C010B', NULL, '25C162A', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0101', '25C010B', NULL, '25C162A', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0102', '25C010E', '25C201C', '25C162A', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0103', '25C010E', '25C201C', '25C162C', '25C201F', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0104', '25C010E', NULL, '25C162A', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0105', '25C010E', NULL, '25C162A', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0106', '25C010D', '25C201C', '25C162A', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0107', '25C010D', '25C201C', '25C162C', '25C201F', NULL, NULL, NULL);  -- navale
INSERT INTO combinazioni VALUES ('CMB-0108', '25C010D', NULL, '25C162A', '25C303A', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0109', '25C010D', NULL, '25C162A', '25C303B', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0110', '25C038F', '25C201C', '25C162A', '25C201F', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0111', '25C369L', '25C201N', '25C4660', '25C4670', NULL, NULL, NULL);
INSERT INTO combinazioni VALUES ('CMB-0112', '25C4390', '25C201N', '25C162B', '25C4670', NULL, NULL, NULL);
