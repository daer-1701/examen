const TOTAL_EXAMEN = 100;
const LETRAS = ["A", "B", "C", "D"];
const HISTORIAL_KEY = "dgesttla_historial_v1";

const estado = {
  banco: [],
  examen: [],
  respuestas: {},
  indice: 0,
  revIndice: 0,
  inicioMs: 0,
  timerId: null,
  segundos: 0,
};

function leerHistorial() {
  try {
    const raw = localStorage.getItem(HISTORIAL_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function guardarHistorial(lista) {
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(lista));
}

function agregarAlHistorial(entrada) {
  const lista = leerHistorial();
  lista.unshift(entrada);
  guardarHistorial(lista.slice(0, 200));
}

function formatoFecha(iso) {
  try {
    return new Date(iso).toLocaleString("es-BO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function renderHistorial() {
  const lista = leerHistorial();
  const contenedor = $("#historial-lista");
  const resumen = $("#historial-resumen");
  const btnBorrar = $("#btn-borrar-historial");

  if (!lista.length) {
    resumen.innerHTML = "";
    contenedor.innerHTML = `<p class="historial-vacio">Aún no hay exámenes guardados. Al finalizar uno, aparecerá aquí.</p>`;
    btnBorrar.hidden = true;
    return;
  }

  btnBorrar.hidden = false;
  const mejor = Math.max(...lista.map((x) => x.correctas));
  const promedio = Math.round(lista.reduce((s, x) => s + x.correctas, 0) / lista.length);
  resumen.innerHTML = `
    <div class="stat"><span class="stat-n">${lista.length}</span><span class="stat-l">exámenes</span></div>
    <div class="stat"><span class="stat-n">${mejor}/100</span><span class="stat-l">mejor</span></div>
    <div class="stat"><span class="stat-n">${promedio}/100</span><span class="stat-l">promedio</span></div>
  `;

  contenedor.innerHTML = `
    <table class="historial-tabla">
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>Puntaje</th>
          <th>%</th>
          <th>Tiempo</th>
        </tr>
      </thead>
      <tbody>
        ${lista
          .map(
            (item, i) => `
          <tr>
            <td>${lista.length - i}</td>
            <td>${escapeHtml(formatoFecha(item.fecha))}</td>
            <td><strong>${item.correctas}/${item.total}</strong></td>
            <td>${item.porcentaje}%</td>
            <td>${escapeHtml(formatoTiempo(item.segundos || 0))}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

const $ = (sel) => document.querySelector(sel);

const pantallas = {
  inicio: $("#pantalla-inicio"),
  examen: $("#pantalla-examen"),
  resultado: $("#pantalla-resultado"),
  revision: $("#pantalla-revision"),
};

function mostrarPantalla(nombre) {
  Object.values(pantallas).forEach((el) => el.classList.remove("activa"));
  pantallas[nombre].classList.add("activa");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatoTiempo(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function iniciarCronometro() {
  detenerCronometro();
  estado.segundos = 0;
  estado.inicioMs = Date.now();
  $("#cronometro").textContent = "00:00";
  estado.timerId = setInterval(() => {
    estado.segundos = Math.floor((Date.now() - estado.inicioMs) / 1000);
    $("#cronometro").textContent = formatoTiempo(estado.segundos);
  }, 1000);
}

function detenerCronometro() {
  if (estado.timerId) {
    clearInterval(estado.timerId);
    estado.timerId = null;
  }
}

function iniciarExamen() {
  if (estado.banco.length < TOTAL_EXAMEN) {
    alert(`El banco solo tiene ${estado.banco.length} preguntas.`);
    return;
  }
  estado.examen = shuffle(estado.banco).slice(0, TOTAL_EXAMEN);
  estado.respuestas = {};
  estado.indice = 0;
  iniciarCronometro();
  mostrarPantalla("examen");
  renderPregunta();
}

function respondidasCount() {
  return Object.keys(estado.respuestas).length;
}

function renderPregunta() {
  const i = estado.indice;
  const p = estado.examen[i];
  const n = estado.examen.length;

  $("#contador-pregunta").textContent = `Pregunta ${i + 1} / ${n}`;
  $("#meta-pregunta").textContent = `${p.ambito || p.tipo || "General"} · Nº oficial ${p.id}`;
  $("#enunciado").textContent = p.pregunta;
  $("#progreso-fill").style.width = `${((i + 1) / n) * 100}%`;
  $("#respondidas-info").textContent = `${respondidasCount()} respondidas`;

  const contenedor = $("#opciones");
  contenedor.innerHTML = "";
  const marcada = estado.respuestas[i];

  LETRAS.forEach((letra) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opcion" + (marcada === letra ? " seleccionada" : "");
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", marcada === letra ? "true" : "false");
    btn.innerHTML = `<span class="letra">${letra}</span><span class="texto">${escapeHtml(p.opciones[letra])}</span>`;
    btn.addEventListener("click", () => {
      estado.respuestas[i] = letra;
      renderPregunta();
    });
    contenedor.appendChild(btn);
  });

  $("#btn-anterior").disabled = i === 0;
  const esUltima = i === n - 1;
  $("#btn-siguiente").textContent = esUltima ? "Finalizar" : "Siguiente";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function irAnterior() {
  if (estado.indice > 0) {
    estado.indice--;
    renderPregunta();
  }
}

function irSiguienteOFin() {
  const n = estado.examen.length;
  if (estado.indice < n - 1) {
    estado.indice++;
    renderPregunta();
  } else {
    pedirConfirmacionFin();
  }
}

function pedirConfirmacionFin() {
  const faltan = TOTAL_EXAMEN - respondidasCount();
  const aviso = $("#aviso-sin-responder");
  if (faltan > 0) {
    aviso.textContent = `Aún tienes ${faltan} pregunta${faltan === 1 ? "" : "s"} sin responder. ¿Deseas finalizar de todos modos?`;
  } else {
    aviso.textContent = "Has respondido las 100 preguntas. Se calculará tu puntaje.";
  }
  $("#dialog-fin").showModal();
}

function finalizarExamen() {
  $("#dialog-fin").close();
  detenerCronometro();

  let correctas = 0;
  estado.examen.forEach((p, i) => {
    if (estado.respuestas[i] === p.correcta) correctas++;
  });

  const pct = Math.round((correctas / TOTAL_EXAMEN) * 100);
  agregarAlHistorial({
    fecha: new Date().toISOString(),
    correctas,
    total: TOTAL_EXAMEN,
    porcentaje: pct,
    segundos: estado.segundos,
    respondidas: respondidasCount(),
  });
  renderHistorial();

  $("#puntaje-numero").textContent = `${correctas} / ${TOTAL_EXAMEN}`;
  $("#puntaje-pct").textContent = `${pct}%`;
  $("#resultado-meta").textContent = `Tiempo: ${formatoTiempo(estado.segundos)} · Respondidas: ${respondidasCount()} de ${TOTAL_EXAMEN}`;
  mostrarPantalla("resultado");
}

function renderMapa() {
  const grid = $("#mapa-grid");
  grid.innerHTML = "";
  estado.examen.forEach((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mapa-btn";
    if (estado.respuestas[i]) b.classList.add("answered");
    if (i === estado.indice) b.classList.add("current");
    b.textContent = String(i + 1);
    b.addEventListener("click", () => {
      estado.indice = i;
      $("#dialog-mapa").close();
      renderPregunta();
    });
    grid.appendChild(b);
  });
}

function iniciarRevision() {
  estado.revIndice = 0;
  mostrarPantalla("revision");
  renderRevision();
}

function renderRevision() {
  const i = estado.revIndice;
  const p = estado.examen[i];
  const n = estado.examen.length;
  const elegida = estado.respuestas[i];
  const ok = elegida === p.correcta;

  $("#rev-contador").textContent = `Pregunta ${i + 1} / ${n}`;
  $("#rev-meta").textContent = `${p.ambito || p.tipo || "General"} · Nº oficial ${p.id}`;
  $("#rev-enunciado").textContent = p.pregunta;

  const estadoEl = $("#rev-estado");
  if (!elegida) {
    estadoEl.textContent = "Sin responder";
    estadoEl.className = "bad";
  } else if (ok) {
    estadoEl.textContent = "Correcta";
    estadoEl.className = "ok";
  } else {
    estadoEl.textContent = "Incorrecta";
    estadoEl.className = "bad";
  }

  const contenedor = $("#rev-opciones");
  contenedor.innerHTML = "";
  LETRAS.forEach((letra) => {
    const div = document.createElement("div");
    div.className = "opcion";
    if (letra === p.correcta) div.classList.add("correcta");
    if (elegida === letra && letra !== p.correcta) div.classList.add("incorrecta");
    if (elegida === letra) div.classList.add("seleccionada");
    div.innerHTML = `<span class="letra">${letra}</span><span class="texto">${escapeHtml(p.opciones[letra])}</span>`;
    contenedor.appendChild(div);
  });

  $("#rev-fuente").textContent = p.fuente
    ? `Fuente: ${p.fuente}`
    : "";

  $("#btn-rev-anterior").disabled = i === 0;
  $("#btn-rev-siguiente").textContent = i === n - 1 ? "Volver al resultado" : "Siguiente";
}

async function cargarBanco() {
  const res = await fetch("data/preguntas.json");
  if (!res.ok) throw new Error("No se pudo cargar data/preguntas.json");
  const data = await res.json();
  estado.banco = data.preguntas || [];
  $("#total-banco").textContent = String(data.total || estado.banco.length);
}

function cablearEventos() {
  $("#btn-iniciar").addEventListener("click", iniciarExamen);
  $("#btn-anterior").addEventListener("click", irAnterior);
  $("#btn-siguiente").addEventListener("click", irSiguienteOFin);
  $("#btn-mapa").addEventListener("click", () => {
    renderMapa();
    $("#dialog-mapa").showModal();
  });
  $("#btn-cancelar-fin").addEventListener("click", () => $("#dialog-fin").close());
  $("#btn-confirmar-fin").addEventListener("click", finalizarExamen);
  $("#btn-revisar").addEventListener("click", iniciarRevision);
  $("#btn-nuevo").addEventListener("click", iniciarExamen);
  $("#btn-ver-historial").addEventListener("click", () => {
    mostrarPantalla("inicio");
    renderHistorial();
    $("#historial-inicio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#btn-borrar-historial").addEventListener("click", () => {
    if (!confirm("¿Borrar todas las puntuaciones guardadas en este navegador?")) return;
    localStorage.removeItem(HISTORIAL_KEY);
    renderHistorial();
  });
  $("#btn-salir-revision").addEventListener("click", () => mostrarPantalla("resultado"));
  $("#btn-rev-anterior").addEventListener("click", () => {
    if (estado.revIndice > 0) {
      estado.revIndice--;
      renderRevision();
    }
  });
  $("#btn-rev-siguiente").addEventListener("click", () => {
    if (estado.revIndice < estado.examen.length - 1) {
      estado.revIndice++;
      renderRevision();
    } else {
      mostrarPantalla("resultado");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!pantallas.examen.classList.contains("activa")) return;
    if (e.target.closest("dialog")) return;
    const key = e.key.toUpperCase();
    if (LETRAS.includes(key)) {
      estado.respuestas[estado.indice] = key;
      renderPregunta();
    } else if (e.key === "ArrowLeft") {
      irAnterior();
    } else if (e.key === "ArrowRight") {
      irSiguienteOFin();
    }
  });
}

(async function main() {
  try {
    await cargarBanco();
    cablearEventos();
    renderHistorial();
  } catch (err) {
    console.error(err);
    $(".carga p").textContent = "Error al cargar el banco. Abre la página con un servidor local.";
    return;
  }
  $("#carga").classList.add("oculta");
})();
