# Laboratorio de Control — Linealización · Segundo Orden · Mason

Sitio web estático e interactivo para estudiar tres temas del capítulo de *Modelado de Sistemas
Dinámicos* (Notas de Análisis de Sistemas de Control, Universidad de los Andes): linealización
de sistemas no lineales, sistemas de segundo orden, y diagramas de bloques con la ley de Mason.

No requiere backend ni proceso de compilación: es HTML + CSS + JavaScript puro (solo se usa
[math.js](https://mathjs.org/) por CDN para evaluar derivadas simbólicas en la sección de
linealización). Se puede abrir localmente o publicar directo en GitHub Pages.

## Estructura

```
control-lab/
├── index.html            # las tres secciones (canales CH·1, CH·2, CH·3)
├── css/
│   └── style.css         # identidad visual tipo panel de instrumentación
└── js/
    ├── plot.js            # helper de trazado en <canvas> (ejes, curvas, marcadores)
    ├── linearization.js    # sección 1 — linealización alrededor de un punto de operación
    ├── secondorder.js       # sección 2 — forma estándar de 2º orden, escalón y plano-s
    ├── mason.js              # sección 3 — editor de grafo + fórmula de ganancia de Mason
    └── app.js                # navegación entre secciones
```

## Qué hace cada sección

**1 · Linealización.** Elige un sistema no lineal ẋ = f(x, u) (o escribe el tuyo), mueve el
punto de operación x̄ (con el slider o haciendo clic sobre la curva) y observa la recta tangente
calculada con la derivada exacta (vía `math.js`). Se reporta ∂f/∂x, ∂f/∂u, y el error relativo
máximo de la aproximación dentro de una ventana ajustable — así el estudiante ve numéricamente
hasta dónde "aguanta" la linealización, tal como discute la Figura 3.2 del capítulo.

**2 · Segundo orden.** Tres sliders (K, ζ, ωₙ) generan en vivo la función de transferencia
estándar, la respuesta al escalón unitario (con las fórmulas cerradas exactas para los cuatro
casos: no amortiguado, subamortiguado, crítico y sobreamortiguado) y el mapa de polos en el
plano-s, con overlays opcionales para la envolvente exponencial, la línea radial de ζ constante,
el círculo de ωₙ constante y la línea vertical de tiempo de asentamiento constante (Figura 3.10).
Incluye botones con los cuatro sistemas de los ejercicios de repaso del capítulo.

**3 · Mason.** Editor de diagramas de flujo de señal: se agregan nodos con clic, se conectan con
ramas etiquetadas (p. ej. `G1`, `-H1`), se elige el nodo de entrada/salida, y el botón *Calcular*
corre un algoritmo que:
- enumera todos los trayectos directos (DFS simple-path),
- enumera todos los lazos (cíclos simples, sin duplicados),
- encuentra todas las combinaciones de lazos disjuntos (pares, tríos, …),
- arma Δ y cada cofactor Δₖ con el mismo formato del capítulo,
- y compone la función de transferencia final T(s) = Σ Pₖ·Δₖ / Δ.

El botón *Figura 3.20* carga el ejemplo de 9 nodos del capítulo — el resultado reproduce
exactamente L1=−G2H1, L2=−G2G3G4H4, L3=−G4H2, L4=−G8H3, los pares/trío no disjuntos y las Δₖ
del libro, así que sirve para que el estudiante verifique el algoritmo contra el ejemplo resuelto
antes de construir su propio diagrama.

## Publicar en GitHub Pages

1. Sube esta carpeta (o su contenido) a la raíz de tu repositorio.
2. En GitHub → *Settings* → *Pages*, selecciona la rama y la carpeta raíz (`/`).
3. Espera unos minutos y el sitio queda disponible en
   `https://<tu-usuario>.github.io/<tu-repo>/`.

También puedes probarlo localmente sin ningún servidor especial, por ejemplo:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Notas de implementación

- Todo el trazado numérico (curvas, polos, envolventes) usa `<canvas>` 2D nativo — sin
  librerías de gráficas externas.
- El diagrama de bloques usa SVG nativo con arrastre de nodos (`pointerdown/move/up`).
- El único recurso externo es el CDN de `math.js`, usado solo en la sección de linealización
  para parsear la función ingresada y derivarla simbólicamente.
- Diseño responsivo: por debajo de 900px las columnas de control y las pantallas se apilan.
