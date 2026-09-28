# station

El backend de la Control Station de Hyperloop UPV: escucha a las placas del
pod, decodifica sus paquetes, los reenvía a los frontends y guarda un
registro en disco. Construido sobre [`software-core`](../core/README.md).

Ver [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) para el diseño completo.

## Arrancar

```sh
cargo run -p station -- --config ./dev-config.toml
```

*(Pendiente: crear `dev-config.toml` y `config.toml`, portados de
`backend_old/cmd/`.)*

