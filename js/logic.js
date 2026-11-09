// Array per le configurazioni salvate
window.configurazioniSalvate = [];
// Risultato mostrato a video (usato da salvataggio ed export)
window.risultatoCorrente = null;
// Attuatore cambiato a mano: resta valido finché non cambia la valvola
// { valvola, attuatore, kit, adattatore } — kit/adattatore undefined = valore suggerito
let sceltaManuale = null;

// Dati letti via SQL da data/belimo.sql (tabella accoppiamenti valvole-motori)
let dati = { modelli: {}, kit: [], adattatori: [], attuatori: [], accoppiamenti: [] };

const VIE_TESTO = { '2': '2-VIE', '3': '3-VIE' };

function renderRecapPills(items, type, emptyLabel = 'N/A') {
	if (!items || items.length === 0) {
		return `<span class="recap-pill recap-pill-empty">${emptyLabel}</span>`;
	}

	return items.map(item => {
		const code = item.codice || item.code || item;
		const meta = item.meta || item.descrizione || item.description || '';
		return `
			<span class="recap-pill recap-pill-${type}" title="${escapeHtml(meta || code)}">
				<span class="recap-pill-code">${escapeHtml(code)}</span>
				${meta ? `<span class="recap-pill-meta">${escapeHtml(meta)}</span>` : ''}
			</span>
		`;
	}).join('');
}

function trovaKit(codice) {
	return dati.kit.find(k => k.codice === codice) || { codice, descrizione: '' };
}

function trovaAdattatore(codice) {
	return codice ? (dati.adattatori.find(a => a.codice === codice) || { codice, descrizione: '' }) : null;
}

function trovaAttuatore(codice) {
	return dati.attuatori.find(a => a.codice === codice) || { codice, descrizione: '' };
}

function testoArticolo(item) {
	return item ? `${item.codice} — ${item.descrizione || ''}` : '';
}

// Opzioni adattatore+kit+attuatore valide per la riga, le vie e la marca attuatore scelte
// (con sostituzione kit corpo inox)
function opzioniPerVie(riga, vie, corpoInox, marca) {
	return riga.opzioni
		.filter(o => (!o.vie || o.vie === vie) && (!marca || o.marca === marca))
		.map(o => ({
			adattatore: trovaAdattatore(o.adattatore),
			kit: trovaKit(corpoInox && o.corpoInox ? dati.kitCorpoInox : o.kit),
			attuatore: trovaAttuatore(o.attuatore)
		}));
}

// Stessa marca e stesso torque = stesso accoppiamento meccanico: kit e adattatore sono identici
// tra versione ON-OFF e MODULANTE (regola utente 2026-11-09)
function stessaMeccanica(a, b) {
	return a.brand === b.brand && (a.Nm ?? null) === (b.Nm ?? null);
}

function equivalentiDi(attuatore, tipologia) {
	return dati.attuatori.filter(a => a.codice !== attuatore.codice && stessaMeccanica(a, attuatore) && (!tipologia || a.tipo === tipologia));
}

// Opzioni di una riga trasferite agli attuatori di pari meccanica della tipologia voluta
// (es. modulante su GMC full passage: kit e adattatore dell'ON-OFF di pari torque)
function opzioniEquivalenti(riga, vie, corpoInox, tipologia, marca) {
	const visti = new Set();
	return opzioniPerVie(riga, vie, corpoInox).flatMap(o =>
		equivalentiDi(o.attuatore, tipologia)
			.filter(a => !marca || a.brand === marca)
			.map(a => ({ adattatore: o.adattatore, kit: o.kit, attuatore: a, equivalenteDi: o.attuatore })))
		.filter(o => {
			const chiave = [o.adattatore?.codice || '', o.kit.codice, o.attuatore.codice].join('|');
			if (visti.has(chiave)) return false;
			visti.add(chiave);
			return true;
		});
}

// Adattatore più usato con l'attuatore (e, se indicato, con quel kit) nelle regole
function adattatoreTipico(attuatore, kit) {
	const righe = dati.accoppiamenti.flatMap(r => r.opzioni).filter(o => o.attuatore === attuatore);
	const conKit = righe.filter(o => o.kit === kit);
	const conteggi = {};
	(conKit.length ? conKit : righe).forEach(o => { conteggi[o.adattatore || ''] = (conteggi[o.adattatore || ''] || 0) + 1; });
	const migliore = Object.entries(conteggi).sort((a, b) => b[1] - a[1])[0];
	return migliore ? trovaAdattatore(migliore[0] || null) : null;
}

