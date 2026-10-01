const DURACION = 15 * 60 * 1000; // 15 minutos en milisegundos
const CLAVE = 'alquileres-pelotas';
const CLAVE_ELIMINAR = 'Tv3969i'; // contraseña para eliminar registros, cámbiala aquí

const form = document.getElementById('formulario');
const inputPelota = document.getElementById('pelota');
const errorEl = document.getElementById('error');
const lista = document.getElementById('lista');
const vacio = document.getElementById('vacio');

let alquileres = [];
try { alquileres = JSON.parse(localStorage.getItem(CLAVE)) || []; } catch (e) {}
const guardar = () => localStorage.setItem(CLAVE, JSON.stringify(alquileres));
const hora = ms => new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const escapar = t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- Alarma sonora al terminar el tiempo (no necesita archivos externos) ---
const alarmados = new Set(); // ids que ya sonaron, para no repetir la alarma
// Marca como "ya alarmados" los que quedaron finalizados desde antes de abrir la página
alquileres.forEach(a => { if (Date.now() >= a.fin) alarmados.add(a.id); });
let contextoAudio = null;
function sonarAlarma() {
  try {
    contextoAudio = contextoAudio || new (window.AudioContext || window.webkitAudioContext)();
    const ahora = contextoAudio.currentTime;
    [0, 0.35, 0.7].forEach(retraso => {
      const osc = contextoAudio.createOscillator();
      const vol = contextoAudio.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      vol.gain.setValueAtTime(0.0001, ahora + retraso);
      vol.gain.exponentialRampToValueAtTime(0.3, ahora + retraso + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ahora + retraso + 0.28);
      osc.connect(vol).connect(contextoAudio.destination);
      osc.start(ahora + retraso);
      osc.stop(ahora + retraso + 0.3);
    });
  } catch (e) { /* el navegador no soporta audio o aún no hay interacción del usuario */ }
}
// Los navegadores solo dejan reproducir sonido después de una interacción del usuario.
// Con este primer clic en la página queda "desbloqueado" el audio para las alarmas futuras.
document.addEventListener('click', () => {
  contextoAudio = contextoAudio || new (window.AudioContext || window.webkitAudioContext)();
}, { once: true });

form.addEventListener('submit', e => {
  e.preventDefault();
  const pelota = inputPelota.value.trim();
  if (!pelota) return mostrarError('Escribe el número de la pelota.');
  if (alquileres.some(a => a.pelota === pelota && Date.now() < a.fin)) {
    return mostrarError(`La pelota ${pelota} ya está en alquiler.`);
  }
  const inicio = Date.now();
  alquileres.push({
    id: String(inicio) + Math.random().toString(36).slice(2, 6),
    pelota, inicio, fin: inicio + DURACION,
    pagado: false,
    metodo: 'efectivo'
  });
  guardar();
  mostrarError('');
  inputPelota.value = '';
  inputPelota.focus();
  dibujar();
});

function mostrarError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
}

// Botones y selects de cada tarjeta (método de pago, pago y eliminar)
lista.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.closest('.item').dataset.id;
  const a = alquileres.find(x => x.id === id);
  if (btn.dataset.accion === 'pagar') {
    if (!a.pagado) {
      const metodoTexto = a.metodo === 'nequi' ? 'Nequi' : 'Efectivo';
      const confirmado = confirm(`¿Confirmas que la pelota ${a.pelota} pagó por ${metodoTexto}?`);
      if (!confirmado) return;
    }
    a.pagado = !a.pagado;
  } else if (btn.dataset.accion === 'borrar') {
    const clave = prompt('Escribe la contraseña para eliminar este registro:');
    if (clave === null) return; // canceló
    if (clave !== CLAVE_ELIMINAR) { alert('Contraseña incorrecta.'); return; }
    if (!confirm('¿Eliminar este registro?')) return;
    alquileres = alquileres.filter(x => x.id !== id);
  }
  guardar();
  dibujar();
});

lista.addEventListener('change', e => {
  const select = e.target.closest('select[data-accion="metodo"]');
  if (!select) return;
  const id = select.closest('.item').dataset.id;
  const a = alquileres.find(x => x.id === id);
  a.metodo = select.value;
  guardar();
});

function dibujar() {
  const hay = alquileres.length > 0;
  vacio.hidden = hay;
  lista.innerHTML = [...alquileres].reverse().map(a => `
    <li class="item" data-id="${a.id}" data-fin="${a.fin}">
      <div class="num">${escapar(a.pelota)}</div>
      <div class="datos">
        <span>Inicio <b>${hora(a.inicio)}</b></span>
        <span>Fin <b>${hora(a.fin)}</b></span>
        <span class="tiempo">--:--</span>
        <span class="estado">En curso</span>
      </div>
      <div class="acciones">
        <select data-accion="metodo" ${a.pagado ? 'disabled' : ''}>
          <option value="efectivo" ${a.metodo !== 'nequi' ? 'selected' : ''}>Efectivo</option>
          <option value="nequi" ${a.metodo === 'nequi' ? 'selected' : ''}>Nequi</option>
        </select>
        <button data-accion="pagar" class="pago ${a.pagado ? 'ok' : ''}">${a.pagado ? '✔ Pago OK' : 'Marcar pago'}</button>
        <button data-accion="borrar" class="borrar" title="Eliminar">✕</button>
      </div>
    </li>`).join('');
  actualizar();
}

// Cuenta regresiva: se actualiza cada segundo
function actualizar() {
  document.querySelectorAll('.item').forEach(li => {
    const resta = (Number(li.dataset.fin) - Date.now()) / 1000;
    const t = li.querySelector('.tiempo');
    const estado = li.querySelector('.estado');
    if (resta > 0) {
      const m = String(Math.floor(resta / 60)).padStart(2, '0');
      const s = String(Math.floor(resta % 60)).padStart(2, '0');
      t.textContent = `${m}:${s}`;
      li.classList.toggle('poco', resta <= 60);
      estado.textContent = resta <= 60 ? 'Por vencer' : 'En curso';
    } else {
      t.textContent = 'Tiempo terminado';
      li.classList.remove('poco');
      li.classList.add('fin');
      estado.textContent = 'Finalizado';
      if (!alarmados.has(li.dataset.id)) {
        alarmados.add(li.dataset.id);
        sonarAlarma();
      }
    }
  });
}

dibujar();
setInterval(actualizar, 1000);
