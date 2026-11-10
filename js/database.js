// Pagina database: consultazione leggibile di data/belimo.sql + controlli di coerenza
const IBRIDA = 'INOX/K65';
const VIE_LABEL = { '2': '2V', '3': '3V' };

const S = {
	tab: 'controlli',
	filtroModello: null,
	filtroValvole: 'tutte',
	filtroMarca: null,
	matriceModello: null,
	matriceStato: 'tutte',
	mosaicoCodice: null,
	importSql: null,
	sqlTesto: null
};

let D = null; // dati letti via SQL
let CHECKS = [];
let COPERTURA = [];

// ---------------------------------------------------------------- utilità
const h = escapeHtml;

// Estrae la misura scritta nella descrizione articolo ("16 mm", "1 1/4\"")
function misuraDaDescrizione(desc) {
	const mm = String(desc).match(/(\d+(?:[.,]\d+)?)\s*mm/i);
	if (mm) return `${mm[1]} mm`;
	// "2.1/2"" → "2 1/2""; lookbehind: evita di leggere il "2" di "CO2" come parte della misura
	const inch = String(desc).replace(/(\d)\.(\d\/\d)/, '$1 $2').match(/(?<![\w./])(\d+ \d\/\d|\d\/\d|\d+)"/);
	return inch ? `${inch[1]}"` : null;
}

const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
const famiglia = modello => modello.split(' ')[0];
const etichetta = modello => D.modelli[modello]?.etichetta || modello;
// Serie = modello + variante ("GMC", "GMC Schrader", "GMC Ibrida")
const serieRiga = r => nomeSerie(etichetta(r.modello), r.variante);
const tipAbbr = t => t === 'MODULANTE' ? 'MOD' : t;  // tipologia riga = tipo attuatore

function pill(code, meta = '', cls = '', title = '') {
	return `<span class="pill ${cls}" title="${h(title || meta || code)}">`
		+ (code ? `<span class="pill-code">${h(code)}</span>` : '')
		+ (meta ? `<span class="pill-meta">${h(meta)}</span>` : '')
		+ `</span>`;
}

function tag(testo, cls = '') {
	return `<span class="pill pill-tag ${cls}">${h(testo)}</span>`;
}

// ---------------------------------------------------------------- colori
// Coppia (Nm): stesso colore per kit, adattatore e attuatore compatibili
const COLORE_NM = { 20: 'c-green', 40: 'c-blue', 90: 'c-orange', 160: 'c-pink' };
const coloreNm = nm => 'c ' + (nm ? (COLORE_NM[nm] || 'c-slate') : 'c-teal'); // senza Nm = Watergate
const COLORE_MARCA = { GMC: 'c-sky', REF: 'c-indigo', REFRIGERA: 'c-indigo', OLAB: 'c-lime' };
const coloreMarca = m => 'c ' + (COLORE_MARCA[m] || 'c-slate');
const coloreFamiglia = modello => coloreMarca(famiglia(modello));
const COLORE_CORPO = { INOX: 'c-silver', OTTONE: 'c-gold' };
const COLORE_MARCA_ATT = { BELIMO: 'c-slate', WATERGATE: 'c-teal' };
const coloreMarcaAttuatore = m => 'c ' + (COLORE_MARCA_ATT[m] || 'c-slate');
const marcaTag = m => tag(m.charAt(0) + m.slice(1).toLowerCase(), coloreMarcaAttuatore(m));

function nmDaTesto(testo) {
	const t = String(testo || '');
	if (/9x9/i.test(t)) return 20;
	if (/14x14/i.test(t)) return 40;
	const m = t.match(/(\d+)\s*Nm/i);
	return m ? Number(m[1]) : null;
}

// Colore = marca valvola. Ibrida (connessioni INOX/K65) è una proprietà: badge a parte, non un colore.
function coloreValvola(v) {
	if (!v.disponibile) return 'pill-strike pill-na';
	return coloreMarca(v.marca);
}

const ibridaBadge = () => '<span class="pill-flag" title="Ibrida: connessioni INOX / K65">INOX/K65</span>';

function valvolaPill(codice, conMeta = true) {
	const v = D.valvole[codice];
	if (!v) return pill(codice, 'non in anagrafica', 'pill-err');
	const title = [v.descrizione, v.passaggio || '', v.corpo ? `Corpo ${v.corpo}` : '', v.connessioni ? `Connessioni ${v.connessioni}` : '', v.note].filter(Boolean).join(' · ');
	const html = pill(codice, conMeta ? v.descrizione : '', coloreValvola(v), title);
	// Proprietà come badge: ibrida (connessioni INOX/K65) e corpo ottone (eccezione: la norma è inox)
	const badge = (v.connessioni === IBRIDA ? ibridaBadge() : '')
		+ (v.corpo === 'OTTONE' ? '<span class="pill-flag pill-flag-ottone" title="Corpo in ottone">OTTONE</span>' : '');
	return badge ? html.replace(/<\/span>$/, badge + '</span>') : html;
}

function kitPill(codice, conMeta = true) {
	const k = D.kit[codice];
	if (!k) return pill(codice, 'non in anagrafica', 'pill-err');
	return pill(codice, conMeta ? k.descrizione : '', coloreNm(nmDaTesto(k.descrizione)), k.descrizione);
}

function adattatorePill(codice, conMeta = true) {
	const a = D.adattatori[codice];
	if (!a) return pill(codice, 'non in anagrafica', 'pill-err');
	return pill(codice, conMeta ? a.descrizione : '', coloreNm(nmDaTesto(a.descrizione)), a.descrizione);
}

// Tipo di sfera (proprietà valvola), distinto dal tipo di attuatore
function passaggioTag(p) {
	if (!p) return tag('sfera ?', 'pill-gap');
	return p === 'V-PORT' ? tag('V-PORT', 'pass-v') : tag('FULL PASSAGE', 'pass-full');
}

// Preferenziale: GENERALE (GMC) / NAVALE (REF corpo inox) / non preferenziale
function prefTag(p) {
	if (p === 'GENERALE') return tag('PREFERENZIALE', 'pill-ok');
	if (p === 'NAVALE') return tag('PREF. NAVALE', 'c c-sky');
	return '<span class="res-muted">no</span>';
}

function tipoTag(tipo) {
	return tipo === 'MODULANTE' ? tag('MOD', 't-mod') : tag('ON-OFF', 't-onoff');
}

function corpoTag(corpo) {
	return corpo ? tag(corpo, 'c ' + (COLORE_CORPO[corpo] || 'c-slate')) : '<span class="res-muted">—</span>';
}

function attuatorePill(codice, conMeta = true) {
	const a = D.attuatori[codice];
	if (!a) return pill(codice, 'non in anagrafica', 'pill-err');
	const meta = [a.nm ? `${a.nm} Nm` : '', a.brand !== 'BELIMO' ? a.brand : '', a.alimentazione || ''].filter(Boolean).join(' · ');
	return `${pill(codice, conMeta ? meta : '', coloreNm(a.nm), a.descrizione)} ${tipoTag(a.tipo)}`;
}

function legendaColori(parti = ['nm', 'valvole', 'proprieta', 'corpo', 'tipo']) {
	const voce = (cls, testo) => `<span>${tag(testo, cls)}</span>`;
	const gruppi = {
		nm: ['Coppia kit · adattatore · attuatore', [['c c-green', '20 Nm'], ['c c-blue', '40 Nm'], ['c c-orange', '90 Nm'], ['c c-pink', '160 Nm'], ['c c-teal', 'Watergate']]],
		valvole: ['Marca valvola', [['c c-sky', 'GMC'], ['c c-indigo', 'Refrigera'], ['c c-lime', 'OLAB'], ['pill-strike pill-na', 'non disponibile']]],
		proprieta: ['Proprietà', [['pill-flag-leg', 'INOX/K65 = ibrida'], ['pill-flag-leg pill-flag-ottone', 'OTTONE = corpo ottone']]],
		corpo: ['Corpo', [['c c-silver', 'INOX'], ['c c-gold', 'OTTONE']]],
		passaggio: ['Sfera', [['pass-full', 'FULL PASSAGE'], ['pass-v', 'V-PORT']]],
		tipo: ['Attuatore', [['t-onoff', 'ON-OFF'], ['t-mod', 'MOD']]],
		marca: ['Marca attuatore', [['c c-slate', 'Belimo'], ['c c-teal', 'Watergate']]],
		stato: ['Celle', [['pill-gap', 'manca = buco da verificare'], ['pill-na', 'non esiste = confermata inesistente'], ['pill-na', 'n/p = non prevista']]]
	};
	return `<div class="legend legend-colori">${parti.map(p => `<div class="legend-group"><span class="legend-title">${gruppi[p][0]}</span>${gruppi[p][1].map(([c, t]) => voce(c, t)).join('')}</div>`).join('')}</div>`;
}

function rifRiga(r, vie) {
	return `${serieRiga(r)} · ${tipAbbr(r.tipologia)} · ${r.misura}${vie ? ' · ' + VIE_LABEL[vie] : ''}`;
}

// ---------------------------------------------------------------- caricamento
function caricaDati() {
	const perCodice = rows => Object.fromEntries(rows.map(r => [r.codice, r]));
	const modelli = query('SELECT * FROM modelli ORDER BY ordine');
	const righe = ordinaPerMisura(query(`
		SELECT a.* FROM accoppiamenti a JOIN modelli m ON m.codice = a.modello
		ORDER BY m.ordine, a.id`));
	const opzioni = query(`SELECT o.*, t.brand AS marca FROM opzioni o JOIN attuatori t ON t.codice = o.attuatore
		ORDER BY o.accoppiamento_id, o.ordine`);
	righe.forEach(r => { r.opzioni = opzioni.filter(o => o.accoppiamento_id === r.id); });
	// Matrice CAD/PDM nello stesso ordine delle righe di accoppiamento
	const posRiga = Object.fromEntries(righe.map((r, i) => [r.id, i]));
	const matrice = query('SELECT * FROM matrice').sort((a, b) =>
		posRiga[a.accoppiamento_id] - posRiga[b.accoppiamento_id] || a.vie.localeCompare(b.vie)
		|| a.ordine - b.ordine || a.corpo_inox - b.corpo_inox);

	D = {
		impostazioni: Object.fromEntries(query('SELECT * FROM impostazioni').map(r => [r.chiave, r.valore])),
		modelli: perCodice(modelli),
		modelliOrdine: modelli.map(m => m.codice),
		valvole: perCodice(query('SELECT * FROM valvole')),
		kit: perCodice(query('SELECT * FROM kit ORDER BY rowid')),
		adattatori: perCodice(query('SELECT * FROM adattatori ORDER BY rowid')),
		attuatori: perCodice(query('SELECT * FROM attuatori ORDER BY rowid')),
		punti: query('SELECT * FROM punti_impianto ORDER BY ordine'),
		inesistenti: query('SELECT * FROM misure_inesistenti'),
		combinazioni: query('SELECT * FROM combinazioni ORDER BY codice'),
		matrice,
		righe
	};

	// Dove è usata ogni valvola / kit / attuatore / adattatore
	D.uso = { valvole: {}, kit: {}, attuatori: {}, adattatori: {} };
	const add = (tipo, codice, rif) => {
		if (!codice) return;
		(D.uso[tipo][codice] ||= []).push(rif);
	};
	righe.forEach(r => {
		add('valvole', r.valvola_2vie, { r, vie: '2' });
		add('valvole', r.valvola_3vie, { r, vie: '3' });
		r.opzioni.forEach(o => {
			add('adattatori', o.adattatore, { r, vie: o.vie });
			add('kit', o.kit, { r, vie: o.vie });
			add('attuatori', o.attuatore, { r, vie: o.vie });
		});
	});
}

// ---------------------------------------------------------------- copertura (buchi)
// Per ogni famiglia (GMC, REF): misure × colonne (modello + tipologia)
function calcolaCopertura() {
	const famiglie = [];
	D.modelliOrdine.forEach(mod => {
		const f = famiglia(mod);
		if (!famiglie.find(x => x.nome === f)) famiglie.push({ nome: f, colonne: [], misure: new Set() });
	});
	D.righe.forEach(r => {
		const f = famiglie.find(x => x.nome === famiglia(r.modello));
		f.misure.add(r.misura);
		if (!f.colonne.find(c => c.modello === r.modello && c.variante === r.variante && c.tipologia === r.tipologia)) {
			f.colonne.push({ modello: r.modello, variante: r.variante, tipologia: r.tipologia });
		}
	});

	famiglie.forEach(f => {
		f.misure = [...f.misure].sort((a, b) => misuraValore(a) - misuraValore(b));
		f.colonne.forEach(c => {
			const righeCol = D.righe.filter(r => r.modello === c.modello && r.variante === c.variante && r.tipologia === c.tipologia);
			const ibrida = c.variante === 'IBRIDA';
			// Una via è "prevista" nella colonna se almeno una misura la usa
			c.prevista = {
				'2': righeCol.some(r => r.valvola_2vie),
				'3': !ibrida && righeCol.some(r => r.valvola_3vie)
			};
			c.ibrida = ibrida;
			c.celle = {};
			f.misure.forEach(mis => {
				const r = righeCol.find(x => x.misura === mis);
				c.celle[mis] = ['2', '3'].map(vie => {
					const codice = r?.[vie === '2' ? 'valvola_2vie' : 'valvola_3vie'];
					if (codice) return { vie, stato: 'ok', codice };
					if (vie === '3' && ibrida) return { vie, stato: 'na', motivo: 'Le ibride esistono solo 2-vie' };
					if (!c.prevista[vie]) return { vie, stato: 'na', motivo: `${VIE_LABEL[vie]} non prevista per questa serie` };
					// Valvola censita ma dichiarata inesistente (es. ibrida 48 mm)?
					const parole = [c.modello, c.variante !== 'STANDARD' ? c.variante : null].filter(Boolean);
					const giust = Object.values(D.valvole).find(v => !v.disponibile
						&& misuraDaDescrizione(v.descrizione) === mis
						&& parole.every(p => norm(v.descrizione).includes(p))
						&& (vie === '3') === norm(v.descrizione).includes('3-VIE'));
					if (giust) return { vie, stato: 'giustificato', codice: giust.codice, motivo: giust.note };
					const conf = D.inesistenti.find(x => x.modello === c.modello && x.variante === c.variante && x.tipologia === c.tipologia && x.misura === mis && x.vie === vie);
					if (conf) return { vie, stato: 'inesistente', motivo: conf.nota || 'Confermata inesistente' };
					return { vie, stato: 'buco', motivo: r ? 'valvola mancante' : 'misura non presente' };
				});
			});
		});
	});
	return famiglie;
}

// ---------------------------------------------------------------- controlli di coerenza
function calcolaControlli() {
	const C = [];
	const add = (livello, titolo, descr, items) => C.push({ livello, titolo, descr, items });
	const rigaV = (x, extra = '') => `${tag(rifRiga(x, x.vie))} ${valvolaPill(x.codice)} ${extra}`;

	add('err', 'Ibride solo 2-vie',
		'Nessuna valvola con connessioni INOX/K65 può comparire come 3-vie.',
		query(`SELECT a.*, v.codice, '3' AS vie FROM accoppiamenti a JOIN valvole v ON v.codice = a.valvola_3vie
			WHERE v.connessioni = ?`, [IBRIDA]).map(x => rigaV(x)));

	add('err', 'Serie ibrida coerente',
		'Le righe "IBRIDA" usano solo valvole INOX/K65 e le valvole INOX/K65 stanno solo in righe "IBRIDA".',
		query(`SELECT a.*, v.codice, CASE WHEN v.codice = a.valvola_2vie THEN '2' ELSE '3' END AS vie
			FROM accoppiamenti a JOIN valvole v ON v.codice IN (a.valvola_2vie, a.valvola_3vie)
			WHERE (a.variante = 'IBRIDA') <> (COALESCE(v.connessioni, '') = ?)`, [IBRIDA]).map(x => rigaV(x)));

	add('err', 'Valvole non disponibili usate',
		'Una valvola marcata come inesistente/non disponibile non deve essere proposta.',
		query(`SELECT a.*, v.codice, CASE WHEN v.codice = a.valvola_2vie THEN '2' ELSE '3' END AS vie
			FROM accoppiamenti a JOIN valvole v ON v.codice IN (a.valvola_2vie, a.valvola_3vie)
			WHERE v.disponibile = 0`).map(x => rigaV(x, `<span class="pill-meta">${h(D.valvole[x.codice].note || '')}</span>`)));

	add('err', 'Vie coerenti con la descrizione',
		'In colonna 3-vie la descrizione contiene "3-VIE"; in colonna 2-vie no.',
		query(`SELECT a.*, a.valvola_3vie AS codice, '3' AS vie FROM accoppiamenti a JOIN valvole v ON v.codice = a.valvola_3vie
				WHERE v.descrizione NOT LIKE '%3-VIE%'
			UNION ALL
			SELECT a.*, a.valvola_2vie, '2' FROM accoppiamenti a JOIN valvole v ON v.codice = a.valvola_2vie
				WHERE v.descrizione LIKE '%3-VIE%'`).map(x => rigaV(x)));

	add('err', 'Misura coerente con la descrizione',
		'La misura della riga coincide con quella scritta nella descrizione della valvola.',
		D.righe.flatMap(r => ['2', '3'].map(vie => ({ r, vie, codice: r[vie === '2' ? 'valvola_2vie' : 'valvola_3vie'] })))
			.filter(x => x.codice && D.valvole[x.codice])
			.filter(x => {
				const m = misuraDaDescrizione(D.valvole[x.codice].descrizione);
				return m && norm(m) !== norm(x.r.misura);
			})
			.map(x => `${tag(rifRiga(x.r, x.vie))} ${valvolaPill(x.codice)} <span class="pill-meta">descrizione: ${h(misuraDaDescrizione(D.valvole[x.codice].descrizione))}</span>`));

	add('err', 'Tipologia coerente con l\'attuatore',
		'Righe ON-OFF → attuatore ON-OFF; righe MODULANTE → attuatore MODULANTE.',
		query(`SELECT a.*, o.attuatore FROM accoppiamenti a
			JOIN opzioni o ON o.accoppiamento_id = a.id JOIN attuatori t ON t.codice = o.attuatore
			WHERE a.tipologia <> t.tipo`)
			.map(x => `${tag(rifRiga(x))} ${attuatorePill(x.attuatore)}`));

	add('warn', 'Passaggio sfera coerente con l\'attuatore',
		'Sfera V-PORT con attuatore MODULANTE, sfera FULL PASSAGE con attuatore ON-OFF.',
		query(`SELECT a.*, v.codice, v.passaggio, CASE WHEN v.codice = a.valvola_2vie THEN '2' ELSE '3' END AS vie
			FROM accoppiamenti a JOIN valvole v ON v.codice IN (a.valvola_2vie, a.valvola_3vie)
			WHERE v.passaggio IS NOT NULL AND (a.tipologia = 'MODULANTE') <> (v.passaggio = 'V-PORT')`)
			.map(x => rigaV(x, passaggioTag(x.passaggio))));

	add('warn', 'Passaggio sfera da definire',
		'Valvole senza FULL PASSAGE / V-PORT: prima quelle già proposte dal selettore.',
		Object.values(D.valvole).filter(v => !v.passaggio)
			.sort((a, b) => !!D.uso.valvole[b.codice] - !!D.uso.valvole[a.codice])
			.map(v => `${D.uso.valvole[v.codice] ? tag('in uso', 'pill-warn') : tag('non in uso')} ${valvolaPill(v.codice)}`));

	add('err', 'Coppia Nm kit ↔ attuatore',
		'Il kit (es. "40 Nm") è abbinato a un attuatore della stessa coppia.',
		D.righe.flatMap(r => r.opzioni.map(o => ({ r, o })))
			.filter(({ o }) => {
				const kNm = (D.kit[o.kit]?.descrizione.match(/(\d+)\s*Nm/i) || [])[1];
				const aNm = D.attuatori[o.attuatore]?.nm;
				return kNm && aNm && Number(kNm) !== Number(aNm);
			})
			.map(({ r, o }) => `${tag(rifRiga(r, o.vie))} ${kitPill(o.kit)} → ${attuatorePill(o.attuatore)}`));

	add('err', 'Stessa regola per misura in tutte le serie GMC',
		'GMC standard, Schrader e Ibrida: a parità di misura stesso adattatore, kit e attuatore.',
		query(`SELECT a.misura,
				GROUP_CONCAT(a.variante || ': ' || COALESCE(o.adattatore, '-') || ' / ' || o.kit || ' / ' || o.attuatore, ' | ') AS dettaglio
			FROM accoppiamenti a JOIN opzioni o ON o.accoppiamento_id = a.id
			WHERE a.modello LIKE 'GMC%'
			GROUP BY a.misura
			HAVING COUNT(DISTINCT COALESCE(o.adattatore, '') || o.kit || o.attuatore) > 1`)
			.map(x => `${tag(x.misura)} <span class="pill-meta">${h(x.dettaglio)}</span>`));

	add('err', 'Righe complete',
		'Ogni riga ha almeno una valvola e almeno una coppia kit + attuatore.',
		query(`SELECT a.* FROM accoppiamenti a
			WHERE (a.valvola_2vie IS NULL AND a.valvola_3vie IS NULL)
				OR a.id NOT IN (SELECT accoppiamento_id FROM opzioni)`).map(x => tag(rifRiga(x))));

	add('err', 'Inesistenti confermate davvero vuote',
		'Le combinazioni segnate "non esiste" non devono avere una valvola negli accoppiamenti.',
		query(`SELECT a.*, m.vie, CASE m.vie WHEN '2' THEN a.valvola_2vie ELSE a.valvola_3vie END AS codice
			FROM misure_inesistenti m JOIN accoppiamenti a
				ON a.modello = m.modello AND a.variante = m.variante AND a.tipologia = m.tipologia AND a.misura = m.misura
			WHERE CASE m.vie WHEN '2' THEN a.valvola_2vie ELSE a.valvola_3vie END IS NOT NULL`).map(x => rigaV(x)));

	add('err', 'REF in pollici: corpo inox',
		'Regola: tutte le valvole Refrigera con misura in pollici hanno corpo INOX.',
		Object.values(D.valvole)
			.filter(v => v.marca === 'REFRIGERA' && v.descrizione.includes('"') && v.corpo !== 'INOX')
			.map(v => `${valvolaPill(v.codice)} ${corpoTag(v.corpo)}`));

	const eccezioni = regola => new Set(query('SELECT valvola FROM eccezioni_regole WHERE regola = ?', [regola]).map(e => e.valvola));
	const eccRefMm = eccezioni('REF_MM_OTTONE');
	add('err', 'REF in millimetri: corpo ottone',
		`Regola: le valvole Refrigera con misura in millimetri (2 e 3 vie) hanno corpo OTTONE. Eccezioni confermate (corpo inox): ${[...eccRefMm].map(c => `${c} ${D.valvole[c]?.descrizione || ''}`).join('; ') || 'nessuna'}.`,
		Object.values(D.valvole)
			.filter(v => v.marca === 'REFRIGERA' && !v.descrizione.includes('"') && v.corpo !== 'OTTONE' && !eccRefMm.has(v.codice))
			.map(v => `${valvolaPill(v.codice)} ${corpoTag(v.corpo)} <span class="pill-meta">${h(v.note || '')}</span>`));

	add('err', 'GMC: corpo ottone',
		'Regola: tutte le GMC (2 vie, 3 vie, Schrader, ibride) hanno corpo OTTONE.',
		Object.values(D.valvole)
			.filter(v => v.marca === 'GMC' && v.corpo !== 'OTTONE')
			.map(v => `${valvolaPill(v.codice)} ${corpoTag(v.corpo)}`));

	add('err', 'GMC ibride: corpo ottone, connessioni INOX/K65',
		'Regola: tutte le GMC ibride hanno corpo OTTONE e connessioni una inox e una K65.',
		Object.values(D.valvole)
			.filter(v => v.marca === 'GMC' && /IBRIDA/i.test(v.descrizione) && (v.corpo !== 'OTTONE' || v.connessioni !== IBRIDA))
			.map(v => `${valvolaPill(v.codice)} ${corpoTag(v.corpo)} ${tag(v.connessioni || 'connessioni ?')}`));

	add('err', 'Combinazioni senza codice',
		'Ogni combinazione valvola + adattatore + kit + attuatore richiesta dalle regole ha un codice CMB in matrice.',
		D.matrice.filter(m => !m.codice).map(m => `${tag(`${serieRiga(m)} · ${tipAbbr(m.tipologia)} · ${m.misura} · ${VIE_LABEL[m.vie]}`)} ${valvolaPill(m.valvola, false)} ${m.adattatore ? adattatorePill(m.adattatore, false) : ''} ${kitPill(m.kit, false)} ${attuatorePill(m.attuatore, false)}`));

	const attese = new Set(D.matrice.map(m => m.codice).filter(Boolean));
	add('warn', 'Codici CMB obsoleti',
		'Combinazioni con codice che le regole attuali non usano più (non vanno cancellate: il codice resta riservato).',
		D.combinazioni.filter(c => !attese.has(c.codice)).map(c => `${tag(c.codice)} ${valvolaPill(c.valvola, false)} ${kitPill(c.kit, false)} ${attuatorePill(c.attuatore, false)}`));

	add('info', 'Codici PDM da compilare',
		'Combinazioni in matrice ancora senza codice PDM (a cura di CAD + PDM).',
		D.matrice.filter(m => m.codice && !m.codice_pdm).length
			? [`${tag(D.matrice.filter(m => m.codice && !m.codice_pdm).length + ' combinazioni', 'pill-gap')} <span class="pill-meta">vedi scheda Matrice CAD/PDM</span>`] : []);

	// Copertura per marca attuatore: misure della famiglia dove una marca usata nella famiglia manca
	const perMarca = [];
	COPERTURA.forEach(f => {
		const righeF = D.righe.filter(r => famiglia(r.modello) === f.nome);
		const marche = [...new Set(righeF.flatMap(r => r.opzioni.map(o => o.marca)))];
		if (marche.length < 2) return;
		righeF.forEach(r => marche.forEach(m => {
			if (!r.opzioni.some(o => o.marca === m)) perMarca.push(`${tag(rifRiga(r))} ${tag('senza ' + m, coloreMarcaAttuatore(m))}`);
		}));
	});
	add('info', 'Misure senza una marca attuatore',
		'Righe dove una marca attuatore presente nella famiglia non ha opzioni (es. Watergate su 42 mm e 2").',
		perMarca);

	const buchi = [];
	COPERTURA.forEach(f => f.colonne.forEach(c => f.misure.forEach(mis => c.celle[mis]
		.filter(x => x.stato === 'buco')
		.forEach(x => buchi.push(`${tag(`${serieRiga(c)} · ${tipAbbr(c.tipologia)} · ${mis} · ${VIE_LABEL[x.vie]}`, 'pill-gap')} <span class="pill-meta">${h(x.motivo)}</span>`)))));
	add('warn', 'Buchi di copertura',
		'Misure presenti nella famiglia ma senza valvola in questa serie (dettaglio nella scheda Copertura).',
		buchi);

	add('warn', 'Valvole senza accoppiamento',
		'Valvole disponibili che il selettore non propone ancora (nessuna riga di accoppiamento).',
		Object.values(D.valvole).filter(v => v.disponibile && !D.uso.valvole[v.codice])
			.map(v => `${tag(v.marca || '—')} ${valvolaPill(v.codice)} <span class="pill-meta">${h(v.note || '')}</span>`));

	add('info', 'Valvole censite come non disponibili',
		'Presenti in anagrafica per memoria, escluse dagli accoppiamenti.',
		Object.values(D.valvole).filter(v => !v.disponibile)
			.map(v => `${valvolaPill(v.codice)} <span class="pill-meta">${h(v.note || '')}</span>`));

	const maiUsati = [
		...Object.values(D.kit).filter(k => !D.uso.kit[k.codice] && k.codice !== D.impostazioni.kit_corpo_inox).map(k => `${tag('Kit')} ${kitPill(k.codice)}`),
		...Object.values(D.adattatori).filter(a => !D.uso.adattatori[a.codice]).map(a => `${tag('Adattatore')} ${adattatorePill(a.codice)}`),
		...Object.values(D.attuatori).filter(a => !D.uso.attuatori[a.codice]).map(a => `${tag('Attuatore')} ${attuatorePill(a.codice)}`)
	];
	add('info', 'Kit, adattatori e attuatori mai usati', 'Articoli in anagrafica senza accoppiamenti.', maiUsati);

	return C;
}

// ---------------------------------------------------------------- viste
const LIVELLO = {
	err: { cls: 'pill-err', label: 'ERRORE' },
	warn: { cls: 'pill-warn', label: 'DA VERIFICARE' },
	info: { cls: 'pill-muted', label: 'INFO' }
};

function vistaControlli() {
	const ordine = { err: 0, warn: 1, info: 2 };
	const lista = [...CHECKS].sort((a, b) =>
		(a.items.length ? 0 : 1) - (b.items.length ? 0 : 1) || ordine[a.livello] - ordine[b.livello]);
	return `
		<p class="db-hint">Ogni controllo è una query sul database. Clicca una riga per vedere gli elementi coinvolti.</p>
		<section class="panel"><div class="db-check-list">
			${lista.map(c => {
				const ok = c.items.length === 0;
				const stato = ok ? tag('OK', 'pill-ok') : tag(LIVELLO[c.livello].label, LIVELLO[c.livello].cls);
				return `
				<details class="db-check" ${!ok && c.livello !== 'info' ? 'open' : ''}>
					<summary>
						<span>${stato}</span>
						<span><span class="db-check-title">${h(c.titolo)}</span><span class="db-check-desc">${h(c.descr)}</span></span>
						<span class="db-check-n">${ok ? '' : c.items.length}</span>
					</summary>
					${ok ? '' : `<div class="db-check-body">${c.items.map(i => `<div class="db-check-item">${i}</div>`).join('')}</div>`}
				</details>`;
			}).join('')}
		</div></section>`;
}

function vistaCopertura() {
	return `<p class="db-hint">Misure (righe) × serie (colonne). Ogni cella mostra la valvola 2-vie (2V) e 3-vie (3V).</p>${legendaColori(['valvole', 'proprieta', 'stato'])}`
		+ COPERTURA.map(f => `
		<section class="panel db-section">
			<div class="panel-head"><span>Famiglia ${tag(f.nome, coloreMarca(f.nome))}</span></div>
			<div class="panel-body-flush">
				<table class="data-table cov-table">
					<thead><tr><th>Misura</th>${f.colonne.map(c => `<th>${h(serieRiga(c))}<br><span class="res-muted">${h(c.tipologia)}</span></th>`).join('')}</tr></thead>
					<tbody>
						${f.misure.map(mis => `<tr data-s="${h(mis)}">
							<td>${h(mis)}</td>
							${f.colonne.map(c => `<td><span class="cov-cell">${c.celle[mis].map(x => {
								const lab = VIE_LABEL[x.vie] + ' ';
								const conVie = html => html.replace('<span class="pill-code">', `<span class="pill-meta">${lab}</span><span class="pill-code">`);
								if (x.stato === 'ok') return conVie(valvolaPill(x.codice, false));
								if (x.stato === 'giustificato') return conVie(pill(x.codice, '', 'pill-strike pill-na', x.motivo));
								if (x.stato === 'inesistente') return pill('', `${lab}non esiste`, 'pill-na', x.motivo);
								if (x.stato === 'buco') return pill('', `${lab}manca`, 'pill-gap', x.motivo);
								return pill('', `${lab}n/p`, 'pill-na', x.motivo);
							}).join('')}</span></td>`).join('')}
						</tr>`).join('')}
					</tbody>
				</table>
			</div>
		</section>`).join('');
}

function vistaAccoppiamenti() {
	const modelli = D.modelliOrdine;
	const marche = [...new Set(D.righe.flatMap(r => r.opzioni.map(o => o.marca)))];
	const filtro = `<div class="filter-row">
		<button class="tag-btn ${!S.filtroModello ? 'selected' : ''}" data-modello="">Tutti i modelli</button>
		${modelli.map(m => `<button class="tag-btn ${S.filtroModello === m ? 'selected' : ''}" data-modello="${h(m)}">${h(etichetta(m))}</button>`).join('')}
	</div>
	<div class="filter-row">
		<button class="tag-btn ${!S.filtroMarca ? 'selected' : ''}" data-marca="">Tutte le marche</button>
		${marche.map(m => `<button class="tag-btn ${S.filtroMarca === m ? 'selected' : ''}" data-marca="${h(m)}">Attuatori ${h(m.charAt(0) + m.slice(1).toLowerCase())}</button>`).join('')}
	</div>`;
	let gruppo = '';
	const marcaOk = o => !S.filtroMarca || o.marca === S.filtroMarca;
	const righe = D.righe.filter(r => (!S.filtroModello || r.modello === S.filtroModello) && r.opzioni.some(marcaOk));
	const body = righe.map(r => {
		const g = `${serieRiga(r)} — ${r.tipologia}`;
		const testa = g !== gruppo ? `<tr class="group-row"><td colspan="4" class="grp ${coloreFamiglia(r.modello)}">${h(g)}</td></tr>` : '';
		gruppo = g;
		const opz = r.opzioni.filter(marcaOk).map(o => {
			const note = [o.vie ? tag(`solo ${VIE_LABEL[o.vie]}`) : '', o.corpo_inox ? tag(`corpo inox → ${D.impostazioni.kit_corpo_inox}`) : ''].join(' ');
			return `<div class="opz-row">
				${marcaTag(o.marca)}
				${o.adattatore ? adattatorePill(o.adattatore, false) : pill('', 'no adattatore', 'pill-na')}
				${kitPill(o.kit, false)}
				<span class="res-muted">→</span> ${attuatorePill(o.attuatore)} ${note}
			</div>`;
		}).join('');
		const s = [r.modello, r.tipologia, r.misura, r.valvola_2vie, r.valvola_3vie,
			D.valvole[r.valvola_2vie]?.descrizione, D.valvole[r.valvola_3vie]?.descrizione,
			...r.opzioni.flatMap(o => [o.adattatore, o.kit, o.attuatore, o.marca])].join(' ');
		return testa + `<tr data-s="${h(s)}">
			<td class="code-cell"><span class="code">${h(r.misura)}</span></td>
			<td>${r.valvola_2vie ? valvolaPill(r.valvola_2vie) : pill('', 'NA', 'pill-na')}</td>
			<td>${r.valvola_3vie ? valvolaPill(r.valvola_3vie) : pill('', r.variante === 'IBRIDA' ? 'non ammessa' : 'NA', 'pill-na')}</td>
			<td><div class="opz-list">${opz}</div></td>
		</tr>`;
	}).join('');
	return `${legendaColori(['nm', 'valvole', 'proprieta', 'passaggio', 'marca', 'tipo'])}<section class="panel">${filtro}<div class="panel-body-flush">
		<table class="data-table acc-table">
			<thead><tr><th>Misura</th><th>Valvola 2-vie</th><th>Valvola 3-vie</th><th>Motorizzazione: marca · adattatore · kit → attuatore</th></tr></thead>
			<tbody>${body}</tbody>
		</table></div></section>`;
}

function usoPills(lista) {
	if (!lista?.length) return pill('', 'non usato', 'pill-gap');
	// raggruppa per modello + tipologia + vie: "GMC · ON-OFF · 2V: 10, 12, 16 mm"
	const gruppi = {};
	lista.forEach(({ r, vie }) => {
		const k = `${serieRiga(r)} · ${tipAbbr(r.tipologia)}${vie ? ' · ' + VIE_LABEL[vie] : ''}`;
		(gruppi[k] ||= { modello: r.modello, misure: new Set() }).misure.add(r.misura);
	});
	return `<div class="pill-wrap">${Object.entries(gruppi).map(([k, g]) =>
		pill('', `${k}: ${[...g.misure].sort((a, b) => misuraValore(a) - misuraValore(b)).join(', ')}`, coloreFamiglia(g.modello))).join('')}</div>`;
}

function vistaValvole() {
	const filtri = {
		tutte: ['Tutte', () => true],
		...Object.fromEntries(query('SELECT DISTINCT marca FROM valvole WHERE marca IS NOT NULL ORDER BY marca')
			.map(({ marca }) => ['marca:' + marca, [marca, v => v.marca === marca]])),
		pref: ['Preferenziali', v => !!v.preferenziale],
		ibride: ['Ibride INOX/K65', v => v.connessioni === IBRIDA],
		nonusate: ['Non usate', v => !D.uso.valvole[v.codice]],
		nondisp: ['Non disponibili', v => !v.disponibile]
	};
	const lista = Object.values(D.valvole)
		.filter(filtri[S.filtroValvole][1])
		.sort((a, b) => (a.marca || '').localeCompare(b.marca || '')
			|| (a.serie || '').localeCompare(b.serie || '')
			|| misuraValore(misuraDaDescrizione(a.descrizione) || '') - misuraValore(misuraDaDescrizione(b.descrizione) || '')
			|| a.descrizione.localeCompare(b.descrizione));
	let gruppo = '';
	const body = lista.map(v => {
		const g = `${v.marca || '—'}${v.serie ? ' — ' + v.serie : ''}`;
		const testa = g !== gruppo ? `<tr class="group-row"><td colspan="9" class="grp ${coloreMarca(v.marca)}">${h(g)}</td></tr>` : '';
		gruppo = g;
		return testa + `<tr data-s="${h([v.codice, v.descrizione, v.marca, v.serie, v.connessioni, v.note].join(' '))}" class="${v.disponibile ? '' : 'row-dim'}">
			<td>${valvolaPill(v.codice, false)}</td>
			<td class="desc-cell">${h(v.descrizione)}</td>
			<td>${prefTag(v.preferenziale)}</td>
			<td>${passaggioTag(v.passaggio)}</td>
			<td>${corpoTag(v.corpo)}</td>
			<td>${v.connessioni ? tag(v.connessioni, v.connessioni === IBRIDA ? 'c c-purple' : 'c ' + (COLORE_CORPO[v.connessioni] || 'c-slate')) : '<span class="res-muted">—</span>'}</td>
			<td>${v.disponibile ? tag('DISPONIBILE', 'pill-ok') : tag('NON DISPONIBILE', 'pill-err')}</td>
			<td>${v.disponibile || D.uso.valvole[v.codice] ? usoPills(D.uso.valvole[v.codice]) : '<span class="res-muted">—</span>'}</td>
			<td class="res-muted">${h(v.note || '')}</td>
		</tr>`;
	}).join('');
	return `${legendaColori(['valvole', 'proprieta', 'passaggio', 'corpo'])}<section class="panel">
		<div class="filter-row">${Object.entries(filtri).map(([k, [lab, fn]]) =>
			`<button class="tag-btn ${S.filtroValvole === k ? 'selected' : ''}" data-fv="${h(k)}">${h(lab)} <span class="res-muted">${Object.values(D.valvole).filter(fn).length}</span></button>`).join('')}</div>
		<div class="panel-body-flush"><table class="data-table">
			<thead><tr><th>Codice</th><th>Descrizione</th><th>Preferenziale</th><th>Sfera</th><th>Corpo</th><th>Connessioni</th><th>Stato</th><th>Usata in</th><th>Note</th></tr></thead>
			<tbody>${body}</tbody>
		</table></div></section>`;
}

function vistaArticoli() {
	const PILL = {
		attuatori: c => pill(c, '', coloreNm(D.attuatori[c].nm), D.attuatori[c].descrizione),
		kit: c => kitPill(c, false),
		adattatori: c => adattatorePill(c, false)
	};
	const tabella = (titolo, items, tipoUso, extraHead = '', extra = () => '') => `
		<section class="panel db-section">
			<div class="panel-head">${h(titolo)} <span>${items.length}</span></div>
			<div class="panel-body-flush"><table class="data-table">
				<thead><tr><th>Codice</th><th>Descrizione</th>${extraHead}<th>Usato in</th></tr></thead>
				<tbody>${items.map(i => `<tr data-s="${h(Object.values(i).join(' '))}">
					<td>${PILL[tipoUso](i.codice)}</td>
					<td class="desc-cell">${h(i.descrizione)}</td>
					${extra(i)}
					<td>${usoPills(D.uso[tipoUso][i.codice])}</td>
				</tr>`).join('')}</tbody>
			</table></div>
		</section>`;
	return legendaColori(['nm', 'tipo']) + tabella('Attuatori', Object.values(D.attuatori), 'attuatori',
			'<th>Tipo</th><th>Coppia</th><th>Alimentazione</th><th>Brand</th>',
			a => `<td>${tipoTag(a.tipo)}</td>
				<td>${tag(a.nm ? a.nm + ' Nm' : 'Watergate', coloreNm(a.nm))}</td>
				<td>${h(a.alimentazione || '—')}</td><td>${h(a.brand)}</td>`)
		+ tabella('Kit', Object.values(D.kit), 'kit')
		+ tabella('Adattatori', Object.values(D.adattatori), 'adattatori');
}

function vistaPunti() {
	return `<section class="panel"><div class="panel-body-flush"><table class="data-table">
		<thead><tr><th class="num">#</th><th>Punto di impianto</th><th>Nota mostrata nel selettore</th></tr></thead>
		<tbody>${D.punti.map(p => `<tr data-s="${h(p.nome + ' ' + (p.info || ''))}">
			<td class="num">${p.ordine}</td><td>${h(p.nome)}</td><td class="res-muted">${h(p.info || '')}</td>
		</tr>`).join('')}</tbody>
	</table></div></section>`;
}

// ---------------------------------------------------------------- matrice CAD/PDM
const sqlStr = v => v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const contesto = m => `${serieRiga(m)} · ${tipAbbr(m.tipologia)} · ${m.misura} · ${VIE_LABEL[m.vie]}`;

function prossimoCodice(usati) {
	let n = Math.max(0, ...[...usati].map(c => Number(c.slice(4))));
	return () => `CMB-${String(++n).padStart(4, '0')}`;
}

function vistaMatrice() {
	const statoOk = m => S.matriceStato === 'tutte'
		|| (S.matriceStato === 'dacompilare' && !m.codice_pdm)
		|| (S.matriceStato === 'compilate' && m.codice_pdm);
	const lista = D.matrice.filter(m => (!S.matriceModello || m.modello === S.matriceModello) && statoOk(m));
	const compilate = D.matrice.filter(m => m.codice_pdm).length;

	// Combinazioni nuove (senza codice): INSERT pronti con i numeri successivi
	const mancanti = D.matrice.filter(m => !m.codice);
	const nuovo = prossimoCodice(D.combinazioni.map(c => c.codice));
	const visti = new Set();
	const insert = mancanti.filter(m => {
		const k = [m.valvola, m.adattatore || '', m.kit, m.attuatore].join('|');
		return !visti.has(k) && visti.add(k);
	}).map(m => `INSERT INTO combinazioni VALUES ('${nuovo()}', ${sqlStr(m.valvola)}, ${sqlStr(m.adattatore)}, ${sqlStr(m.kit)}, ${sqlStr(m.attuatore)}, NULL, NULL, NULL);  -- ${contesto(m)}`).join('\n');

	let gruppo = '';
	const body = lista.map(m => {
		const g = `${serieRiga(m)} — ${m.tipologia}`;
		const testa = g !== gruppo ? `<tr class="group-row"><td colspan="8" class="grp ${coloreFamiglia(m.modello)}">${h(g)}</td></tr>` : '';
		gruppo = g;
		return testa + `<tr data-s="${h([m.codice, m.modello, m.tipologia, m.misura, m.valvola, m.adattatore, m.kit, m.attuatore, m.marca_attuatore, m.codice_pdm, m.codice_cad, m.note].join(' '))}">
			<td>${m.codice ? tag(m.codice, 'pill-cmb') : tag('SENZA CODICE', 'pill-err')}</td>
			<td><div class="pill-wrap">${tag(m.misura)} ${tag(VIE_LABEL[m.vie])} ${passaggioTag(D.valvole[m.valvola]?.passaggio)} ${tipoTag(m.tipologia)} ${marcaTag(m.marca_attuatore)} ${m.corpo_inox ? tag('CORPO INOX', 'c c-silver') : ''}</div></td>
			<td>${valvolaPill(m.valvola)}</td>
			<td>${m.adattatore ? adattatorePill(m.adattatore, false) : pill('', 'nessuno', 'pill-na')}</td>
			<td>${kitPill(m.kit, false)}</td>
			<td>${attuatorePill(m.attuatore, false)}</td>
			<td>${m.codice_pdm ? tag(m.codice_pdm, 'pill-ok') : pill('', 'da compilare', 'pill-gap')}</td>
			<td>${m.codice_cad ? tag(m.codice_cad, 'pill-ok') : pill('', 'da compilare', 'pill-gap')}${m.note ? `<div class="res-muted">${h(m.note)}</div>` : ''}</td>
		</tr>`;
	}).join('');

	const modelli = D.modelliOrdine.filter(mo => D.matrice.some(m => m.modello === mo));
	return `
		<section class="panel db-section"><div class="panel-body">
			<p class="db-hint" style="margin:0 0 10px">Ogni combinazione fisica <b>valvola + adattatore + kit + attuatore</b> ha un codice <span class="code">CMB-nnnn</span> fisso: non viene mai rinumerato.
			CAD + PDM compilano <b>Codice PDM</b> e <b>Codice CAD</b> nel file Excel; il file compilato si reimporta qui e diventa SQL da aggiungere in fondo a <span class="code">data/belimo.sql</span>.</p>
			<div class="pill-wrap">
				${tag(`${D.matrice.length} combinazioni`)} ${tag(`${compilate} compilate`, 'pill-ok')} ${tag(`${D.matrice.length - compilate} da compilare`, 'pill-gap')}
				${mancanti.length ? tag(`${mancanti.length} senza codice`, 'pill-err') : ''}
				<span style="flex:1"></span>
				<button id="matriceExport" class="btn btn-primary">Esporta Excel per CAD/PDM</button>
				<button id="matriceImport" class="btn btn-secondary">Importa Excel compilato</button>
				<input id="matriceFile" type="file" accept=".xlsx,.xls" hidden>
			</div>
			<div id="importResult">${S.importSql ?? ''}</div>
			${insert ? `<div class="sql-out"><p class="db-hint">Combinazioni nuove senza codice: aggiungi queste righe in fondo a <span class="code">data/belimo.sql</span>.</p>
				<textarea id="sqlNuove" class="sql-box" readonly>${h(insert)}</textarea>
				<button class="btn btn-secondary" data-copia="sqlNuove">Copia SQL</button></div>` : ''}
		</div></section>
		${legendaColori(['nm', 'valvole', 'proprieta', 'passaggio', 'marca', 'tipo'])}
		<section class="panel">
			<div class="filter-row">
				<button class="tag-btn ${!S.matriceModello ? 'selected' : ''}" data-mmodello="">Tutti i modelli</button>
				${modelli.map(mo => `<button class="tag-btn ${S.matriceModello === mo ? 'selected' : ''}" data-mmodello="${h(mo)}">${h(etichetta(mo))}</button>`).join('')}
			</div>
			<div class="filter-row">
				${[['tutte', 'Tutte'], ['dacompilare', 'Da compilare'], ['compilate', 'Compilate']].map(([k, l]) =>
					`<button class="tag-btn ${S.matriceStato === k ? 'selected' : ''}" data-mstato="${k}">${l}</button>`).join('')}
			</div>
			<div class="panel-body-flush"><table class="data-table mat-table">
				<thead><tr><th>Codice</th><th>Misura · vie · sfera · attuatore</th><th>Valvola</th><th>Adattatore</th><th>Kit</th><th>Attuatore</th><th>Codice PDM</th><th>Codice CAD</th></tr></thead>
				<tbody>${body}</tbody>
			</table></div>
		</section>`;
}

// ---------------------------------------------------------------- mosaico combinazioni
function vistaMosaico() {
	const lista = D.matrice.filter(m => (!S.matriceModello || m.modello === S.matriceModello)
		&& (S.matriceStato === 'tutte'
			|| (S.matriceStato === 'dacompilare' && !m.codice_pdm)
			|| (S.matriceStato === 'compilate' && m.codice_pdm)));
	const selezionata = S.mosaicoCodice !== null ? D.matrice[S.mosaicoCodice] || null : null;
	const modelli = D.modelliOrdine.filter(mo => D.matrice.some(m => m.modello === mo));
	const gruppi = [];
	lista.forEach(m => {
		const chiave = `${serieRiga(m)}|${m.tipologia}`;
		let g = gruppi.find(x => x.chiave === chiave);
		if (!g) gruppi.push(g = { chiave, titolo: `${serieRiga(m)} — ${m.tipologia}`, righe: [] });
		g.righe.push(m);
	});
	const colore = m => famiglia(m.modello) === 'GMC' ? 'mosaic-gmc' : famiglia(m.modello) === 'REF' ? 'mosaic-ref' : 'mosaic-other';
	return `
		<section class="panel db-section"><div class="panel-body">
			<p class="db-hint">Un quadratino corrisponde a una combinazione fisica. I gruppi mostrano a colpo d’occhio dove si concentrano le alternative; il tratteggio indica un codice PDM ancora da compilare.</p>
			<div class="pill-wrap">
				${tag(`${lista.length} combinazioni`)}
				${tag(`${lista.filter(m => m.codice_pdm).length} con PDM`, 'pill-ok')}
				${tag(`${lista.filter(m => !m.codice_pdm).length} senza PDM`, 'pill-gap')}
				${tag(`${lista.filter(m => m.caricata_pdm).length} caricate a PDM`, 'pill-ok')}
			</div>
			<p class="db-hint" style="margin:10px 0 0">Clicca un quadratino per vedere la configurazione del gruppo. Il pallino indica una combinazione già caricata a PDM.</p>
		</div></section>
		${legendaColori(['valvole'])}
		<section class="panel">
			<div class="filter-row mosaic-filter-row">
				<button class="tag-btn ${!S.matriceModello ? 'selected' : ''}" data-mmodello="">Tutti i modelli</button>
				${modelli.map(mo => `<button class="tag-btn ${S.matriceModello === mo ? 'selected' : ''}" data-mmodello="${h(mo)}">${h(etichetta(mo))}</button>`).join('')}
			</div>
			<div class="filter-row mosaic-filter-row">
				${[['tutte', 'Tutte'], ['dacompilare', 'PDM da compilare'], ['compilate', 'PDM compilato']].map(([k, l]) =>
					`<button class="tag-btn ${S.matriceStato === k ? 'selected' : ''}" data-mstato="${k}">${l}</button>`).join('')}
			</div>
			<div class="mosaic-groups">
				${gruppi.map(g => `<section class="mosaic-group"><div class="mosaic-group-head"><span>${h(g.titolo)}</span><span>${g.righe.length}</span></div>
					<div class="mosaic-grid">${g.righe.map(m => `<button type="button" class="mosaic-tile ${colore(m)} ${m.codice_pdm ? 'is-pdm' : 'is-uncompiled'} ${m.caricata_pdm ? 'is-caricata' : ''} ${selezionata === m ? 'is-selected' : ''}" data-mosaic="${D.matrice.indexOf(m)}" title="${h([m.codice || 'Senza codice', m.misura, VIE_LABEL[m.vie], D.valvole[m.valvola]?.descrizione || m.valvola, m.caricata_pdm ? 'Caricata a PDM' : 'Da caricare a PDM'].join(' · '))}" aria-label="${h([m.codice || 'Senza codice', m.misura, `${VIE_LABEL[m.vie]}`, m.caricata_pdm ? 'caricata a PDM' : 'da caricare a PDM'].join(', '))}">${h(m.codice ? m.codice.replace('CMB-', '') : '—')}</button>`).join('')}</div>
				</section>`).join('')}
			</div>
		</section>
		${selezionata ? modaleCombinazione(selezionata) : ''}`;
}

// Modale: configurazione completa di un assieme + stato PDM (sola lettura)
function modaleCombinazione(m) {
	const desc = (anag, codice) => anag[codice]?.descrizione || 'non in anagrafica';
	const riga = (ruolo, pillHtml, descrizione) => `<tr>
		<th>${h(ruolo)}</th><td>${pillHtml}</td><td class="desc-cell">${h(descrizione)}</td></tr>`;
	const att = D.attuatori[m.attuatore];
	const stato = m.caricata_pdm
		? `<button type="button" class="btn pdm-stato is-caricata" disabled title="Modificabile solo nel sorgente: tabella pdm_caricate in data/belimo.sql">✓ CARICATA A PDM${m.data_pdm ? ` · ${h(m.data_pdm)}` : ''}</button>`
		: `<button type="button" class="btn pdm-stato is-da-caricare" disabled title="Modificabile solo nel sorgente: tabella pdm_caricate in data/belimo.sql">DA CARICARE A PDM</button>`;
	return `<div class="modal mosaic-modal" data-chiudi-modale role="dialog" aria-modal="true" aria-labelledby="mosaicModalTitle">
		<div class="modal-box">
			<div class="modal-head">
				<h2 id="mosaicModalTitle">${m.codice ? tag(m.codice, 'pill-cmb') : tag('SENZA CODICE', 'pill-err')} ${h(serieRiga(m))} — ${h(m.tipologia)}</h2>
				<button type="button" class="btn btn-secondary" data-chiudi-modale aria-label="Chiudi">✕</button>
			</div>
			<div class="pill-wrap mosaic-modal-ctx">
				${tag(m.misura)} ${tag(VIE_LABEL[m.vie])} ${passaggioTag(D.valvole[m.valvola]?.passaggio)} ${tipoTag(m.tipologia)} ${marcaTag(m.marca_attuatore)} ${m.corpo_inox ? tag('CORPO INOX', 'c c-silver') : ''}
			</div>
			<div class="modal-scroll">
				<table class="data-table mosaic-modal-table"><tbody>
					${riga('Valvola', valvolaPill(m.valvola, false), desc(D.valvole, m.valvola))}
					${riga('Adattatore', m.adattatore ? adattatorePill(m.adattatore, false) : pill('', 'nessuno', 'pill-na'), m.adattatore ? desc(D.adattatori, m.adattatore) : '—')}
					${riga('Kit', kitPill(m.kit, false), desc(D.kit, m.kit))}
					${riga('Attuatore', attuatorePill(m.attuatore, false), att ? [att.descrizione, att.alimentazione].filter(Boolean).join(' · ') : 'non in anagrafica')}
					${riga('Codice PDM', m.codice_pdm ? tag(m.codice_pdm, 'pill-ok') : pill('', 'da compilare', 'pill-gap'), '')}
					${riga('Codice CAD', m.codice_cad ? tag(m.codice_cad, 'pill-ok') : pill('', 'da compilare', 'pill-gap'), '')}
					${m.note ? riga('Note', '', m.note) : ''}
				</tbody></table>
			</div>
			<div class="mosaic-modal-foot">${stato}</div>
		</div>
	</div>`;
}

function chiudiModale() {
	S.mosaicoCodice = null;
	render();
}

// SheetJS caricato solo quando serve
function caricaXlsx() {
	if (window.XLSX) return Promise.resolve(window.XLSX);
	return new Promise((ok, ko) => {
		const s = document.createElement('script');
		s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
		s.onload = () => ok(window.XLSX);
		s.onerror = () => ko(new Error('Impossibile caricare la libreria Excel'));
		document.head.appendChild(s);
	});
}

const COLONNE_MATRICE = ['Codice combinazione', 'Modello valvola', 'Variante', 'Misura', 'Vie', 'Sfera', 'Tipo attuatore', 'Marca attuatore', 'Kit corpo inox',
	'Valvola', 'Descrizione valvola', 'Valvola preferenziale', 'Adattatore', 'Descrizione adattatore', 'Kit', 'Descrizione kit',
	'Attuatore', 'Descrizione attuatore', 'Codice PDM', 'Codice CAD', 'Note'];

async function esportaMatrice() {
	const XLSX = await caricaXlsx();
	const righe = D.matrice.filter(m => m.codice).map(m => [
		m.codice, etichetta(m.modello), VARIANTE_LABEL[m.variante] || m.variante, m.misura, VIE_LABEL[m.vie], D.valvole[m.valvola]?.passaggio || 'DA DEFINIRE', m.tipologia, m.marca_attuatore, m.corpo_inox ? 'SI' : '',
		m.valvola, D.valvole[m.valvola]?.descrizione || '',
		({ GENERALE: 'SI', NAVALE: 'SI (navale)' })[D.valvole[m.valvola]?.preferenziale] || 'NO',
		m.adattatore || '', m.adattatore ? D.adattatori[m.adattatore]?.descrizione || '' : 'non richiesto',
		m.kit, D.kit[m.kit]?.descrizione || '',
		m.attuatore, D.attuatori[m.attuatore]?.descrizione || '',
		m.codice_pdm || '', m.codice_cad || '', m.note || ''
	]);
	const ws = XLSX.utils.aoa_to_sheet([COLONNE_MATRICE, ...righe]);
	ws['!cols'] = COLONNE_MATRICE.map(c => ({ wch: /Descrizione/.test(c) ? 40 : Math.max(12, c.length + 2) }));
	ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: righe.length, c: COLONNE_MATRICE.length - 1 } }) };
	const istr = XLSX.utils.aoa_to_sheet([
		['Matrice combinazioni valvola + adattatore + kit + attuatore'],
		[''],
		['Compilare SOLO le colonne: Codice PDM, Codice CAD, Note.'],
		['Non modificare né cancellare la colonna "Codice combinazione": è la chiave di reimport.'],
		['Le altre colonne sono informative (generate dal database).'],
		['Restituire il file compilato: si reimporta da database.html > Matrice CAD/PDM > Importa Excel compilato.'],
		[''],
		[`Generato il ${new Date().toLocaleDateString('it-IT')} — ${righe.length} combinazioni`]
	]);
	istr['!cols'] = [{ wch: 100 }];
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Matrice');
	XLSX.utils.book_append_sheet(wb, istr, 'Istruzioni');
	XLSX.writeFile(wb, `matrice_combinazioni_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function importaMatrice(file) {
	const out = document.getElementById('importResult');
	try {
		const XLSX = await caricaXlsx();
		const wb = XLSX.read(await file.arrayBuffer());
		const ws = wb.Sheets['Matrice'] || wb.Sheets[wb.SheetNames[0]];
		const righe = XLSX.utils.sheet_to_json(ws, { defval: '' });
		const pulisci = v => String(v ?? '').trim();
		const perCodice = Object.fromEntries(D.combinazioni.map(c => [c.codice, c]));
		const update = [], sconosciuti = [];
		righe.forEach(r => {
			const codice = pulisci(r['Codice combinazione']);
			if (!codice) return;
			const c = perCodice[codice];
			if (!c) { sconosciuti.push(codice); return; }
			const nuovo = { codice_pdm: pulisci(r['Codice PDM']), codice_cad: pulisci(r['Codice CAD']), note: pulisci(r['Note']) };
			const cambi = Object.entries(nuovo).filter(([k, v]) => v !== (c[k] ?? ''));
			if (cambi.length) update.push(`UPDATE combinazioni SET ${cambi.map(([k, v]) => `${k} = ${sqlStr(v)}`).join(', ')} WHERE codice = '${codice}';`);
		});
		const sql = update.length ? `-- Import matrice CAD/PDM: ${file.name} (${new Date().toLocaleDateString('it-IT')})\n${update.join('\n')}` : '';
		S.importSql = `<div class="sql-out">
			<div class="pill-wrap">${tag(file.name)} ${tag(`${update.length} combinazioni aggiornate`, update.length ? 'pill-ok' : '')}
				${sconosciuti.length ? tag(`${sconosciuti.length} codici sconosciuti: ${sconosciuti.slice(0, 8).join(', ')}${sconosciuti.length > 8 ? '…' : ''}`, 'pill-err') : ''}</div>
			${sql ? `<p class="db-hint">Aggiungi queste righe in fondo a <span class="code">data/belimo.sql</span> per salvare i codici. Anteprima già applicata qui sotto.</p>
				<textarea id="sqlImport" class="sql-box" readonly>${h(sql)}</textarea>
				<button class="btn btn-secondary" data-copia="sqlImport">Copia SQL</button>` : '<p class="db-hint">Nessuna differenza rispetto al database.</p>'}
		</div>`;
		// Anteprima: applica in memoria (non salva su file)
		if (update.length) {
			window.db.exec(update.join('\n'));
			caricaDati();
			CHECKS = calcolaControlli();
			renderRiepilogo();
		}
		render();
	} catch (e) {
		out.innerHTML = `<p class="sql-error">Import non riuscito: ${h(e.message)}</p>`;
	}
}

function copiaTesto(id, btn) {
	const el = document.getElementById(id);
	el.select();
	(navigator.clipboard?.writeText(el.value) ?? Promise.reject()).catch(() => document.execCommand('copy'));
	btn.textContent = 'Copiato';
}

const PRESET_SQL = {
	'Valvole GMC': `SELECT codice, descrizione, serie, passaggio, connessioni, disponibile, note
FROM valvole WHERE marca = 'GMC'
ORDER BY serie, descrizione;`,
	'Matrice CAD/PDM': `SELECT codice, modello, variante, tipologia, misura, vie, marca_attuatore,
       valvola, adattatore, kit, attuatore, corpo_inox, codice_pdm, codice_cad
FROM matrice
ORDER BY codice;`,
	'Accoppiamenti completi': `SELECT a.modello, a.variante, a.tipologia, a.misura,
       a.valvola_2vie, a.valvola_3vie, t.brand AS marca, o.adattatore,
       o.kit, o.attuatore, t.tipo, t.nm, o.vie, o.corpo_inox
FROM accoppiamenti a
JOIN opzioni o   ON o.accoppiamento_id = a.id
JOIN attuatori t ON t.codice = o.attuatore
ORDER BY a.id, o.ordine;`,
	'Regola GMC per misura': `SELECT a.misura, o.adattatore, o.kit, o.attuatore,
       GROUP_CONCAT(a.variante, ', ') AS varianti
FROM accoppiamenti a JOIN opzioni o ON o.accoppiamento_id = a.id
WHERE a.modello LIKE 'GMC%'
GROUP BY a.misura, o.adattatore, o.kit, o.attuatore;`,
	'Schema tabelle': `SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'trigger') ORDER BY type, name;`
};

function vistaSql() {
	const testo = S.sqlTesto ?? PRESET_SQL['Valvole GMC'];
	return `<section class="panel"><div class="panel-body">
		<p class="db-hint">Interroga il database direttamente. Le modifiche fatte qui restano solo in questa scheda del browser: per cambiare i dati si modifica <span class="code">data/belimo.sql</span>.</p>
		<div class="sql-presets">${Object.keys(PRESET_SQL).map(k => `<button class="tag-btn" data-preset="${h(k)}">${h(k)}</button>`).join('')}</div>
		<textarea id="sqlBox" class="sql-box" spellcheck="false">${h(testo)}</textarea>
		<div class="actions"><button id="sqlRun" class="btn btn-primary">Esegui (Ctrl+Invio)</button></div>
		<div id="sqlResult" class="sql-result"></div>
	</div></section>`;
}

function eseguiSql() {
	const box = document.getElementById('sqlBox');
	const out = document.getElementById('sqlResult');
	S.sqlTesto = box.value;
	try {
		const res = window.db.exec(box.value);
		if (!res.length) { out.innerHTML = '<p class="res-muted">Nessun risultato.</p>'; return; }
		const r = res[res.length - 1];
		out.innerHTML = `<p class="res-muted">${r.values.length} righe</p><table class="data-table">
			<thead><tr>${r.columns.map(c => `<th>${h(c)}</th>`).join('')}</tr></thead>
			<tbody>${r.values.map(v => `<tr>${v.map(c => `<td>${c === null ? '<span class="res-muted">NULL</span>' : h(c)}</td>`).join('')}</tr>`).join('')}</tbody>
		</table>`;
	} catch (e) {
		out.innerHTML = `<p class="sql-error">${h(e.message)}</p>`;
	}
}

// ---------------------------------------------------------------- render
const TABS = {
	controlli: ['Controlli', vistaControlli, () => CHECKS.filter(c => c.livello !== 'info').reduce((n, c) => n + c.items.length, 0)],
	copertura: ['Copertura misure', vistaCopertura, () => null],
	accoppiamenti: ['Accoppiamenti', vistaAccoppiamenti, () => D.righe.length],
	valvole: ['Valvole', vistaValvole, () => Object.keys(D.valvole).length],
	articoli: ['Kit · Attuatori · Adattatori', vistaArticoli, () => Object.keys(D.kit).length + Object.keys(D.attuatori).length + Object.keys(D.adattatori).length],
	punti: ['Punti impianto', vistaPunti, () => D.punti.length],
	matrice: ['Matrice CAD/PDM', vistaMatrice, () => D.matrice.length],
	mosaico: ['Mosaico combinazioni', vistaMosaico, () => D.matrice.length],
	sql: ['SQL', vistaSql, () => null]
};

function renderRiepilogo() {
	const err = CHECKS.filter(c => c.livello === 'err').reduce((n, c) => n + c.items.length, 0);
	const warn = CHECKS.filter(c => c.livello === 'warn').reduce((n, c) => n + c.items.length, 0);
	const stat = (v, l, cls = '') => `<div class="db-stat ${cls}"><div class="db-stat-value">${v}</div><div class="db-stat-label">${l}</div></div>`;
	const vals = Object.values(D.valvole);
	document.getElementById('riepilogo').innerHTML =
		stat(vals.length, `Valvole (${vals.filter(v => v.marca === 'GMC').length} GMC)`)
		+ stat(vals.filter(v => v.connessioni === IBRIDA).length, 'Ibride INOX/K65')
		+ stat(D.righe.length, 'Righe accoppiamento')
		+ stat(Object.keys(D.attuatori).length + Object.keys(D.kit).length, 'Attuatori + kit')
		+ stat(err, 'Errori', err ? 'is-err' : 'is-ok')
		+ stat(warn, 'Da verificare', warn ? 'is-warn' : 'is-ok');
}

function render() {
	document.getElementById('tabs').innerHTML = Object.entries(TABS).map(([k, [lab, , n]]) => {
		const c = n();
		return `<button class="tag-btn ${S.tab === k ? 'selected' : ''}" data-tab="${k}">${h(lab)}${c !== null ? `<span class="db-count">${c}</span>` : ''}</button>`;
	}).join('');
	document.getElementById('vista').innerHTML = TABS[S.tab][1]();
	applicaRicerca();
}

function applicaRicerca() {
	const q = norm(document.getElementById('cerca').value);
	const vista = document.getElementById('vista');
	vista.querySelectorAll('tr[data-s]').forEach(tr => {
		tr.classList.toggle('hidden-by-search', !!q && !norm(tr.dataset.s).includes(q));
	});
	vista.querySelectorAll('details.db-check').forEach(d => {
		d.classList.toggle('hidden-by-search', !!q && !norm(d.textContent).includes(q));
	});
	// nasconde le intestazioni di gruppo rimaste vuote
	vista.querySelectorAll('tr.group-row').forEach(g => {
		let n = g.nextElementSibling, visibili = false;
		while (n && !n.classList.contains('group-row')) {
			if (!n.classList.contains('hidden-by-search')) { visibili = true; break; }
			n = n.nextElementSibling;
		}
		g.classList.toggle('hidden-by-search', !visibili);
	});
}

document.addEventListener('click', e => {
	// Modale mosaico: chiusura con ✕ o clic sullo sfondo (non dentro il box)
	const chiudi = e.target.closest('[data-chiudi-modale]');
	if (chiudi && (chiudi.tagName === 'BUTTON' || e.target === chiudi)) { chiudiModale(); return; }
	const t = e.target.closest('button');
	if (!t) return;
	if (t.dataset.tab) { S.tab = t.dataset.tab; S.mosaicoCodice = null; history.replaceState(null, '', '#' + S.tab); render(); }
	else if (t.dataset.modello !== undefined) { S.filtroModello = t.dataset.modello || null; render(); }
	else if (t.dataset.marca !== undefined) { S.filtroMarca = t.dataset.marca || null; render(); }
	else if (t.dataset.mmodello !== undefined) { S.matriceModello = t.dataset.mmodello || null; render(); }
	else if (t.dataset.mstato) { S.matriceStato = t.dataset.mstato; render(); }
	else if (t.dataset.mosaic !== undefined) { S.mosaicoCodice = Number(t.dataset.mosaic); render(); }
	else if (t.id === 'matriceExport') esportaMatrice();
	else if (t.id === 'matriceImport') document.getElementById('matriceFile').click();
	else if (t.dataset.copia) copiaTesto(t.dataset.copia, t);
	else if (t.dataset.fv) { S.filtroValvole = t.dataset.fv; render(); }
	else if (t.dataset.preset) { S.sqlTesto = PRESET_SQL[t.dataset.preset]; render(); eseguiSql(); }
	else if (t.id === 'sqlRun') eseguiSql();
});

document.addEventListener('keydown', e => {
	if (e.key === 'Escape' && S.mosaicoCodice !== null) { chiudiModale(); return; }
	if (e.target.id === 'sqlBox' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); eseguiSql(); }
});

document.addEventListener('DOMContentLoaded', async () => {
	document.getElementById('cerca').addEventListener('input', applicaRicerca);
	document.addEventListener('change', e => {
		if (e.target.id === 'matriceFile' && e.target.files[0]) importaMatrice(e.target.files[0]);
	});
	try {
		await apriDatabase();
	} catch (e) {
		document.getElementById('vista').innerHTML = `<p class="sql-error">Impossibile caricare il database: ${h(e.message)}</p>`;
		return;
	}
	caricaDati();
	COPERTURA = calcolaCopertura();
	CHECKS = calcolaControlli();
	document.getElementById('dbFonte').textContent = D.impostazioni.fonte || 'data/belimo.sql';
	const hash = location.hash.slice(1);
	if (TABS[hash]) S.tab = hash;
	renderRiepilogo();
	render();
	if (S.tab === 'sql') eseguiSql();
});