// Kit per un attuatore senza regola sulla valvola: quello usato con lo stesso attuatore
// sulla stessa misura dello stesso modello (altra variante/tipologia), altrimenti nessuno
function kitSuggerito(riga, attuatore, s) {
	for (const r of dati.accoppiamenti) {
		if (r.modello !== riga.modello || r.misura !== riga.misura) continue;
		const vieOk = o => !o.vie || o.vie === s.vie;
		const att = trovaAttuatore(attuatore);
		const o = r.opzioni.find(o => o.attuatore === attuatore && vieOk(o))
			|| r.opzioni.find(o => vieOk(o) && stessaMeccanica(trovaAttuatore(o.attuatore), att));
		if (o) return { kit: trovaKit(s.corpoInox && o.corpoInox ? dati.kitCorpoInox : o.kit), adattatore: trovaAdattatore(o.adattatore), dedotto: true };
	}
	return { kit: null, adattatore: adattatoreTipico(attuatore, null), dedotto: false };
}

// Attuatori proponibili per la valvola, in tre gruppi:
//  auto     = scelta automatica (prima opzione della regola per la marca selezionata)
//  previsto = altre opzioni delle regole per la stessa valvola (anche di altre marche): kit noto
//  altro    = altri attuatori della stessa tipologia: kit suggerito o da scegliere, da verificare
//  altroTipo = attuatori dell'altra tipologia (es. modulante su sfera full passage): da verificare
function candidatiAttuatore(riga, valvola, opzioni, s) {
	const lista = [];
	const visti = new Set();
	const aggiungi = (o, gruppo) => {
		const chiave = [o.adattatore?.codice || '', o.kit.codice, o.attuatore.codice].join('|');
		if (visti.has(chiave)) return;
		visti.add(chiave);
		lista.push({ ...o, gruppo });
	};
	opzioni.forEach((o, i) => aggiungi(o, i === 0 ? 'auto' : 'previsto'));
	dati.accoppiamenti.forEach(r => ['2', '3'].forEach(v => {
		if (r.valvole[v]?.codice !== valvola.codice) return;
		opzioniPerVie(r, v, s.corpoInox).forEach(o => {
			aggiungi(o, 'previsto');
			// stessa meccanica (es. versione modulante dell'on-off): stessi kit e adattatore
			equivalentiDi(o.attuatore).forEach(a => aggiungi({ ...o, attuatore: a, equivalenteDi: o.attuatore }, 'previsto'));
		});
	}));
	const previsti = new Set(lista.map(c => c.attuatore.codice));
	dati.attuatori
		.filter(a => !previsti.has(a.codice))
		.sort((a, b) => (a.brand === s.marca ? 0 : 1) - (b.brand === s.marca ? 0 : 1))
		.forEach(a => lista.push({ attuatore: a, ...kitSuggerito(riga, a.codice, s), gruppo: a.tipo === s.tipologia ? 'altro' : 'altroTipo' }));
	// Senza regola (fuori regola) si parte dal primo attuatore della tipologia e marca scelte
	if (!lista.some(c => c.gruppo === 'auto')) {
		const primo = lista.findIndex(c => c.gruppo === 'altro' && c.attuatore.brand === s.marca);
		if (primo > 0) lista.unshift(...lista.splice(primo, 1));
	}
	return lista;
}

// Base dati: apriDatabase() e query() sono in js/db.js
async function caricaDati() {
	await apriDatabase();

	const impostazioni = Object.fromEntries(query('SELECT chiave, valore FROM impostazioni').map(r => [r.chiave, r.valore]));
	const valvola = codice => codice ? query('SELECT codice, descrizione, passaggio, corpo, connessioni FROM valvole WHERE codice = ?', [codice])[0] || { codice, descrizione: '' } : null;

	dati = {
		fonte: impostazioni.fonte,
		kitCorpoInox: impostazioni.kit_corpo_inox,
		modelli: Object.fromEntries(query('SELECT codice, etichetta FROM modelli ORDER BY ordine').map(m => [m.codice, m.etichetta])),
		kit: query('SELECT codice, descrizione FROM kit ORDER BY rowid'),
		adattatori: query('SELECT codice, descrizione FROM adattatori ORDER BY rowid'),
		attuatori: query('SELECT codice, descrizione, brand, tipo, nm AS Nm, alimentazione FROM attuatori ORDER BY rowid'),
		accoppiamenti: ordinaPerMisura(query(`
			SELECT a.id, a.modello, a.variante, a.tipologia, a.misura, a.valvola_2vie, a.valvola_3vie
			FROM accoppiamenti a JOIN modelli m ON m.codice = a.modello
			ORDER BY m.ordine, a.id`)).map(r => ({
				modello: r.modello,
				variante: r.variante,
				tipologia: r.tipologia,
				misura: r.misura,
				valvole: { '2': valvola(r.valvola_2vie), '3': valvola(r.valvola_3vie) },
				opzioni: query(`
					SELECT o.adattatore, o.kit, o.attuatore, o.vie, o.corpo_inox, t.brand AS marca
					FROM opzioni o JOIN attuatori t ON t.codice = o.attuatore
					WHERE o.accoppiamento_id = ? ORDER BY o.ordine`, [r.id])
					.map(({ corpo_inox, ...o }) => ({ ...o, corpoInox: !!corpo_inox }))
			}))
	};
	window.puntiImpianto = query('SELECT nome, info FROM punti_impianto ORDER BY ordine');
}

