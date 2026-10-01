// Esporta i dati mostrati nel box risultato in CSV
function esportaRisultatoCSV() {
  const r = window.risultatoCorrente;
  if (!r) return;
  const testo = item => item ? `${item.codice} — ${item.descrizione || ''}` : 'Non richiesto';
  const rows = [
    ['Valvola', testo(r.valvola)],
    ['Kit', testo(r.kit)],
    ['Adattatore', testo(r.adattatore)],
    ['Motore', testo(r.motore)]
  ];
  let csv = rows.map(r => r.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'risultato.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
