// Array per le configurazioni salvate
window.configurazioniSalvate = [];
// Opzione kit/attuatore selezionata quando ci sono multiple opzioni
window.kitSelezionato = null;
window.motoreSelezionato = null;
// Risultato mostrato a video (usato da salvataggio ed export)
window.risultatoCorrente = null;

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

// Base dati: apriDatabase() e query() sono in js/db.js
async function caricaDati() {
	await apriDatabase();

	const impostazioni = Object.fromEntries(query('SELECT chiave, valore FROM impostazioni').map(r => [r.chiave, r.valore]));
	const valvola = codice => codice ? query('SELECT codice, descrizione, passaggio FROM valvole WHERE codice = ?', [codice])[0] || { codice, descrizione: '' } : null;

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
		document.getElementById('risultato').classList.add('hidden');
		nascondiErrore();
		window.risultatoCorrente = null;
		return;
	}
	const riga = dati.accoppiamenti.find(r => r.modello === s.modello && r.variante === s.variante && r.tipologia === s.tipologia && r.misura === s.misura);
	const valvola = riga?.valvole[s.vie];
	if (!valvola) {
		mostraErrore('Nessuna valvola disponibile per la combinazione selezionata.');
		return;
	}
	const opzioni = opzioniPerVie(riga, s.vie, s.corpoInox, s.marca);
	if (opzioni.length === 0) {
		mostraErrore(`Nessun attuatore ${s.marca} configurato per questa combinazione.`);
		return;
	}
	renderRisultato({ valvola, opzioni });
}

function renderRisultato({ valvola, opzioni }) {
	const risultato = document.getElementById('risultato');
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

	// Tipo di sfera (FULL PASSAGE / V-PORT) accanto alla descrizione
	valvolaInfo.innerHTML = resRow('Valvola', { codice: valvola.codice, descrizione: [valvola.descrizione, valvola.passaggio].filter(Boolean).join(' · ') });

	// L'adattatore dipende dall'opzione scelta (es. Watergate non lo richiede)
	const mostraMotore = opzione => {
		const a = opzione.attuatore;
		adattatoreInfo.innerHTML = resRow('Adattatore', opzione.adattatore, 'Non richiesto');
		motoreInfo.innerHTML = resRow('Attuatore', a);
		// Codice combinazione della matrice CAD/PDM
		const comb = query(`SELECT codice, codice_pdm FROM combinazioni
			WHERE valvola = ? AND COALESCE(adattatore, '') = ? AND kit = ? AND attuatore = ?`,
			[valvola.codice, opzione.adattatore?.codice || '', opzione.kit.codice, a.codice])[0] || null;
		document.getElementById('combinazioneInfo').innerHTML = comb
			? resRow('Combinazione', { codice: comb.codice, descrizione: comb.codice_pdm ? `PDM ${comb.codice_pdm}` : 'codice PDM da compilare' })
			: resRow('Combinazione', null, 'Nessun codice in matrice');
		window.kitSelezionato = opzione.kit;
		window.motoreSelezionato = a;
		window.risultatoCorrente = { valvola, adattatore: opzione.adattatore, kit: opzione.kit, motore: a, combinazione: comb };
	};

	const mostraKit = opzione => {
		kitInfo.querySelector('.kit-scelto').innerHTML = resRow('Kit', opzione.kit);
	};

	if (opzioni.length > 1) {
		// Più opzioni per la stessa marca: si sceglie l'attuatore, kit e adattatore seguono
		const righe = opzioni.map((o, idx) => `
			<label class="kit-option">
				<input type="radio" name="kitChoice" value="${idx}" ${idx === 0 ? 'checked' : ''}>
				<span class="code">${escapeHtml(o.attuatore.codice)}</span>
				<span class="res-desc">${escapeHtml(o.attuatore.descrizione)}</span>
				<span class="res-muted">kit ${escapeHtml(o.kit.codice)}</span>
			</label>
		`).join('');
		kitInfo.innerHTML = `
			<div class="res-row res-row-top">
				<span class="res-label">Opzione</span>
				<div class="kit-options">${righe}</div>
			</div>
			<div class="kit-scelto"></div>`;
		kitInfo.querySelectorAll('input[name="kitChoice"]').forEach(radio => {
			radio.addEventListener('change', function() {
				mostraKit(opzioni[Number(this.value)]);
				mostraMotore(opzioni[Number(this.value)]);
			});
		});
	} else {
		kitInfo.innerHTML = '<div class="kit-scelto"></div>';
	}
	mostraKit(opzioni[0]);
	mostraMotore(opzioni[0]);

	risultato.classList.remove('hidden');
	nascondiErrore();
	// Mostra il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) exportBtn.style.display = '';

	// Mostra il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) saveBtn.style.display = '';
}

function mostraErrore(msg) {
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
				motore: testoArticolo(r.motore)
			});
			aggiornaTabellaConfigurazioni();
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
	table.innerHTML = `<thead><tr><th>#</th><th>Combinazione</th><th>Punto impianto</th><th>Valvola</th><th>Adattatore</th><th>Kit</th><th>Attuatore</th></tr></thead>`;
	// Righe
	const cella = testo => {
		const [codice, ...resto] = String(testo || '').split(' — ');
		return codice ? `<span class="code">${escapeHtml(codice)}</span> ${escapeHtml(resto.join(' — '))}` : '<span class="res-muted">Non richiesto</span>';
	};
	table.innerHTML += '<tbody>' + window.configurazioniSalvate.map((cfg, i) => `<tr>
		<td class="num">${i + 1}</td>
		<td>${cfg.combinazione ? `<span class="code">${escapeHtml(cfg.combinazione)}</span>` : '<span class="res-muted">—</span>'}</td>
		<td>${escapeHtml(cfg.puntoImpianto) || '<span class="res-muted">—</span>'}</td>
		<td>${cella(cfg.valvola)}</td>
		<td>${cella(cfg.adattatore)}</td>
		<td>${cella(cfg.kit)}</td>
		<td>${cella(cfg.motore)}</td>
	</tr>`).join('') + '</tbody>';
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