function getSelezioneCorrente() {
	const s = window.statoSelezione || {};
	return {
		puntoImpianto: document.getElementById('puntoImpiantoSelect')?.value || '',
		modello: s.modello,
		passaggio: s.passaggio,
		variante: s.variante,
		tipologia: s.tipologia,
		marca: s.marca,
		misura: s.misura,
		vie: s.vie,
		corpoInox: !!s.corpoInox
	};
}

function mostraRisultatoAutomatico() {
	const s = getSelezioneCorrente();
	// Serve tutto selezionato
	if (!s.modello || !s.variante || !s.tipologia || !s.marca || !s.misura || !s.vie) {
		nascondiSceltaAttuatore();
		document.getElementById('risultato').classList.add('hidden');
		nascondiErrore();
		window.risultatoCorrente = null;
		return;
	}
	const stessaValvola = r => r.modello === s.modello && r.variante === s.variante && r.misura === s.misura
		&& r.valvole[s.vie]?.passaggio === s.passaggio;
	let riga = dati.accoppiamenti.find(r => stessaValvola(r) && r.tipologia === s.tipologia);
	// Nessuna regola per questa tipologia (es. modulante su full passage): valvola dell'altra regola,
	// nessuna scelta automatica
	const fuoriRegola = !riga;
	if (fuoriRegola) riga = dati.accoppiamenti.find(stessaValvola);
	const valvola = riga?.valvole[s.vie];
	if (!valvola) {
		mostraErrore('Nessuna valvola disponibile per la combinazione selezionata.');
		return;
	}
	const opzioni = fuoriRegola
		? opzioniEquivalenti(riga, s.vie, s.corpoInox, s.tipologia, s.marca)
		: opzioniPerVie(riga, s.vie, s.corpoInox, s.marca);
	if (!fuoriRegola && opzioni.length === 0) {
		mostraErrore(`Nessun attuatore ${s.marca} configurato per questa combinazione.`);
		return;
	}
	renderRisultato({ valvola, riga, opzioni, s });
}

