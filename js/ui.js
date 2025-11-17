// UI dinamica a tag per i filtri
window.statoSelezione = {
	brandValvola: null,
	materialeValvola: null,
	diametroValvola: null,
	brandMotore: null,
	tipoMotore: null
};

function creaTag(container, values, selected, disabledSet, onClick) {
	container.innerHTML = '';
	values.forEach(val => {
		const btn = document.createElement('button');
		btn.className = 'tag-btn';
		btn.textContent = val;
		if (selected === val) btn.classList.add('selected');
		if (disabledSet && disabledSet.has(val)) {
			btn.classList.add('disabled');
			btn.disabled = true;
		}
		btn.addEventListener('click', () => onClick(val));
		container.appendChild(btn);
	});
}

function aggiornaTagUI(valvole, motori) {
	// Brand valvola
	const brands = [...new Set(valvole.map(v => v.brand))];
	let materiali = [];
	let diametri = [];
	let materialiDis = new Set();
	let diametriDis = new Set();

	// Materiali e diametri filtrati in base a brand/materiale
	if (statoSelezione.brandValvola) {
		materiali = [...new Set(valvole.filter(v => v.brand === statoSelezione.brandValvola).map(v => v.materiale))];
		if (statoSelezione.materialeValvola) {
			diametri = [...new Set(valvole.filter(v => v.brand === statoSelezione.brandValvola && v.materiale === statoSelezione.materialeValvola).map(v => v.diametro))];
		} else {
			diametri = [...new Set(valvole.filter(v => v.brand === statoSelezione.brandValvola).map(v => v.diametro))];
		}
		// Disabilita materiali non possibili
		materialiDis = new Set([...new Set(valvole.filter(v => v.brand === statoSelezione.brandValvola).map(v => v.materiale))].filter(m => !materiali.includes(m)));
		// Disabilita diametri non possibili
		diametriDis = new Set([...new Set(valvole.filter(v => v.brand === statoSelezione.brandValvola).map(v => v.diametro))].filter(d => !diametri.includes(d)));
	} else {
		materiali = [...new Set(valvole.map(v => v.materiale))];
		diametri = [...new Set(valvole.map(v => v.diametro))];
	}

	creaTag(document.getElementById('brandValvolaTags'), brands, statoSelezione.brandValvola, null, val => {
		statoSelezione.brandValvola = statoSelezione.brandValvola === val ? null : val;
		statoSelezione.materialeValvola = null;
		statoSelezione.diametroValvola = null;
		aggiornaTagUI(valvole, motori);
	});
	creaTag(document.getElementById('materialeValvolaTags'), materiali, statoSelezione.materialeValvola, materialiDis, val => {
		statoSelezione.materialeValvola = statoSelezione.materialeValvola === val ? null : val;
		statoSelezione.diametroValvola = null;
		aggiornaTagUI(valvole, motori);
	});
	creaTag(document.getElementById('diametroValvolaTags'), diametri, statoSelezione.diametroValvola, diametriDis, val => {
		statoSelezione.diametroValvola = statoSelezione.diametroValvola === val ? null : val;
		aggiornaTagUI(valvole, motori);
	});

	// Motori
	const brandMotori = [...new Set(motori.map(m => m.brand))];
	let tipiMotore = [];
	let tipiMotoreDis = new Set();
	if (statoSelezione.brandMotore) {
		tipiMotore = [...new Set(motori.filter(m => m.brand === statoSelezione.brandMotore).map(m => m.tipo))];
		tipiMotoreDis = new Set([...new Set(motori.filter(m => m.brand === statoSelezione.brandMotore).map(m => m.tipo))].filter(t => !tipiMotore.includes(t)));
	} else {
		tipiMotore = [...new Set(motori.map(m => m.tipo))];
	}
	creaTag(document.getElementById('brandMotoreTags'), brandMotori, statoSelezione.brandMotore, null, val => {
		statoSelezione.brandMotore = statoSelezione.brandMotore === val ? null : val;
		statoSelezione.tipoMotore = null;
		aggiornaTagUI(valvole, motori);
	});
	creaTag(document.getElementById('tipoMotoreTags'), tipiMotore, statoSelezione.tipoMotore, tipiMotoreDis, val => {
		statoSelezione.tipoMotore = statoSelezione.tipoMotore === val ? null : val;
		aggiornaTagUI(valvole, motori);
	});
}

// Inizializzazione: attende che logic.js abbia caricato i dati
window.initTagUI = function(valvole, motori) {
	aggiornaTagUI(valvole, motori);
};
