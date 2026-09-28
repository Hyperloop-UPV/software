# Demo: core → station + tracing

Desde `software/backend`, con Rust 1.98.0 y Cargo instalados (la primera
ejecución descarga las dependencias):

```sh
# Ejecutar: muestra el saludo y el ciclo de vida a nivel INFO.
cargo run -p station
cargo run -p station -- "Hyperloop UPV"

# Mostrar también DEBUG del módulo, manteniendo INFO en station.
RUST_LOG=info,software_core::hello_world=debug cargo run -p station -- "Lucía"

# Filtrar todos los eventos de esta demo (no emite errores).
RUST_LOG=error cargo run -p station

# Tests unitarios y ejemplo de documentación ejecutable (doctest).
cargo test --workspace

# Generar documentación HTML de la API.
cargo doc --workspace --no-deps

# Comprobaciones de formato y lints.
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
```

Abre `target/doc/software_core/hello_world/index.html` para ver la API.

- `crates/core/src/hello_world.rs`: `greet(&str) -> String`, con rustdoc,
  un doctest y tres tests unitarios. Recorta espacios; un nombre vacío usa `World`.
- `crates/core/src/lib.rs`: exporta el módulo público.
- `crates/station/src/main.rs`: inicializa el subscriber una sola vez y llama a `greet`.
- `#[tracing::instrument]` crea el span `hello_world`; los eventos incluyen
  el destinatario y campos estructurados como `greeting` o `used_default`.
  `INFO` muestra el saludo; `DEBUG` permite inspeccionar la elección del destinatario.
- Core solo emite eventos: sin subscriber, devuelve igualmente el saludo.
  Los tests comprueban ese resultado sin configurar logging global.

Esta demo termina tras saludar; todavía no arranca servidores ni carga TOML.
Usa los comandos Cargo de arriba: los scripts `pnpm dev` están preparados para
la futura configuración del backend, que esta demo no interpreta.