function renderRisultato({ valvola, riga, opzioni, s }) {
	const risultato = document.getElementById('risultato');
	const selezioneInfo = document.getElementById('selezioneInfo');
	const valvolaInfo = document.getElementById('valvolaInfo');
	const kitInfo = document.getElementById('kitInfo');
	const adattatoreInfo = document.getElementById('adattatoreInfo');
	const motoreInfo = document.getElementById('motoreInfo');

	// Riga della tabella risultato: etichetta | codice | descrizione
	const resRow = (label, item, vuoto = '—') => `
		<div class="res-row">
			<span class="res-label">${label}</span>
			${item
				? `<span class="code">${escapeHtml(item.codice)}</span><span class="res-desc">${escapeHtml(item.descrizione)}</span>`
				: `<span class="res-desc res-muted">${vuoto}</span>`}
		</div>`;
	const selectRow = (label, id, html) => `
		<div class="res-row res-row-top">
			<span class="res-label">${label}</span>
			<select id="${id}" class="res-select">${html}</select>
		</div>`;
	const opt = (value, testo, selezionato) =>
		`<option value="${escapeHtml(value)}"${selezionato ? ' selected' : ''}>${escapeHtml(testo)}</option>`;
	const gruppo = (titolo, items) => items.length ? `<optgroup label="${escapeHtml(titolo)}">${items.join('')}</optgroup>` : '';

	// Tipo di sfera (FULL PASSAGE / V-PORT) accanto alla descrizione
	valvolaInfo.innerHTML = `
		<div class="res-row">
			<span class="res-label">Valvola</span>
			<span class="code">${escapeHtml(valvola.codice)}</span>
			<span class="res-desc">${escapeHtml(valvola.descrizione)} <span class="vp-pills">${pillValvola(valvola)}</span></span>
		</div>`;

	const candidati = candidatiAttuatore(riga, valvola, opzioni, s);
	// Una scelta manuale sopravvive solo se la valvola non è cambiata (es. spunta corpo inox)
	if (sceltaManuale && sceltaManuale.valvola !== valvola.codice) sceltaManuale = null;
	let idx = 0;
	if (sceltaManuale) {
		// Stesso attuatore e (se nota) stessa regola; altrimenti basta l'attuatore
		const stesso = c => c.gruppo !== 'auto' && c.attuatore.codice === sceltaManuale.attuatore;
		idx = candidati.findIndex((c, i) => stesso(c, i) && (!sceltaManuale.kitRegola || c.kit?.codice === sceltaManuale.kitRegola));
		if (idx < 0) idx = candidati.findIndex(stesso);
		if (idx < 0) { idx = 0; sceltaManuale = null; }
	}
	const haAuto = candidati[0]?.gruppo === 'auto';

	// Attuatore: select raggruppata; il kit segue l'attuatore scelto
	const voce = i => {
		const c = candidati[i];
		const kit = (c.kit ? ` · kit ${c.kit.codice}` : ' · kit da scegliere') + (c.equivalenteDi ? ` (come ${c.equivalenteDi.codice})` : '');
		return opt(i, `${c.attuatore.codice} — ${c.attuatore.descrizione}${kit}`, i === idx);
	};
	const indici = g => candidati.map((c, i) => c.gruppo === g ? i : -1).filter(i => i >= 0);
	// La scelta dell'attuatore sta nel pannello Selezione, sotto la barra "Attuatore"
	document.getElementById('attuatoreScelta').innerHTML = `<select id="attuatoreSelect">${
		gruppo('Automatica (da regola)', indici('auto').map(voce)) +
		gruppo('Alternative previste per questa valvola', indici('previsto').map(voce)) +
		gruppo(`Altri attuatori ${s.tipologia} — kit da verificare`, indici('altro').map(voce)) +
		gruppo(`Attuatori ${s.tipologia === 'ON-OFF' ? 'MODULANTE' : 'ON-OFF'} — kit da verificare`, indici('altroTipo').map(voce))}</select>`;
	document.getElementById('attuatoreBox').style.display = '';

	const aggiorna = () => {
		const c = candidati[idx];
		const manuale = c.gruppo !== 'auto';
		// Senza regola anche il primo attuatore è una scelta manuale
		if (manuale && !sceltaManuale) sceltaManuale = { valvola: valvola.codice, attuatore: c.attuatore.codice, kitRegola: c.kit?.codice };
		const daVerificare = c.gruppo === 'altro' || c.gruppo === 'altroTipo';
		const att = c.attuatore;
		const kitScelto = sceltaManuale?.kit;
		const adattScelto = sceltaManuale?.adattatore;
		const kit = kitScelto !== undefined ? (kitScelto ? trovaKit(kitScelto) : null) : c.kit;
		const adattatore = adattScelto !== undefined
			? trovaAdattatore(adattScelto || null)
			: (kitScelto !== undefined ? adattatoreTipico(att.codice, kit?.codice) : c.adattatore);

		// Flag selezione automatica / manuale
		let nota = 'Attuatore, adattatore e kit dalle regole di accoppiamento';
		if (manuale && !daVerificare) nota = 'Attuatore cambiato a mano · adattatore e kit dalle regole per questa valvola';
		if (c.equivalenteDi) {
			if (c.gruppo === 'auto') nota = `Nessuna regola ${s.tipologia} per questa valvola`;
			nota += ` · kit e adattatore come ${c.equivalenteDi.codice} ${c.equivalenteDi.descrizione} (stessa marca e torque, stesso accoppiamento meccanico)`;
		}
		if (daVerificare) {
			nota = haAuto
				? 'Attuatore cambiato a mano · nessuna regola per questa valvola: kit e adattatore da verificare'
				: `Nessuna regola ${s.tipologia} per questa valvola · attuatore, kit e adattatore scelti a mano, da verificare`;
			if (c.dedotto && kitScelto === undefined) nota += ` (kit suggerito: usato con ${att.codice} su ${riga.modello} ${riga.misura})`;
		}
		// Le regole abbinano i modulanti alle sfere V-PORT: qui è un'eccezione voluta
		if (att.tipo === 'MODULANTE' && valvola.passaggio !== 'V-PORT') nota += ' · attuatore MODULANTE su sfera ' + (valvola.passaggio || 'non V-PORT');
		selezioneInfo.innerHTML = `
			<div class="res-row">
				<span class="res-label">Selezione</span>
				<span class="sel-flag ${manuale ? 'sel-manual' : 'sel-auto'}">${manuale ? 'MANUALE' : 'AUTOMATICA'}</span>
				<span class="res-desc ${daVerificare ? 'sel-warn' : 'res-muted'}">${escapeHtml(nota)}${manuale && haAuto ? ' <button type="button" id="ripristinaAutoBtn" class="btn-link">Ripristina automatica</button>' : ''}</span>
			</div>`;
		document.getElementById('attuatoreFlag').innerHTML =
			`<span class="sel-flag ${manuale ? 'sel-manual' : 'sel-auto'}">${manuale ? 'MANUALE' : 'AUTOMATICA'}</span>`;
		motoreInfo.innerHTML = resRow('Attuatore', att);

		if (daVerificare) {
			// Adattatore e kit modificabili: prima quelli già usati con questo attuatore
			const usati = dati.accoppiamenti.flatMap(r => r.opzioni).filter(o => o.attuatore === att.codice);
			const kitUsati = new Set(usati.map(o => o.kit));
			const adattUsati = new Set(usati.map(o => o.adattatore || ''));
			const voceKit = k => opt(k.codice, `${k.codice} — ${k.descrizione}`, k.codice === kit?.codice);
			kitInfo.innerHTML = selectRow('Kit', 'kitSelect',
				opt('', '— scegli il kit —', !kit) +
				gruppo(`Usati con ${att.codice}`, dati.kit.filter(k => kitUsati.has(k.codice)).map(voceKit)) +
				gruppo('Altri kit', dati.kit.filter(k => !kitUsati.has(k.codice)).map(voceKit)));
			const voceAdatt = a => opt(a.codice, `${a.codice} — ${a.descrizione}`, a.codice === adattatore?.codice);
			adattatoreInfo.innerHTML = selectRow('Adattatore', 'adattatoreSelect',
				opt('', 'Non richiesto', !adattatore) +
				gruppo(`Usati con ${att.codice}`, dati.adattatori.filter(a => adattUsati.has(a.codice)).map(voceAdatt)) +
				gruppo('Altri adattatori', dati.adattatori.filter(a => !adattUsati.has(a.codice)).map(voceAdatt)));
			document.getElementById('kitSelect').addEventListener('change', function() {
				sceltaManuale.kit = this.value;
				sceltaManuale.adattatore = undefined; // l'adattatore torna a seguire il kit
				aggiorna();
			});
			document.getElementById('adattatoreSelect').addEventListener('change', function() {
				sceltaManuale.adattatore = this.value;
				aggiorna();
			});
		} else {
			adattatoreInfo.innerHTML = resRow('Adattatore', adattatore, 'Non richiesto');
			kitInfo.innerHTML = resRow('Kit', kit);
		}

		// Codice combinazione della matrice CAD/PDM
		const comb = kit ? query(`SELECT codice, codice_pdm FROM combinazioni
			WHERE valvola = ? AND COALESCE(adattatore, '') = ? AND kit = ? AND attuatore = ?`,
			[valvola.codice, adattatore?.codice || '', kit.codice, att.codice])[0] || null : null;
		document.getElementById('combinazioneInfo').innerHTML = comb
			? resRow('Combinazione', { codice: comb.codice, descrizione: comb.codice_pdm ? `PDM ${comb.codice_pdm}` : 'codice PDM da compilare' })
			: resRow('Combinazione', null, kit ? 'Nessun codice in matrice' : 'Scegli il kit');

		window.risultatoCorrente = kit
			? { valvola, adattatore, kit, motore: att, combinazione: comb, manuale, daVerificare }
			: null;
		['saveConfigBtn', 'exportCsvBtn'].forEach(id => {
			const b = document.getElementById(id);
			if (b) { b.style.display = ''; b.disabled = !kit; }
		});

		const ripristina = document.getElementById('ripristinaAutoBtn');
		if (ripristina) ripristina.addEventListener('click', () => {
			sceltaManuale = null;
			idx = 0;
			document.getElementById('attuatoreSelect').value = '0';
			aggiorna();
		});
	};

	document.getElementById('attuatoreSelect').addEventListener('change', function() {
		idx = Number(this.value);
		const c = candidati[idx];
		sceltaManuale = c.gruppo === 'auto' ? null : { valvola: valvola.codice, attuatore: c.attuatore.codice, kitRegola: c.kit?.codice };
		aggiorna();
	});
	aggiorna();

	risultato.classList.remove('hidden');
	nascondiErrore();
}

