// Textos comunes de las alertas (HU12, HU13, HU04) para la tarjeta de estado y el historial.
// Tareas T21 y T24 – Mateo Andrade
export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—');
export const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const grados = (t) => (t === null || t === undefined ? '—' : `${Number(t).toFixed(1)} °C`);

export const TIPOS = {
  temperatura: { etiqueta: 'Temperatura fuera de rango', icono: '🌡', clase: 'alerta' },
  sin_senal: { etiqueta: 'Sin señal', icono: '📡', clase: 'sin-senal' },
  corte_energia: { etiqueta: 'Corte de energía', icono: '⚡', clase: 'energia' },
  bateria_baja: { etiqueta: 'Batería baja', icono: '🔋', clase: 'energia' },
};

export const ESTADOS_ALERTA = {
  activa: { etiqueta: 'Activa', chip: 'error' },
  atendida: { etiqueta: 'Atendida', chip: 'aviso' },
  cerrada: { etiqueta: 'Cerrada', chip: 'ok' },
  pendiente: { etiqueta: 'En tolerancia', chip: 'neutro' },
  descartada: { etiqueta: 'Descartada', chip: 'neutro' },
};

/** Una línea que explica la alerta: desde cuándo y con qué valor. */
export function detalleAlerta(a) {
  switch (a.tipo) {
    case 'temperatura': return `Desde las ${hora(a.inicio_en)} · extremo ${grados(a.valor_extremo)}`;
    case 'sin_senal': return `Último dato a las ${hora(a.inicio_en)}`;
    case 'corte_energia': return `Desde las ${hora(a.inicio_en)}${a.bateria_pct !== null && a.bateria_pct !== undefined ? ` · batería ${a.bateria_pct} %` : ''}`;
    case 'bateria_baja': return `Batería ${a.bateria_pct ?? '—'} % · ${hora(a.inicio_en)}`;
    default: return '';
  }
}
