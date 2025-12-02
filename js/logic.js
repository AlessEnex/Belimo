// Array per le configurazioni salvate
window.configurazioniSalvate = [];
// Kit selezionato quando ci sono multiple opzioni
window.kitSelezionato = null;
// Caricamento dati valvole e motori e inizializzazione UI a tag
let valvole = [];
let motori = [];
let kit = [];
let adattatori = [];
let mappaKit = {};
let mappaMotore = {};
let mappaAdattatore = {};

async function caricaDati() {
	const [valvoleRes, motoriRes, kitRes, adattatoriRes, mappaKitRes, mappaMotoreRes, mappaAdattatoreRes, puntiImpiantoRes] = await Promise.all([
		fetch('data/valvole.json'),
		fetch('data/motori.json'),
		fetch('data/kit.json'),
		fetch('data/adattatori.json'),
		fetch('data/mappa_valvola_kit.json'),
		fetch('data/mappa_valvola_motore.json'),
		fetch('data/mappa_valvola_adattatore.json'),
		fetch('data/punti_impianto.json')
	]);
	valvole = (await valvoleRes.json()).valvole;
	motori = (await motoriRes.json()).motori;
	kit = (await kitRes.json()).kit;
	adattatori = (await adattatoriRes.json()).adattatori;
	mappaKit = (await mappaKitRes.json()).mappa;
	mappaMotore = (await mappaMotoreRes.json()).mappa;
	mappaAdattatore = (await mappaAdattatoreRes.json()).mappa;
	window.puntiImpianto = (await puntiImpiantoRes.json()).punti || [];
}

function getSelezioneCorrente() {
	return {
		puntoImpianto: document.getElementById('puntoImpiantoSelect')?.value || '',
		brandValvola: window.statoSelezione?.brandValvola,
		materialeValvola: window.statoSelezione?.materialeValvola,
		diametroValvola: window.statoSelezione?.diametroValvola,
		brandMotore: window.statoSelezione?.brandMotore,
		tipoMotore: window.statoSelezione?.tipoMotore
	};
}

function mostraRisultatoAutomatico() {
	const s = getSelezioneCorrente();
	// Serve tutto selezionato
	if (!s.brandValvola || !s.materialeValvola || !s.diametroValvola || !s.brandMotore || !s.tipoMotore) {
		document.getElementById('risultato').classList.add('hidden');
		return;
	}
	// Trova la valvola
	const valvola = valvole.find(v => v.brand === s.brandValvola && v.materiale === s.materialeValvola && String(v.diametro) === String(s.diametroValvola));
	if (!valvola) {
		mostraErrore('Nessuna valvola trovata per la combinazione selezionata.');
		return;
	}
	// Key per le mappe
	const baseKey = `${s.brandValvola}_${s.materialeValvola}_${s.diametroValvola}`;
	const key = s.brandMotore === 'WATERGATE' ? `${baseKey}_WATERGATE` : baseKey;
	// Kit
	const kitCodes = mappaKit[key] || [];
	const kitObjects = kitCodes.map(kc => kit.find(k => k.codice === kc)).filter(Boolean);
	// Motori
	const motoriCodes = mappaMotore[key] || [];
	const motoriCompatibili = motoriCodes.map(mc => motori.find(m => m.codice === mc)).filter(Boolean);
	const motoriDelTipo = motoriCompatibili.filter(m => m.brand === s.brandMotore && m.tipo === s.tipoMotore);
	// Adattatore
	let adattatoreCodice = null;
	if (s.brandMotore !== 'WATERGATE') adattatoreCodice = mappaAdattatore[baseKey] || null;
	const adattatoreObj = adattatoreCodice ? adattatori.find(a => a.codice === adattatoreCodice) : null;
	if (!motoriDelTipo || motoriDelTipo.length === 0) {
		mostraErrore('Nessun motore trovato per questa combinazione di brand/tipo.');
		return;
	}
	renderRisultato({ valvola, adattatoreObj, kitObjects, motoriDelTipo });
}