function nascondiSceltaAttuatore() {
	const box = document.getElementById('attuatoreBox');
	if (box) box.style.display = 'none';
	document.getElementById('attuatoreScelta').innerHTML = '';
	document.getElementById('attuatoreFlag').innerHTML = '';
}

function mostraErrore(msg) {
	nascondiSceltaAttuatore();
	const el = document.getElementById('errore');
	el.textContent = msg;
	el.classList.remove('hidden');
	document.getElementById('risultato').classList.add('hidden');
	window.risultatoCorrente = null;
	// Nascondi il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) exportBtn.style.display = 'none';

	// Nascondi il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) saveBtn.style.display = 'none';
}

function nascondiErrore() {
	const el = document.getElementById('errore');
	el.textContent = '';
	el.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
	await caricaDati();
	window.onSelezioneCambiata = mostraRisultatoAutomatico;
	if (window.initTagUI) window.initTagUI(dati);
	// Popola la select punto di impianto
	const select = document.getElementById('puntoImpiantoSelect');
	const infoIcon = document.getElementById('puntoImpiantoInfoIcon');
	const infoMsg = document.getElementById('puntoImpiantoInfoMsg');
	if (select && window.puntiImpianto) {
		select.innerHTML = '<option value="">Seleziona punto di impianto...</option>' + window.puntiImpianto.map(p => `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`).join('');
		select.addEventListener('change', function() {
			const info = window.puntiImpianto.find(p => p.nome === select.value)?.info;
			if (info) {
				infoIcon.style.display = '';
				infoMsg.style.display = '';
				infoMsg.textContent = info;
			} else {
				infoIcon.style.display = 'none';
				infoMsg.style.display = 'none';
				infoMsg.textContent = '';
			}
		});
		// Mostra info se già selezionato
		select.dispatchEvent(new Event('change'));
		// Tooltip su icona
		if (infoIcon) {
			infoIcon.onclick = function() {
				alert(infoMsg.textContent);
			};
		}
	}

	// Collega il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) {
		exportBtn.addEventListener('click', () => {
			if (typeof esportaRisultatoCSV === 'function') esportaRisultatoCSV();
		});
	}

	// Collega il pulsante Salva riepilogo PDF
	const exportSummaryPdfBtn = document.getElementById('exportSummaryPdfBtn');
	if (exportSummaryPdfBtn) {
		exportSummaryPdfBtn.addEventListener('click', () => {
			if (typeof esportaRiepilogoPDF === 'function') esportaRiepilogoPDF();
		});
	}

	// Collega il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) {
		saveBtn.addEventListener('click', () => {
			const r = window.risultatoCorrente;
			if (!r) return;
			window.configurazioniSalvate.push({
				...getSelezioneCorrente(),
				combinazione: r.combinazione?.codice || '',
				valvola: testoArticolo(r.valvola),
				kit: testoArticolo(r.kit),
				adattatore: r.adattatore ? testoArticolo(r.adattatore) : '',
				motore: testoArticolo(r.motore),
				selezione: testoSelezione(r),
				// per richiamare la riga nel selettore
				manuale: sceltaManuale ? { ...sceltaManuale, kit: r.kit.codice, adattatore: r.adattatore?.codice || '' } : null,
				daVerificare: !!r.daVerificare
			});
			aggiornaTabellaConfigurazioni();
			// Selettore pulito per la configurazione successiva
			sceltaManuale = null;
			const punto = document.getElementById('puntoImpiantoSelect');
			if (punto) { punto.value = ''; punto.dispatchEvent(new Event('change')); }
			window.impostaSelezione();
		});
	}

	// Collega il pulsante esporta tutte in CSV
	const exportAllBtn = document.getElementById('exportAllCsvBtn');
	if (exportAllBtn) {
		exportAllBtn.addEventListener('click', () => {
			esportaTutteConfigurazioniCSV();
		});
	}

	// Collega il pulsante Mostra Recap
	const toggleRecapBtn = document.getElementById('toggleRecapBtn');
	const recapModal = document.getElementById('recapModal');
	const closeRecapBtn = document.getElementById('closeRecapBtn');
	if (toggleRecapBtn && recapModal) {
		toggleRecapBtn.addEventListener('click', () => {
			mostraRecapConfigurazione();
			recapModal.style.display = 'flex';
		});
	}
	if (closeRecapBtn && recapModal) {
		closeRecapBtn.addEventListener('click', () => {
			recapModal.style.display = 'none';
		});
	}
});

