const TOTAL_EXAMEN = 100;
const LETRAS = ["A", "B", "C", "D"];
const HISTORIAL_KEY = "dgesttla_historial_v1";
const PROGRESO_KEY = "dgesttla_progreso_v1";

const estado = {
  banco: [],
  examen: [],
  respuestas: {},
  indice: 0,
  revIndice: 0,
};

const $ = (sel) => document.querySelector(sel);

const pantallas = {
  inicio: $("#pantalla-inicio"),
  examen: $("#pantalla-examen"),
  resultado: $("#pantalla-resultado"),
  revision: $("#pantalla-revision"),
};

function mostrarPantalla(nombre) {
  Object.values(pantallas).forEach((el) => {
    if (el) el.classList.remove("activa");
  });
  if (pantallas[nombre]) pantallas[nombre].classList.add("activa");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn("No se pudo guardar en localStorage:", err);
    return false;
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ——— Historial (no se borra al actualizar la app) ——— */
function leerHistorial() {
  try {
    const raw = safeGet(HISTORIAL_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function guardarHistorial(lista) {
  safeSet(HISTORIAL_KEY, JSON.stringify(lista));
}

function agregarAlHistorial(entrada) {
  const lista = leerHistorial();
  lista.unshift(entrada);
  guardarHistorial(lista.slice(0, 200));
}

function renderHistorial() {
  const lista = leerHistorial();
  const contenedor = $("#historial-lista");
  const resumen = $("#historial-resumen");
  const btnBorrar = $("#btn-borrar-historial");
  if (!contenedor || !resumen || !btnBorrar) return;

  if (!lista.length) {
    resumen.innerHTML = "";
    contenedor.innerHTML =
      '<p class="historial-vacio">Aún no hay exámenes guardados. Al finalizar uno, aparecerán aquí.</p>';
    btnBorrar.hidden = true;
    return;
  }

  btnBorrar.hidden = false;
  const mejor = Math.max(...lista.map((x) => x.correctas || 0));
  const promedio = Math.round(
    lista.reduce((s, x) => s + (x.correctas || 0), 0) / lista.length
  );
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
          <th>Respondidas</th>
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
            <td>${item.respondidas != null ? item.respondidas : "—"}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

/* ——— Progreso compacto (solo ids, no el texto completo) ——— */
function leerProgresoRaw() {
  try {
    const raw = safeGet(PROGRESO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function reconstruirExamenDesdeProgreso(prog) {
  if (!prog) return null;

  // Formato nuevo: ids
  if (Array.isArray(prog.ids) && prog.ids.length === TOTAL_EXAMEN) {
    const byId = new Map(estado.banco.map((q) => [q.id, q]));
    const examen = prog.ids.map((id) => byId.get(id)).filter(Boolean);
    if (examen.length !== TOTAL_EXAMEN) return null;
    return {
      examen,
      respuestas: prog.respuestas || {},
      indice: prog.indice || 0,
      guardadoEn: prog.guardadoEn,
    };
  }

  // Formato viejo: examen completo embebido
  if (Array.isArray(prog.examen) && prog.examen.length === TOTAL_EXAMEN) {
    return {
      examen: prog.examen,
      respuestas: prog.respuestas || {},
      indice: prog.indice || 0,
      guardadoEn: prog.guardadoEn,
    };
  }

  return null;
}

function hayProgresoGuardado() {
  return reconstruirExamenDesdeProgreso(leerProgresoRaw()) != null;
}

function guardarProgreso() {
  if (!estado.examen.length) return;
  const payload = {
    ids: estado.examen.map((q) => q.id),
    respuestas: estado.respuestas,
    indice: estado.indice,
    guardadoEn: new Date().toISOString(),
  };
  safeSet(PROGRESO_KEY, JSON.stringify(payload));
  actualizarUIProgreso();
}

function borrarProgreso() {
  safeRemove(PROGRESO_KEY);
  actualizarUIProgreso();
}

function actualizarUIProgreso() {
  const bloque = $("#aviso-progreso");
  const btnContinuar = $("#btn-continuar");
  const btnIniciar = $("#btn-iniciar");
  if (!bloque || !btnContinuar || !btnIniciar) return;

  const prog = reconstruirExamenDesdeProgreso(leerProgresoRaw());

  if (!prog) {
    bloque.hidden = true;
    btnContinuar.hidden = true;
    btnIniciar.textContent = "Iniciar examen";
    btnIniciar.classList.remove("btn-secundario");
    btnIniciar.classList.add("btn-principal");
    return;
  }

  const respondidas = Object.keys(prog.respuestas || {}).length;
  bloque.hidden = false;
  btnContinuar.hidden = false;
  btnIniciar.textContent = "Empezar de nuevo";
  btnIniciar.classList.remove("btn-principal");
  btnIniciar.classList.add("btn-secundario");
  const detalle = $("#progreso-detalle");
  if (detalle) {
    detalle.textContent =
      `Pregunta ${prog.indice + 1} de ${TOTAL_EXAMEN} · ${respondidas} respondidas` +
      (prog.guardadoEn ? ` · guardado ${formatoFecha(prog.guardadoEn)}` : "");
  }
}

function aplicarProgreso(prog) {
  estado.examen = prog.examen;
  estado.respuestas = prog.respuestas || {};
  estado.indice = Math.min(Math.max(Number(prog.indice) || 0, 0), TOTAL_EXAMEN - 1);
}

function iniciarExamen(forzarNuevo) {
  if (estado.banco.length < TOTAL_EXAMEN) {
    alert(`El banco solo tiene ${estado.banco.length} preguntas.`);
    return;
  }

  if (hayProgresoGuardado() && forzarNuevo) {
    const ok = confirm(
      "Ya tienes un examen en curso. Si empiezas de nuevo, se perderá el progreso actual. ¿Continuar?"
    );
    if (!ok) return;
  }

  estado.examen = shuffle(estado.banco).slice(0, TOTAL_EXAMEN);
  estado.respuestas = {};
  estado.indice = 0;
  guardarProgreso();
  mostrarPantalla("examen");
  renderPregunta();
}

function continuarExamen() {
  const prog = reconstruirExamenDesdeProgreso(leerProgresoRaw());
  if (!prog) {
    alert("No hay un examen guardado.");
    actualizarUIProgreso();
    return;
  }
  aplicarProgreso(prog);
  mostrarPantalla("examen");
  renderPregunta();
}

function salirYGuardar() {
  guardarProgreso();
  mostrarPantalla("inicio");
  renderHistorial();
  actualizarUIProgreso();
}

function respondidasCount() {
  return Object.keys(estado.respuestas).length;
}

function renderPregunta() {
  const i = estado.indice;
  const p = estado.examen[i];
  if (!p) return;
  const n = estado.examen.length;

  $("#contador-pregunta").textContent = `Pregunta ${i + 1} / ${n}`;
  $("#meta-pregunta").textContent = `${p.ambito || p.tipo || "General"} · Nº oficial ${p.id}`;
  $("#enunciado").textContent = p.pregunta;
  $("#progreso-fill").style.width = `${((i + 1) / n) * 100}%`;
  $("#respondidas-info").textContent = `${respondidasCount()} respondidas`;

  const contenedor = $("#opciones");
  contenedor.innerHTML = "";
  const marcada = estado.respuestas[i];
  const yaRespondida = Boolean(marcada);

  LETRAS.forEach((letra) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opcion";
    if (yaRespondida) {
      if (letra === p.correcta) btn.classList.add("correcta");
      if (marcada === letra && letra !== p.correcta) btn.classList.add("incorrecta");
      if (marcada === letra) btn.classList.add("seleccionada");
      btn.disabled = true;
    }
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", marcada === letra ? "true" : "false");
    btn.innerHTML = `<span class="letra">${letra}</span><span class="texto">${escapeHtml(p.opciones[letra])}</span>`;
    if (!yaRespondida) {
      btn.addEventListener("click", () => {
        estado.respuestas[i] = letra;
        guardarProgreso();
        renderPregunta();
      });
    }
    contenedor.appendChild(btn);
  });

  const feedback = $("#feedback");
  if (yaRespondida) {
    const ok = marcada === p.correcta;
    feedback.hidden = false;
    feedback.className = "feedback " + (ok ? "ok" : "bad");
    if (ok) {
      feedback.innerHTML = `<strong>Correcta.</strong> La respuesta es <strong>${p.correcta}</strong>.`;
    } else {
      feedback.innerHTML =
        `<strong>Incorrecta.</strong> Elegiste <strong>${marcada}</strong>. ` +
        `La respuesta correcta es <strong>${p.correcta}</strong>: ${escapeHtml(p.opciones[p.correcta])}`;
    }
  } else {
    feedback.hidden = true;
    feedback.className = "feedback";
    feedback.innerHTML = "";
  }

  $("#btn-anterior").disabled = i === 0;
  $("#btn-siguiente").textContent = i === n - 1 ? "Finalizar" : "Siguiente";
  guardarProgreso();
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
    respondidas: respondidasCount(),
  });
  borrarProgreso();
  renderHistorial();

  $("#puntaje-numero").textContent = `${correctas} / ${TOTAL_EXAMEN}`;
  $("#puntaje-pct").textContent = `${pct}%`;
  $("#resultado-meta").textContent = `Respondidas: ${respondidasCount()} de ${TOTAL_EXAMEN}`;
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
  if (!p) return;
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

  $("#rev-fuente").textContent = p.fuente ? `Fuente: ${p.fuente}` : "";
  $("#btn-rev-anterior").disabled = i === 0;
  $("#btn-rev-siguiente").textContent = i === n - 1 ? "Volver al resultado" : "Siguiente";
}

async function cargarBanco() {
  const res = await fetch("data/preguntas.json");
  if (!res.ok) throw new Error("No se pudo cargar data/preguntas.json");
  const data = await res.json();
  estado.banco = data.preguntas || [];
  const totalEl = $("#total-banco");
  if (totalEl) totalEl.textContent = String(data.total || estado.banco.length);
}

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

function cablearEventos() {
  on("btn-iniciar", "click", () => iniciarExamen(true));
  on("btn-continuar", "click", continuarExamen);
  on("btn-salir", "click", salirYGuardar);
  on("btn-anterior", "click", irAnterior);
  on("btn-siguiente", "click", irSiguienteOFin);
  on("btn-mapa", "click", () => {
    renderMapa();
    $("#dialog-mapa").showModal();
  });
  on("btn-cancelar-fin", "click", () => $("#dialog-fin").close());
  on("btn-confirmar-fin", "click", finalizarExamen);
  on("btn-revisar", "click", iniciarRevision);
  on("btn-nuevo", "click", () => iniciarExamen(true));
  on("btn-ver-historial", "click", () => {
    mostrarPantalla("inicio");
    renderHistorial();
    actualizarUIProgreso();
    $("#historial-inicio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  on("btn-borrar-historial", "click", () => {
    if (!confirm("¿Borrar todas las puntuaciones guardadas en este navegador?")) return;
    safeRemove(HISTORIAL_KEY);
    renderHistorial();
  });
  on("btn-salir-revision", "click", () => mostrarPantalla("resultado"));
  on("btn-rev-anterior", "click", () => {
    if (estado.revIndice > 0) {
      estado.revIndice--;
      renderRevision();
    }
  });
  on("btn-rev-siguiente", "click", () => {
    if (estado.revIndice < estado.examen.length - 1) {
      estado.revIndice++;
      renderRevision();
    } else {
      mostrarPantalla("resultado");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!pantallas.examen?.classList.contains("activa")) return;
    if (e.target.closest("dialog")) return;
    const key = e.key.toUpperCase();
    if (LETRAS.includes(key)) {
      if (estado.respuestas[estado.indice]) return;
      estado.respuestas[estado.indice] = key;
      guardarProgreso();
      renderPregunta();
    } else if (e.key === "ArrowLeft") {
      irAnterior();
    } else if (e.key === "ArrowRight") {
      irSiguienteOFin();
    }
  });
}

function ocultarCarga(mensajeError) {
  const carga = $("#carga");
  if (!carga) return;
  if (mensajeError) {
    const p = carga.querySelector("p");
    if (p) p.textContent = mensajeError;
    carga.classList.add("con-error");
    return;
  }
  carga.classList.add("oculta");
}

(async function main() {
  try {
    await cargarBanco();
    cablearEventos();
    renderHistorial();
    actualizarUIProgreso();
    ocultarCarga();
  } catch (err) {
    console.error(err);
    ocultarCarga(
      "No se pudo cargar el banco. Usa iniciar.bat o abre http://localhost:8080 (no abras el HTML directo)."
    );
  }
})();