function renderRisultato({ valvola, adattatoreObj, kitObjects, motoriDelTipo }) {
	const risultato = document.getElementById('risultato');
	const valvolaInfo = document.getElementById('valvolaInfo');
	const kitInfo = document.getElementById('kitInfo');
	const adattatoreInfo = document.getElementById('adattatoreInfo');
	const motoreInfo = document.getElementById('motoreInfo');

	valvolaInfo.innerHTML = '';

	if (kitObjects.length > 1) {
		// Più kit disponibili: mostra radio button per scegliere
		const righe = kitObjects.map((k, idx) => `
			<label style="display:block;margin:6px 0;cursor:pointer;">
				<input type="radio" name="kitChoice" value="${k.codice}" ${idx === 0 ? 'checked' : ''}>
				<span class="code">${k.codice}</span> — ${k.descrizione || ''}
			</label>
		`).join('');
		kitInfo.innerHTML = '<p style="font-weight:600;margin-bottom:8px;">Scegli un kit:</p>' + righe;
		// Imposta il kit selezionato di default
		window.kitSelezionato = kitObjects[0];
		// Aggiungi listener per il cambio di selezione
		setTimeout(() => {
			document.querySelectorAll('input[name="kitChoice"]').forEach(radio => {
				radio.addEventListener('change', function() {
					window.kitSelezionato = kitObjects.find(k => k.codice === this.value);
				});
			});
		}, 0);
	} else if (kitObjects.length === 1) {
		// Un solo kit: mostra normalmente
		kitInfo.innerHTML = `<p><span class="code">${kitObjects[0].codice}</span> — ${kitObjects[0].descrizione || ''}</p>`;
		window.kitSelezionato = kitObjects[0];
	} else {
		kitInfo.innerHTML = `<p>Nessun kit configurato per questa combinazione.</p>`;
		window.kitSelezionato = null;
	}

	if (adattatoreObj) {
		adattatoreInfo.innerHTML = `<p><span class="code">${adattatoreObj.codice}</span> — ${adattatoreObj.descrizione || ''}</p>`;
	} else {
		adattatoreInfo.innerHTML = `<p>Non richiesto.</p>`;
	}

	// Motori: se più di uno, mostra radio button
	if (motoriDelTipo.length > 1) {
		const righe = motoriDelTipo.map((m, idx) => `
			<label style="display:block;margin:6px 0;cursor:pointer;">
				<input type="radio" name="motoreChoice" value="${m.codice}" ${idx === 0 ? 'checked' : ''}>
				<span class="code">${m.codice}</span> — ${m.descrizione || m.tipo + ' ' + (m.Nm ? m.Nm + 'Nm' : '')}
			</label>
		`).join('');
		motoreInfo.innerHTML = '<p style="font-weight:600;margin-bottom:8px;">Scegli un motore:</p>' + righe;
		// Imposta il motore selezionato di default
		window.motoreSelezionato = motoriDelTipo[0];
		// Aggiungi listener per il cambio di selezione
		setTimeout(() => {
			document.querySelectorAll('input[name="motoreChoice"]').forEach(radio => {
				radio.addEventListener('change', function() {
					window.motoreSelezionato = motoriDelTipo.find(m => m.codice === this.value);
				});
			});
		}, 0);
	} else if (motoriDelTipo.length === 1) {
		// Un solo motore: mostra normalmente
		motoreInfo.innerHTML = `<p><span class="code">${motoriDelTipo[0].codice}</span> — ${motoriDelTipo[0].descrizione || motoriDelTipo[0].tipo + ' ' + (motoriDelTipo[0].Nm ? motoriDelTipo[0].Nm + 'Nm' : '')}</p>`;
		window.motoreSelezionato = motoriDelTipo[0];
	}

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
	if (window.initTagUI) window.initTagUI(valvole, motori);
	// Popola la select punto di impianto
	const select = document.getElementById('puntoImpiantoSelect');
	const infoIcon = document.getElementById('puntoImpiantoInfoIcon');
	const infoMsg = document.getElementById('puntoImpiantoInfoMsg');
	if (select && window.puntiImpianto) {
		select.innerHTML = '<option value="">Seleziona punto di impianto...</option>' + window.puntiImpianto.map(p => `<option value="${p}">${p}</option>`).join('');
		select.addEventListener('change', function() {
			if (select.value === 'Collettore AUX-PDC') {
				infoIcon.style.display = '';
				infoMsg.style.display = '';
				infoMsg.textContent = 'Questa configurazione si riferisce a quando ci sono circuiti con pompa di calore o aria condizionata che richiedono un motore sul collettore di aspirazione che divide due bancate di compressori';
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
	// Aggancia la funzione di autocalcolo ai cambiamenti dei tag
	document.body.addEventListener('click', e => {
		if (e.target.classList.contains('tag-btn') && !e.target.classList.contains('disabled')) {
			setTimeout(mostraRisultatoAutomatico, 0);
		}
	});

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
			// Usa il motore selezionato se disponibile
			const motoreScelto = window.motoreSelezionato;
			const motore = motoreScelto ? `${motoreScelto.codice} — ${motoreScelto.descrizione || motoreScelto.tipo + ' ' + (motoreScelto.Nm ? motoreScelto.Nm + 'Nm' : '')}` : document.getElementById('motoreInfo').innerText.trim();
			// Usa il kit selezionato se disponibile, altrimenti prendi il testo
			const kit = window.kitSelezionato ? `${window.kitSelezionato.codice} — ${window.kitSelezionato.descrizione || ''}` : document.getElementById('kitInfo').innerText.trim();
			const adattatore = document.getElementById('adattatoreInfo').innerText.trim();
			const selezione = getSelezioneCorrente();
			window.configurazioniSalvate.push({
				...selezione,
				kit,
				adattatore,
				motore
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

// Mostra tutte le regole di mappatura disponibili nei JSON
function mostraRecapConfigurazione() {
	const recapContent = document.getElementById('recapContent');
	const articoliBox = document.getElementById('articoliDisponibili');
	if (!recapContent) return;
	
	if (!valvole || valvole.length === 0) {
		recapContent.innerHTML = '<p style="color:#8e8e93;text-align:center;padding:20px;">Dati non ancora caricati.</p>';
		return;
	}

	// Popola la sidebar con articoli disponibili
	if (articoliBox) {
		let sidebarHtml = '';
		
		// Valvole
		sidebarHtml += '<div style="margin-bottom:16px;"><h4 style="color:#007aff;font-size:0.9em;margin:0 0 8px 0;">Valvole</h4>';
		sidebarHtml += '<div style="font-size:0.8em;color:#8e8e93;line-height:1.6;">';
		valvole.forEach(v => {
			sidebarHtml += `<div>${v.brand} ${v.materiale} ${v.diametro}mm</div>`;
		});
		sidebarHtml += '</div></div>';
		
		// Kit
		sidebarHtml += '<div style="margin-bottom:16px;"><h4 style="color:#007aff;font-size:0.9em;margin:0 0 8px 0;">Kit</h4>';
		sidebarHtml += '<div style="font-size:0.8em;color:#8e8e93;line-height:1.6;">';
		kit.forEach(k => {
			sidebarHtml += `<div><strong>${k.codice}</strong> - ${k.descrizione}</div>`;
		});
		sidebarHtml += '</div></div>';
		
		// Motori
		sidebarHtml += '<div style="margin-bottom:16px;"><h4 style="color:#007aff;font-size:0.9em;margin:0 0 8px 0;">Motori</h4>';
		sidebarHtml += '<div style="font-size:0.8em;color:#8e8e93;line-height:1.6;">';
		motori.forEach(m => {
			sidebarHtml += `<div><strong>${m.codice}</strong> - ${m.brand} ${m.tipo}</div>`;
		});
		sidebarHtml += '</div></div>';
		
		// Adattatori
		sidebarHtml += '<div style="margin-bottom:16px;"><h4 style="color:#007aff;font-size:0.9em;margin:0 0 8px 0;">Adattatori</h4>';
		sidebarHtml += '<div style="font-size:0.8em;color:#8e8e93;line-height:1.6;">';
		adattatori.forEach(a => {
			sidebarHtml += `<div><strong>${a.codice}</strong> - ${a.descrizione}</div>`;
		});
		sidebarHtml += '</div></div>';
		
		articoliBox.innerHTML = sidebarHtml;
	}

	let html = '<div style="margin-bottom:16px;text-align:right;"><button id="salvaJsonBtn" style="padding:8px 16px;background:#28a745;color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:500;cursor:pointer;">Salva modifiche JSON</button></div>';
	html += '<div style="margin-bottom:20px;">';
	
	// Raggruppa per brand
	const gruppi = {};
	valvole.forEach(v => {
		if (!gruppi[v.brand]) gruppi[v.brand] = [];
		gruppi[v.brand].push(v);
	});

	Object.keys(gruppi).sort().forEach(brand => {
		html += `<div style="margin-bottom:24px;">`;
		html += `<h3 style="color:#007aff;font-size:1.15em;margin-bottom:12px;border-bottom:1px solid #3a3a3c;padding-bottom:6px;">${brand}</h3>`;
		
		gruppi[brand].forEach(v => {
			const key = `${v.brand}_${v.materiale}_${v.diametro}`;
			const keyWatergate = `${key}_WATERGATE`;
			
			// Kit con codice e descrizione
			const kitCodes = mappaKit[key] || [];
			const kitDisplay = kitCodes.map(kc => {
				const k = kit.find(x => x.codice === kc);
				return k ? `${k.codice} - ${k.descrizione}` : kc;
			}).join(' | ');
			const kitEditValue = kitCodes.join(', ');
			
			// Motori con codice, brand e tipo
			const motoriCodes = mappaMotore[key] || [];
			const motoriWatergateCodes = mappaMotore[keyWatergate] || [];
			const allMotoriCodes = [...new Set([...motoriCodes, ...motoriWatergateCodes])];
			const motoriDisplay = allMotoriCodes.map(mc => {
				const m = motori.find(x => x.codice === mc);
				return m ? `${m.codice} - ${m.brand} ${m.tipo}` : mc;
			}).join(' | ');
			const motoriEditValue = allMotoriCodes.join(', ');
			
			// Adattatore con codice e descrizione
			const adattatoreCode = mappaAdattatore[key] || '';
			const adattatoreDisplay = adattatoreCode ? (() => {
				const a = adattatori.find(x => x.codice === adattatoreCode);
				return a ? `${a.codice} - ${a.descrizione}` : adattatoreCode;
			})() : '';
			
			html += `
				<div style="background:#2c2c2e;border:1px solid #3a3a3c;border-radius:8px;padding:12px;margin-bottom:10px;" data-key="${key}">
					<div style="font-weight:600;color:#f2f2f7;margin-bottom:8px;">${v.materiale} ${v.diametro}mm</div>
					<div style="font-size:0.9em;line-height:1.8;">
						<div style="margin-bottom:8px;">
							<strong style="color:#f2f2f7;">Kit:</strong>
							<div style="color:#8e8e93;font-size:0.85em;margin:4px 0;">${kitDisplay || 'N/A'}</div>
							<input type="text" class="edit-kit" value="${kitEditValue}" style="width:100%;padding:4px 8px;background:#1c1c1e;border:1px solid #3a3a3c;border-radius:6px;color:#f2f2f7;font-size:0.9em;" placeholder="es: 25C162A, 25C162C">
						</div>
						<div style="margin-bottom:8px;">
							<strong style="color:#f2f2f7;">Motori:</strong>
							<div style="color:#8e8e93;font-size:0.85em;margin:4px 0;">${motoriDisplay || 'N/A'}</div>
							<input type="text" class="edit-motori" value="${motoriEditValue}" style="width:100%;padding:4px 8px;background:#1c1c1e;border:1px solid #3a3a3c;border-radius:6px;color:#f2f2f7;font-size:0.9em;" placeholder="es: 25C201Q, 25C201F">
						</div>
						<div>
							<strong style="color:#f2f2f7;">Adattatore:</strong>
							<div style="color:#8e8e93;font-size:0.85em;margin:4px 0;">${adattatoreDisplay || 'N/A'}</div>
							<input type="text" class="edit-adattatore" value="${adattatoreCode}" style="width:100%;padding:4px 8px;background:#1c1c1e;border:1px solid #3a3a3c;border-radius:6px;color:#f2f2f7;font-size:0.9em;" placeholder="es: 25C201C">
						</div>
					</div>
				</div>
			`;
		});
		
		html += `</div>`;
	});
	
	html += '</div>';
	recapContent.innerHTML = html;
	
	// Collega il pulsante salva
	setTimeout(() => {
		const salvaBtn = document.getElementById('salvaJsonBtn');
		if (salvaBtn) {
			salvaBtn.addEventListener('click', salvaModificheJson);
		}
	}, 0);
}

// Salva le modifiche ai JSON
function salvaModificheJson() {
	const cards = document.querySelectorAll('[data-key]');
	
	cards.forEach(card => {
		const key = card.getAttribute('data-key');
		const kitInput = card.querySelector('.edit-kit').value.trim();
		const motoriInput = card.querySelector('.edit-motori').value.trim();
		const adattatoreInput = card.querySelector('.edit-adattatore').value.trim();
		
		// Aggiorna kit
		if (kitInput) {
			mappaKit[key] = kitInput.split(',').map(s => s.trim()).filter(Boolean);
		} else {
			delete mappaKit[key];
		}
		
		// Aggiorna motori
		if (motoriInput) {
			mappaMotore[key] = motoriInput.split(',').map(s => s.trim()).filter(Boolean);
		} else {
			delete mappaMotore[key];
		}
		
		// Aggiorna adattatore
		if (adattatoreInput) {
			mappaAdattatore[key] = adattatoreInput;
		} else {
			delete mappaAdattatore[key];
		}
	});
	
	// Prepara i JSON per il download
	const jsonKit = JSON.stringify({ mappa: mappaKit }, null, 2);
	const jsonMotore = JSON.stringify({ mappa: mappaMotore }, null, 2);
	const jsonAdattatore = JSON.stringify({ mappa: mappaAdattatore }, null, 2);
	
	// Download mappa_valvola_kit.json
	downloadJson(jsonKit, 'mappa_valvola_kit.json');
	
	// Download mappa_valvola_motore.json
	setTimeout(() => downloadJson(jsonMotore, 'mappa_valvola_motore.json'), 200);
	
	// Download mappa_valvola_adattatore.json
	setTimeout(() => downloadJson(jsonAdattatore, 'mappa_valvola_adattatore.json'), 400);
	
	alert('JSON modificati scaricati! Sostituisci i file nella cartella data/ per applicare le modifiche.');
}

function downloadJson(content, filename) {
	const blob = new Blob([content], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
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
	table.innerHTML = `<tr><th>Punto impianto</th><th>Valvola</th><th>Motore</th><th>Perno/Kit</th><th>Adattatore</th></tr>`;
	// Righe
	window.configurazioniSalvate.forEach(cfg => {
		table.innerHTML += `<tr>
			<td>${cfg.puntoImpianto || ''}</td>
			<td>${cfg.brandValvola || ''} ${cfg.materialeValvola || ''} ${cfg.diametroValvola || ''}</td>
			<td>${cfg.motore || ''}</td>
			<td>${cfg.kit || ''}</td>
			<td>${cfg.adattatore || ''}</td>
		</tr>`;
	});
}

// Esporta tutte le configurazioni salvate in un unico CSV
function esportaTutteConfigurazioniCSV() {
	if (configurazioniSalvate.length === 0) return;
	// Raggruppa articoli (kit, adattatore, motore) e somma le quantità
	const articoli = {};
	configurazioniSalvate.forEach(cfg => {
		// Kit
		if (cfg.kit && cfg.kit !== 'Nessun kit configurato per questa combinazione.') {
			const k = cfg.kit;
			if (!articoli[k]) articoli[k] = { tipo: 'Kit', descrizione: k, quantita: 1 };
			else articoli[k].quantita++;
		}
		// Adattatore
		if (cfg.adattatore && cfg.adattatore !== 'Non richiesto.') {
			const a = cfg.adattatore;
			if (!articoli[a]) articoli[a] = { tipo: 'Adattatore', descrizione: a, quantita: 1 };
			else articoli[a].quantita++;
		}
		// Motore
		if (cfg.motore) {
			const m = cfg.motore;
			if (!articoli[m]) articoli[m] = { tipo: 'Motore', descrizione: m, quantita: 1 };
			else articoli[m].quantita++;
		}
	});
	mostraCsvArticoliPreviewModal(articoli);
// Mostra il modal di preview con lista articoli e quantità
function mostraCsvArticoliPreviewModal(articoli) {
	const modal = document.getElementById('csvPreviewModal');
	const tableBox = document.getElementById('csvPreviewTableBox');
	if (!modal || !tableBox) return;
	// Costruisci la lista HTML
	let html = '<table style="width:100%;text-align:left;font-size:1.05em;">';
	html += '<tr><th>Articolo</th><th>Quantità</th></tr>';
	Object.values(articoli).forEach(a => {
		html += `<tr><td>${a.descrizione}</td><td style="text-align:center;">${a.quantita}</td></tr>`;
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
}

// Mostra il modal di preview CSV
function mostraCsvPreviewModal(header, rows) {
	const modal = document.getElementById('csvPreviewModal');
	const tableBox = document.getElementById('csvPreviewTableBox');
	if (!modal || !tableBox) return;
	// Costruisci la tabella HTML
	let html = '<table style="width:100%;text-align:left;font-size:0.98em;">';
	html += '<tr>' + header.map(h => `<th>${h}</th>`).join('') + '</tr>';
	rows.forEach(r => {
		html += '<tr>' + r.map(v => `<td>${v}</td>`).join('') + '</tr>';
	});
	html += '</table>';
	tableBox.innerHTML = html;
	modal.style.display = 'flex';

	// Gestione pulsanti
	const btnConferma = document.getElementById('csvPreviewConfirmBtn');
	const btnAnnulla = document.getElementById('csvPreviewCancelBtn');
	if (btnConferma) {
		btnConferma.onclick = function() {
			esportaCsvDati(header, rows);
			modal.style.display = 'none';
		};
	}
	if (btnAnnulla) {
		btnAnnulla.onclick = function() {
			modal.style.display = 'none';
		};
	}
}

// Esporta i dati CSV (header + rows)
function esportaCsvDati(header, rows) {
	let csv = [header, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'configurazioni.csv';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