// Mostra la tabella accoppiamenti valvole-motori
function mostraRecapConfigurazione() {
	const recapContent = document.getElementById('recapContent');
	const articoliBox = document.getElementById('articoliDisponibili');
	if (!recapContent) return;

	if (!dati.accoppiamenti || dati.accoppiamenti.length === 0) {
		recapContent.innerHTML = '<p class="res-muted">Dati non ancora caricati.</p>';
		return;
	}

	// Popola la sidebar con articoli disponibili
	if (articoliBox) {
		const sezione = (titolo, items) => `
			<div class="side-group"><h4>${titolo}</h4>
				${items.map(i => `<div class="side-item"><span class="side-code">${escapeHtml(i.codice)}</span>${escapeHtml(i.descrizione)}</div>`).join('')}
			</div>`;
		articoliBox.innerHTML =
			sezione('Kit', dati.kit) +
			sezione('Attuatori', dati.attuatori) +
			sezione('Adattatori', dati.adattatori);
	}

	let html = `
		<div class="recap-toolbar">
			<div class="recap-count">${dati.accoppiamenti.length} righe — ${escapeHtml(dati.fonte || '')}</div>
		</div>
		<div class="recap-table-wrap">
			<table class="recap-rules-table">
				<thead>
					<tr>
						<th>Misura</th>
						<th>Valvola 2-vie</th>
						<th>Valvola 3-vie</th>
						<th>Adattatore</th>
						<th>Kit attuatore</th>
						<th>Attuatore</th>
					</tr>
				</thead>
				<tbody>
	`;

	let gruppoCorrente = '';
	dati.accoppiamenti.forEach(r => {
		const gruppo = `${nomeSerie(dati.modelli?.[r.modello] || r.modello, r.variante)} — ${r.tipologia}`;
		if (gruppo !== gruppoCorrente) {
			gruppoCorrente = gruppo;
			html += `<tr class="recap-brand-row"><td colspan="6">${escapeHtml(gruppo)}</td></tr>`;
		}
		// Una voce per opzione, nello stesso ordine in adattatore / kit / attuatore
		const adattatoriItems = r.opzioni.map(o => trovaAdattatore(o.adattatore) || { codice: '—', descrizione: 'non richiesto' });
		const kitItems = r.opzioni.map(o => {
			const k = trovaKit(o.kit);
			const note = [o.vie ? `solo ${VIE_TESTO[o.vie]}` : '', o.corpoInox ? `corpo inox: ${dati.kitCorpoInox}` : ''].filter(Boolean).join(' · ');
			return { codice: k.codice, descrizione: note ? `${k.descrizione} (${note})` : k.descrizione };
		});
		const attuatoriHtml = r.opzioni.map(o => {
			const a = trovaAttuatore(o.attuatore);
			return `
				<div class="recap-pair">
					<span class="recap-pill ${a.brand === 'WATERGATE' ? 'recap-pill-watergate' : 'recap-pill-brand'}" title="${escapeHtml(a.descrizione)}">
						<span class="recap-pill-code">${escapeHtml(a.codice)}</span>
						<span class="recap-pill-meta">${escapeHtml(a.descrizione)}</span>
					</span>
					<span class="recap-pill ${a.tipo === 'MODULANTE' ? 'recap-pill-modulating' : 'recap-pill-onoff'}" title="${escapeHtml(a.tipo || 'N/A')}">
						<span class="recap-pill-code">${a.tipo === 'MODULANTE' ? 'MOD' : escapeHtml(a.tipo || 'N/A')}</span>
					</span>
				</div>`;
		}).join('');

		html += `
			<tr>
				<td class="recap-valve-cell"><div class="recap-valve-title">${escapeHtml(r.misura)}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(r.valvole['2'] ? [r.valvole['2']] : [], 'geometry', 'NA')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(r.valvole['3'] ? [r.valvole['3']] : [], 'vport', 'NA')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(adattatoriItems, 'adapter', 'Non richiesto')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(kitItems, 'kit')}</div></td>
				<td><div class="recap-pill-stack">${attuatoriHtml}</div></td>
			</tr>
		`;
	});

	html += `
				</tbody>
			</table>
		</div>
		<p class="recap-footnote">(*) Versione corpo inox: usare il kit ${escapeHtml(dati.kitCorpoInox || '')} al posto di 25C162A.</p>
	`;
	recapContent.innerHTML = html;
}

