// Esporta la tabella delle configurazioni salvate in PDF
function esportaRiepilogoPDF() {
  // jsPDF UMD: window.jspdf.jsPDF e window.jspdf.autoTable
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('Per esportare in PDF è necessario includere jsPDF.');
    return;
  }
  if (!window.configurazioniSalvate || configurazioniSalvate.length === 0) {
    alert('Nessuna configurazione salvata da esportare.');
    return;
  }
  const doc = new window.jspdf.jsPDF();
  doc.setFontSize(13);
  doc.text('Riepilogo configurazioni salvate', 14, 16);
  const headers = [['Punto impianto', 'Valvola', 'Motore', 'Perno/Kit', 'Adattatore', 'Selezione']];
  const rows = configurazioniSalvate.map(cfg => [
    cfg.puntoImpianto || '',
    (cfg.valvola || '').replace(' — ', '\n'),
    (cfg.motore || '').replace(' — ', '\n'),
    (cfg.kit || '').replace(' — ', '\n'),
    (cfg.adattatore || '').replace(' — ', '\n'),
    cfg.selezione || 'Automatica'
  ]);
  const opzioni = {
    head: headers,
    body: rows,
    startY: 22,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 32 },
      2: { cellWidth: 36 },
      3: { cellWidth: 36 },
      4: { cellWidth: 30 },
      5: { cellWidth: 22 }
    }
  };
  if (window.jspdf && window.jspdf.autoTable) {
    window.jspdf.autoTable(doc, opzioni);
  } else if (doc.autoTable) {
    doc.autoTable(opzioni);
  } else {
    // fallback semplice
    let y = 28;
    headers[0].forEach((h, i) => doc.text(h, 14 + i*30, y));
    y += 8;
    rows.forEach(r => {
      r.forEach((v, i) => doc.text(String(v), 14 + i*30, y));
      y += 8;
    });
  }
  doc.save('riepilogo_configurazioni.pdf');
}
