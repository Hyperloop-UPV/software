# software-core

Piezas genéricas y reutilizables de Hyperloop UPV: modelo de datos, protocolo de
paquetes, lectura del ADJ y transporte de red. No depende de nada propio del
backend (`station`), así que también sirve de base para otras herramientas
como un sniffer o un simulador.

Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) para el diseño completo.

## Módulos

- `model` — identificadores, paquetes, valores, medidas y unidades. Siempre disponible.
- `protocol` — traduce bytes a paquetes y paquetes a bytes. Siempre disponible.
- `adj` — lee el ADJ y construye los descriptores para `protocol`.
- `net` *(feature `net`)* — conexiones TCP y UDP.
- `logger` *(feature `logger`)* — registro de datos en CSV.
- `trace` *(feature `trace`)* — configuración de trazas de diagnóstico.

## Features

```toml
software-core = { path = "...", features = ["net", "adj"] }
```

Por defecto no se activa ninguna: quien use el crate paga solo por lo que
necesita. Ver la tabla completa en `ARCHITECTURE.md`, apartado 12.

## Ejemplo

```rust
// Pendiente: añadir cuando exista el primer decodificador público.
```