function aggiornaTabellaConfigurazioni() {
	const box = document.getElementById('configListBox');
	const table = document.getElementById('configListTable');
	if (!box || !table) return;
	if (window.configurazioniSalvate.length === 0) {
		box.style.display = 'none';
		table.innerHTML = '';
		return;
	}
	box.style.display = '';
	// Header
	table.innerHTML = `<thead><tr><th>#</th><th>Punto impianto</th><th>Valvola</th><th>Attuatore</th><th>Adattatore</th><th>Kit</th></tr></thead>`;
	// Pill quadrata a due righe: codice sopra, descrizione sotto
	const cella = testo => {
		const [codice, ...resto] = String(testo || '').split(' — ');
		return codice
			? `<span class="item-pill"><span class="item-pill-code">${escapeHtml(codice)}</span><span class="item-pill-desc">${escapeHtml(resto.join(' — '))}</span></span>`
			: '<span class="res-muted">Non richiesto</span>';
	};
	table.innerHTML += '<tbody>' + window.configurazioniSalvate.map((cfg, i) => `<tr class="row-richiama" data-idx="${i}" title="Richiama nel selettore">
		<td class="num">${i + 1}</td>
		<td class="punto-cell">${escapeHtml(cfg.puntoImpianto) || '<span class="res-muted">—</span>'}</td>
		<td>${cella(cfg.valvola)}</td>
		<td>${cella(cfg.motore)}</td>
		<td>${cella(cfg.adattatore)}</td>
		<td>${cella(cfg.kit)}</td>
	</tr>`).join('') + '</tbody>';
	table.querySelectorAll('tr.row-richiama').forEach(tr => {
		tr.addEventListener('click', () => richiamaConfigurazione(window.configurazioniSalvate[Number(tr.dataset.idx)]));
	});
}

// Testo del flag automatica / manuale (lista, CSV, PDF)
function testoSelezione(r) {
	return r.manuale ? (r.daVerificare ? 'Manuale - kit da verificare' : 'Manuale') : 'Automatica';
}

// Riporta una configurazione salvata nel selettore come nuova riga (senza punto di impianto)
function richiamaConfigurazione(cfg) {
	if (!cfg) return;
	sceltaManuale = cfg.manuale ? { ...cfg.manuale } : null;
	// Kit e adattatore restano quelli salvati solo se erano scelti a mano (kit da verificare)
	if (sceltaManuale && !cfg.daVerificare) { delete sceltaManuale.kit; delete sceltaManuale.adattatore; }
	const punto = document.getElementById('puntoImpiantoSelect');
	if (punto) { punto.value = ''; punto.dispatchEvent(new Event('change')); }
	const { modello, passaggio, variante, tipologia, marca, misura, vie, corpoInox } = cfg;
	window.impostaSelezione({ modello, passaggio, variante, tipologia, marca, misura, vie, corpoInox });
	document.querySelector('.layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Esporta tutte le configurazioni salvate in un unico CSV
function esportaTutteConfigurazioniCSV() {
	if (configurazioniSalvate.length === 0) return;
	// Raggruppa articoli (valvola, kit, adattatore, motore) e somma le quantità
	const articoli = {};
	const aggiungi = (tipo, descrizione) => {
		if (!descrizione) return;
		if (!articoli[descrizione]) articoli[descrizione] = { tipo, descrizione, quantita: 1 };
		else articoli[descrizione].quantita++;
	};
	configurazioniSalvate.forEach(cfg => {
		aggiungi('Valvola', cfg.valvola);
		aggiungi('Kit', cfg.kit);
		aggiungi('Adattatore', cfg.adattatore);
		aggiungi('Motore', cfg.motore);
	});
	mostraCsvArticoliPreviewModal(articoli);
}

// Mostra il modal di preview con lista articoli e quantità
function mostraCsvArticoliPreviewModal(articoli) {
	const modal = document.getElementById('csvPreviewModal');
	const tableBox = document.getElementById('csvPreviewTableBox');
	if (!modal || !tableBox) return;
	// Costruisci la lista HTML
	let html = '<table class="data-table">';
	html += '<thead><tr><th>Articolo</th><th class="num">Q.tà</th></tr></thead>';
	Object.values(articoli).forEach(a => {
		html += `<tr><td>${escapeHtml(a.descrizione)}</td><td class="num">${a.quantita}</td></tr>`;
	});
	html += '</table>';
	tableBox.innerHTML = html;
	modal.style.display = 'flex';

	// Gestione pulsanti
	const btnConferma = document.getElementById('csvPreviewConfirmBtn');
	const btnAnnulla = document.getElementById('csvPreviewCancelBtn');
	if (btnConferma) {
		btnConferma.onclick = function() {
			esportaCsvArticoli(articoli);
			modal.style.display = 'none';
		};
	}
	if (btnAnnulla) {
		btnAnnulla.onclick = function() {
			modal.style.display = 'none';
		};
	}
}

// Esporta i dati articoli (descrizione + quantità)
function esportaCsvArticoli(articoli) {
	const header = ['Articolo','Quantità'];
	const rows = Object.values(articoli).map(a => [a.descrizione, a.quantita]);
	let csv = [header, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'articoli.csv';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
